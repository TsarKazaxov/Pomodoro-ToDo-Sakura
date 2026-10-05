mod store;
mod widget;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            store::fs_read_text,
            store::fs_write_atomic,
            store::fs_list_dir,
            store::fs_remove,
            store::fs_mkdirp,
            store::fs_mtime,
            store::default_data_dir,
            widget::widget_layout,
            widget::show_main,
            widget::petal_rain,
        ])
        .on_window_event(|window, event| {
            // Fermer la vue complète la cache : le widget, propriétaire des données, continue.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            // Le widget n'apparaît qu'une fois placé dans son coin par l'interface.
            if let Some(w) = app.get_webview_window("widget") {
                let _ = w.set_always_on_top(true);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("échec du lancement de Sakura");
}
