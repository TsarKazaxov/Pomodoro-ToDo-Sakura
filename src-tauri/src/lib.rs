mod store;

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
        ])
        .run(tauri::generate_context!())
        .expect("échec du lancement de Sakura");
}
