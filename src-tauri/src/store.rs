//! Accès disque du fichier de données (D-022).
//!
//! La logique (sauvegardes, validation, rechargement) vit côté TypeScript dans
//! `src/storage/dataStore.ts`. Ici, seulement des opérations élémentaires et sûres :
//! l'écriture passe par un fichier temporaire, `fsync`, puis un renommage atomique, pour
//! qu'une fermeture forcée ne laisse jamais un fichier à moitié écrit.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use tauri::Manager;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Chemin absolu obligatoire : l'interface ne doit jamais dépendre du dossier courant.
fn absolute(path: &str) -> CmdResult<PathBuf> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err(format!("chemin relatif refusé : {path}"));
    }
    Ok(p)
}

/// Écriture et suppression limitées aux fichiers `.json` : l'interface n'a besoin de rien d'autre.
fn json_file(path: &str) -> CmdResult<PathBuf> {
    let p = absolute(path)?;
    if p.extension().and_then(|e| e.to_str()) != Some("json") {
        return Err(format!(
            "seuls les fichiers .json sont modifiables : {path}"
        ));
    }
    Ok(p)
}

pub fn read_text(path: &Path) -> std::io::Result<Option<String>> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn write_atomic(path: &Path, contents: &str) -> std::io::Result<()> {
    let dir = path
        .parent()
        .ok_or_else(|| std::io::Error::other("chemin sans dossier parent"))?;
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("data");
    let tmp = dir.join(format!(".{name}.{}.tmp", std::process::id()));
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(contents.as_bytes())?;
        f.sync_all()?;
    }
    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    // Rend le renommage durable ; sans importance si le système ne le permet pas.
    if let Ok(d) = fs::File::open(dir) {
        let _ = d.sync_all();
    }
    Ok(())
}

pub fn list_dir(path: &Path) -> std::io::Result<Vec<String>> {
    match fs::read_dir(path) {
        Ok(rd) => Ok(rd
            .filter_map(|e| e.ok())
            .filter_map(|e| e.file_name().into_string().ok())
            .collect()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(e),
    }
}

pub fn mtime_ms(path: &Path) -> std::io::Result<Option<u64>> {
    match fs::metadata(path) {
        Ok(m) => Ok(Some(
            m.modified()?
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        )),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn fs_read_text(path: String) -> CmdResult<Option<String>> {
    read_text(&absolute(&path)?).map_err(err)
}

#[tauri::command]
pub fn fs_write_atomic(path: String, contents: String) -> CmdResult<()> {
    write_atomic(&json_file(&path)?, &contents).map_err(err)
}

#[tauri::command]
pub fn fs_list_dir(path: String) -> CmdResult<Vec<String>> {
    list_dir(&absolute(&path)?).map_err(err)
}

#[tauri::command]
pub fn fs_remove(path: String) -> CmdResult<()> {
    match fs::remove_file(json_file(&path)?) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(err(e)),
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn fs_mkdirp(path: String) -> CmdResult<()> {
    fs::create_dir_all(absolute(&path)?).map_err(err)
}

#[tauri::command]
pub fn fs_mtime(path: String) -> CmdResult<Option<u64>> {
    mtime_ms(&absolute(&path)?).map_err(err)
}

/// iCloud Drive/Sakura si iCloud Drive est activé, sinon le dossier de données de l'app.
pub fn pick_data_dir(home: &Path, app_data: &Path) -> PathBuf {
    let icloud = home.join("Library/Mobile Documents/com~apple~CloudDocs");
    if icloud.is_dir() {
        icloud.join("Sakura")
    } else {
        app_data.to_path_buf()
    }
}

#[tauri::command]
pub fn default_data_dir(app: tauri::AppHandle) -> CmdResult<String> {
    let paths = app.path();
    let home = paths.home_dir().map_err(err)?;
    let app_data = paths.app_data_dir().map_err(err)?;
    Ok(pick_data_dir(&home, &app_data)
        .to_string_lossy()
        .into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ecriture_atomique_puis_lecture() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("sakura-data.json");
        write_atomic(&f, "{\"a\":1}").unwrap();
        write_atomic(&f, "{\"a\":2}").unwrap();
        assert_eq!(read_text(&f).unwrap().as_deref(), Some("{\"a\":2}"));
        // Aucun fichier temporaire ne traîne.
        assert_eq!(
            list_dir(dir.path()).unwrap(),
            vec!["sakura-data.json".to_string()]
        );
    }

    #[test]
    fn fichier_absent() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("absent.json");
        assert_eq!(read_text(&f).unwrap(), None);
        assert_eq!(mtime_ms(&f).unwrap(), None);
        assert!(list_dir(&dir.path().join("nulle-part")).unwrap().is_empty());
    }

    #[test]
    fn date_de_modification() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("x.json");
        write_atomic(&f, "1").unwrap();
        assert!(mtime_ms(&f).unwrap().unwrap() > 1_700_000_000_000);
    }

    #[test]
    fn garde_fous_des_commandes() {
        assert!(fs_read_text("relatif.json".into()).is_err());
        assert!(fs_write_atomic("/tmp/sakura-test.txt".into(), "x".into()).is_err());
        assert!(fs_remove("/tmp/sakura-test.sh".into()).is_err());
        let dir = tempfile::tempdir().unwrap();
        let ok = dir.path().join("y.json").to_string_lossy().into_owned();
        assert!(fs_write_atomic(ok.clone(), "{}".into()).is_ok());
        assert!(fs_remove(ok.clone()).is_ok());
        assert!(fs_remove(ok).is_ok()); // déjà supprimé : pas une erreur
    }

    #[test]
    fn dossier_par_defaut() {
        let home = tempfile::tempdir().unwrap();
        let app = home.path().join("app");
        assert_eq!(pick_data_dir(home.path(), &app), app);
        let icloud = home
            .path()
            .join("Library/Mobile Documents/com~apple~CloudDocs");
        fs::create_dir_all(&icloud).unwrap();
        assert_eq!(pick_data_dir(home.path(), &app), icloud.join("Sakura"));
    }
}
