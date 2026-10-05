//! Raccourcis globaux (brief §5) : ⌥⌘P démarrer/suspendre, ⌥⌘N ajout rapide, ⌥⌘S vue complète.

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn shortcut(code: Code) -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), code)
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, sc, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if sc == &shortcut(Code::KeyP) {
                let _ = app.emit_to("widget", "sakura://toggle", ());
            } else if sc == &shortcut(Code::KeyN) {
                quick_add(app);
            } else if sc == &shortcut(Code::KeyS) {
                let _ = crate::widget::show_main(app.clone());
            }
        })
        .build()
}

/// Déploie le widget et place le curseur dans le champ d'ajout : il faut activer l'app pour
/// recevoir le clavier.
fn quick_add(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("widget") {
        let _ = w.set_focus();
        let _ = app.emit_to("widget", "sakura://quick-add", ());
    }
}

/// Un raccourci déjà pris par une autre app ne doit pas empêcher Sakura de démarrer.
pub fn register_all(app: &AppHandle) {
    for code in [Code::KeyP, Code::KeyN, Code::KeyS] {
        if let Err(e) = app.global_shortcut().register(shortcut(code)) {
            eprintln!("Raccourci ⌥⌘{code:?} indisponible : {e}");
        }
    }
}
