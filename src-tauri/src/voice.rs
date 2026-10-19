//! Voix de macOS pour Rai (D-044, D-047) : la commande `say`, une voix par langue. Sert quand
//! aucun clip enregistré n'existe pour la réplique. Une nouvelle réplique coupe la précédente.

use std::process::{Child, Command};
use std::sync::Mutex;

#[derive(serde::Deserialize, Clone)]
pub struct Part {
    pub text: String,
    /// "ja", "es", "ru", "fr" ou "en".
    pub lang: String,
}

/// Voix installées : (nom, locale), lues une fois via `say -v '?'`.
static VOICES: Mutex<Option<Vec<(String, String)>>> = Mutex::new(None);
static CURRENT: Mutex<Option<Child>> = Mutex::new(None);
static SEQ: Mutex<u64> = Mutex::new(0);

/// Une ligne de `say -v '?'` : `Kyoko               ja_JP    # こんにちは…`.
pub fn parse_voice(line: &str) -> Option<(String, String)> {
    let head = line.split('#').next()?.trim_end();
    let (name, locale) = head.rsplit_once(char::is_whitespace)?;
    let locale = locale.trim();
    let ok = locale.len() >= 5 && locale.as_bytes()[2] == b'_';
    ok.then(|| (name.trim().to_string(), locale.to_string()))
}

/// Voix préférées par langue (les plus naturelles d'abord), sinon la première de la langue.
pub fn pick_voice(voices: &[(String, String)], lang: &str) -> Option<String> {
    let preferred: &[&str] = match lang {
        "ja" => &[
            "Kyoko (Enhanced)",
            "Kyoko",
            "Otoya (Enhanced)",
            "Otoya",
            "Hattori",
            "O-Ren",
        ],
        "fr" => &[
            "Thomas (Enhanced)",
            "Thomas",
            "Amélie (Enhanced)",
            "Audrey (Enhanced)",
            "Amélie",
            "Audrey",
        ],
        "es" => &[
            "Jorge (Enhanced)",
            "Jorge",
            "Mónica (Enhanced)",
            "Mónica",
            "Paulina",
        ],
        "ru" => &[
            "Yuri (Enhanced)",
            "Yuri",
            "Milena (Enhanced)",
            "Milena",
            "Katya",
        ],
        _ => &[
            "Samantha (Enhanced)",
            "Daniel (Enhanced)",
            "Samantha",
            "Daniel",
            "Alex",
        ],
    };
    for p in preferred {
        if voices.iter().any(|(n, _)| n == p) {
            return Some((*p).to_string());
        }
    }
    let region = match lang {
        "ja" => "ja_JP",
        "fr" => "fr_FR",
        "es" => "es_ES",
        "ru" => "ru_RU",
        _ => "en_US",
    };
    voices
        .iter()
        .find(|(_, l)| l == region)
        .or_else(|| voices.iter().find(|(_, l)| l.starts_with(lang)))
        .map(|(n, _)| n.clone())
}

fn installed() -> Vec<(String, String)> {
    let mut cache = VOICES.lock().unwrap_or_else(|e| e.into_inner());
    if cache.is_none() {
        let list = Command::new("say")
            .args(["-v", "?"])
            .output()
            .map(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .filter_map(parse_voice)
                    .collect()
            })
            .unwrap_or_default();
        *cache = Some(list);
    }
    cache.clone().unwrap_or_default()
}

fn stop_current() {
    if let Ok(mut c) = CURRENT.lock() {
        if let Some(mut child) = c.take() {
            let _ = child.kill();
        }
    }
}

/// Dit les parties à la suite ; `volume` de 0 à 1.
#[tauri::command]
pub fn speak(parts: Vec<Part>, volume: f64) {
    stop_current();
    let id = {
        let mut s = SEQ.lock().unwrap_or_else(|e| e.into_inner());
        *s += 1;
        *s
    };
    std::thread::spawn(move || {
        let voices = installed();
        let vol = volume.clamp(0.0, 1.0);
        for p in parts {
            if *SEQ.lock().unwrap_or_else(|e| e.into_inner()) != id {
                return; // une réplique plus récente a pris la parole
            }
            let mut cmd = Command::new("say");
            if let Some(v) = pick_voice(&voices, &p.lang) {
                cmd.args(["-v", &v]);
            }
            cmd.arg(format!("[[volm {vol:.2}]] {}", p.text));
            let Ok(child) = cmd.spawn() else { return };
            let pid = child.id();
            if let Ok(mut c) = CURRENT.lock() {
                *c = Some(child);
            }
            // Attendre la fin de cette partie (ou son interruption).
            loop {
                std::thread::sleep(std::time::Duration::from_millis(80));
                let mut c = CURRENT.lock().unwrap_or_else(|e| e.into_inner());
                match c.as_mut() {
                    Some(ch) if ch.id() == pid => {
                        if !matches!(ch.try_wait(), Ok(None)) {
                            *c = None;
                            break;
                        }
                    }
                    _ => break,
                }
            }
        }
    });
}

#[tauri::command]
pub fn stop_speaking() {
    *SEQ.lock().unwrap_or_else(|e| e.into_inner()) += 1;
    stop_current();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lecture_de_la_liste_des_voix() {
        assert_eq!(
            parse_voice("Kyoko               ja_JP    # こんにちは、私の名前はKyokoです。"),
            Some(("Kyoko".into(), "ja_JP".into()))
        );
        assert_eq!(
            parse_voice("Thomas (Enhanced)   fr_FR    # Bonjour"),
            Some(("Thomas (Enhanced)".into(), "fr_FR".into()))
        );
        assert_eq!(parse_voice("garbage"), None);
    }

    #[test]
    fn choix_de_la_voix() {
        let v = vec![
            ("Amélie".to_string(), "fr_CA".to_string()),
            ("Thomas".to_string(), "fr_FR".to_string()),
            ("Kyoko".to_string(), "ja_JP".to_string()),
            ("Fred".to_string(), "en_US".to_string()),
            ("Paulina".to_string(), "es_MX".to_string()),
            ("Milena".to_string(), "ru_RU".to_string()),
        ];
        assert_eq!(pick_voice(&v, "ja").as_deref(), Some("Kyoko"));
        assert_eq!(pick_voice(&v, "fr").as_deref(), Some("Thomas"));
        assert_eq!(pick_voice(&v, "en").as_deref(), Some("Fred"));
        assert_eq!(pick_voice(&v, "es").as_deref(), Some("Paulina"));
        assert_eq!(pick_voice(&v, "ru").as_deref(), Some("Milena"));
        assert_eq!(pick_voice(&[], "ja"), None);
    }
}
