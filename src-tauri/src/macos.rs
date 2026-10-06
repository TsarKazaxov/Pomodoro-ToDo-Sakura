//! Réglages natifs macOS (D-032). Compilé uniquement pour macOS.

use std::cell::RefCell;

use objc2::rc::Retained;
use objc2::runtime::{NSObjectProtocol, ProtocolObject};
use objc2_app_kit::{NSStatusWindowLevel, NSWindow, NSWindowCollectionBehavior};
use objc2_foundation::{NSActivityOptions, NSProcessInfo, NSString};
use tauri::WebviewWindow;

/// Le widget et la pluie de pétales suivent l'utilisateur partout (D-032, D-038) :
/// - sur tous les bureaux et par-dessus une app en plein écran ;
/// - avec toutes les apps dans Stage Manager (`CanJoinAllApplications`, macOS 13+, ignoré avant) ;
/// - au-dessus des palettes flottantes des autres apps (niveau « status »).
pub fn float_everywhere(window: &WebviewWindow) {
    let Ok(ptr) = window.ns_window() else {
        return;
    };
    // SAFETY : Tauri renvoie le NSWindow de cette fenêtre ; appelé sur le fil principal.
    let ns: &NSWindow = unsafe { &*ptr.cast::<NSWindow>() };
    // Comportement complet, pas un « ou » avec l'existant : certaines options sont exclusives
    // entre elles (Managed/Stationary…) et macOS lève une exception si on les combine.
    ns.setCollectionBehavior(
        NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::Stationary
            | NSWindowCollectionBehavior::IgnoresCycle
            | NSWindowCollectionBehavior::FullScreenAuxiliary
            | NSWindowCollectionBehavior::CanJoinAllApplications,
    );
    ns.setLevel(NSStatusWindowLevel);
    ns.setHidesOnDeactivate(false);
}

thread_local! {
    static ACTIVITY: RefCell<Option<Retained<ProtocolObject<dyn NSObjectProtocol>>>> =
        const { RefCell::new(None) };
}

/// Empêche App Nap de ralentir le minuteur pendant une phase en cours ; la mise en veille
/// du Mac reste permise (le minuteur se recale tout seul au réveil). Fil principal uniquement.
pub fn keep_timer_awake(active: bool) {
    ACTIVITY.with(|cell| {
        let mut slot = cell.borrow_mut();
        let info = NSProcessInfo::processInfo();
        match (active, slot.is_some()) {
            (true, false) => {
                let reason = NSString::from_str("Minuteur Pomodoro en cours");
                *slot = Some(info.beginActivityWithOptions_reason(
                    NSActivityOptions::UserInitiatedAllowingIdleSystemSleep,
                    &reason,
                ));
            }
            (false, true) => {
                if let Some(activity) = slot.take() {
                    // SAFETY : `activity` vient de beginActivityWithOptions et n'a pas été terminée.
                    unsafe { info.endActivity(&activity) };
                }
            }
            _ => {}
        }
    });
}
