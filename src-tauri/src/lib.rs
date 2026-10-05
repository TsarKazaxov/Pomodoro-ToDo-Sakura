#[cfg(target_os = "macos")]
mod macos;
mod shortcuts;
mod store;
mod tray;
mod widget;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "notifications")]
    let builder = builder.plugin(tauri_plugin_notification::init());
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(shortcuts::plugin())
        .invoke_handler(tauri::generate_handler![
            store::fs_read_text,
            store::fs_write_atomic,
            store::fs_list_dir,
            store::fs_remove,
            store::fs_mkdirp,
            store::fs_mtime,
            store::default_data_dir,
            store::app_config_dir,
            widget::widget_layout,
            widget::show_main,
            widget::hide_main,
            widget::petal_rain,
            tray::tray_update,
            tray::quit_app,
        ])
        .setup(|app| {
            // Mode accessoire : pas d'icône dans le Dock, l'app vit dans la barre de menu.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            if let Some(w) = app.get_webview_window("widget") {
                let _ = w.set_always_on_top(true);
                #[cfg(target_os = "macos")]
                macos::float_everywhere(&w);
            }
            tray::create(app.handle())?;
            shortcuts::register_all(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("échec du lancement de Sakura")
        .run(|app, event| {
            // ⌘Q depuis la vue complète : on passe par le même chemin que « Quitter ».
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() && !widget::quitting() {
                    api.prevent_exit();
                    widget::set_quitting();
                    tray::request_quit(app);
                }
            }
        });
}
