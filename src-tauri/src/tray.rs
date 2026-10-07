//! Icône de barre de menu : temps restant, Démarrer/Suspendre, Ouvrir, Quitter (brief §5).

use std::time::Duration;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, State, Wry};

pub struct TrayState {
    tray: TrayIcon<Wry>,
    toggle: MenuItem<Wry>,
}

/// Délai laissé au widget pour écrire les données avant de quitter.
const QUIT_GRACE: Duration = Duration::from_millis(1500);

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Démarrer", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Ouvrir Sakura", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter Sakura", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&toggle, &open, &sep, &quit])?;
    let tray = TrayIconBuilder::with_id("sakura")
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .icon_as_template(true)
        .tooltip("Sakura")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => {
                let _ = app.emit_to("widget", "sakura://toggle", ());
            }
            "open" => {
                let _ = crate::widget::show_main(app.clone());
            }
            "quit" => request_quit(app),
            _ => {}
        })
        .build(app)?;
    app.manage(TrayState { tray, toggle });
    Ok(())
}

/// Demande au widget d'écrire ses données, puis quitte (au plus tard après `QUIT_GRACE`).
pub fn request_quit(app: &AppHandle) {
    let _ = app.emit_to("widget", "sakura://quit", ());
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(QUIT_GRACE);
        app.exit(0);
    });
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Appelé par le widget à chaque seconde où l'affichage change.
#[tauri::command]
pub fn tray_update(
    app: AppHandle,
    state: State<'_, TrayState>,
    title: String,
    toggle_label: String,
    running: bool,
) -> Result<(), String> {
    let title = if title.is_empty() { None } else { Some(title) };
    state.tray.set_title(title).map_err(|e| e.to_string())?;
    state
        .toggle
        .set_text(toggle_label)
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    {
        let _ = app.run_on_main_thread(move || crate::macos::keep_timer_awake(running));
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, running);
    Ok(())
}
