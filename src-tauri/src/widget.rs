//! Fenêtre widget : ancrage au coin de l'écran, redimensionnement, pluie de pétales (D-026, D-027).

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::time::Duration;

use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Monitor, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

/// Écart entre la fenêtre et le bord de la zone utile de l'écran (hors barre de menu et Dock).
const EDGE_GAP: f64 = 4.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// Position du coin haut-gauche d'une fenêtre `w × h` collée au coin `corner` de `area`.
/// Le coin choisi reste fixe quand la taille change : la fenêtre grandit vers l'intérieur.
pub fn anchored_origin(corner: &str, area: Rect, w: f64, h: f64) -> (f64, f64) {
    let left = area.x + EDGE_GAP;
    let right = area.x + area.w - w - EDGE_GAP;
    let top = area.y + EDGE_GAP;
    let bottom = area.y + area.h - h - EDGE_GAP;
    match corner {
        "top-left" => (left, top),
        "bottom-left" => (left, bottom),
        "bottom-right" => (right, bottom),
        _ => (right, top),
    }
}

fn logical_work_area(m: &Monitor) -> Rect {
    let s = m.scale_factor();
    let wa = m.work_area();
    Rect {
        x: wa.position.x as f64 / s,
        y: wa.position.y as f64 / s,
        w: wa.size.width as f64 / s,
        h: wa.size.height as f64 / s,
    }
}

fn logical_full_area(m: &Monitor) -> Rect {
    let s = m.scale_factor();
    Rect {
        x: m.position().x as f64 / s,
        y: m.position().y as f64 / s,
        w: m.size().width as f64 / s,
        h: m.size().height as f64 / s,
    }
}

fn monitor_of(window: &WebviewWindow) -> Option<Monitor> {
    window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
}

/// Place et dimensionne le widget dans son coin, puis l'affiche.
#[tauri::command]
pub fn widget_layout(
    window: WebviewWindow,
    corner: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let monitor = monitor_of(&window).ok_or("aucun écran détecté")?;
    let (x, y) = anchored_origin(&corner, logical_work_area(&monitor), width, height);
    // Position puis taille dans le même tour de boucle : macOS les affiche ensemble.
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    if !window.is_visible().unwrap_or(true) {
        window.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// La vue complète n'existe que lorsqu'elle est ouverte : fermée, elle libère son processus web
/// (~100 Mo, D-036). L'état vit dans le widget, rien n'est perdu.
#[tauri::command]
pub fn show_main(app: AppHandle) -> Result<(), String> {
    let w = match app.get_webview_window("main") {
        Some(w) => w,
        None => WebviewWindowBuilder::new(&app, "main", WebviewUrl::App("index.html".into()))
            .title("Sakura")
            .inner_size(960.0, 680.0)
            .min_inner_size(720.0, 520.0)
            .center()
            .disable_drag_drop_handler()
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?,
    };
    w.unminimize().ok();
    w.show().map_err(|e| e.to_string())?;
    w.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_main(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window("main") {
        Some(w) => w.close().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

static QUITTING: AtomicBool = AtomicBool::new(false);
pub fn quitting() -> bool {
    QUITTING.load(Ordering::Relaxed)
}
pub fn set_quitting() {
    QUITTING.store(true, Ordering::Relaxed);
}

static RAIN_SEQ: AtomicU32 = AtomicU32::new(0);
const RAIN_LIFETIME: Duration = Duration::from_millis(5_500);

/// Pluie de pétales hors du widget (paliers 3 et 4, D-027) : une fenêtre transparente qui couvre
/// l'écran du widget, laisse passer les clics, ne prend pas le focus et se ferme seule.
#[tauri::command]
pub fn petal_rain(app: AppHandle, mode: String) -> Result<(), String> {
    let widget = app.get_webview_window("widget").ok_or("widget absent")?;
    let monitor = monitor_of(&widget).ok_or("aucun écran détecté")?;
    let screen = logical_full_area(&monitor);
    let s = monitor.scale_factor();
    let wp = widget.outer_position().map_err(|e| e.to_string())?;
    let ws = widget.outer_size().map_err(|e| e.to_string())?;
    // Rectangle du widget relatif à la fenêtre de pluie, transmis par l'URL : la page n'a rien
    // à demander au démarrage.
    let rx = wp.x as f64 / s - screen.x;
    let ry = wp.y as f64 / s - screen.y;
    let mode = if mode == "screen" { "screen" } else { "around" };
    let url = format!(
        "index.html#rain={mode}&x={rx:.0}&y={ry:.0}&w={:.0}&h={:.0}",
        ws.width as f64 / s,
        ws.height as f64 / s
    );
    let label = format!("petals-{}", RAIN_SEQ.fetch_add(1, Ordering::Relaxed));
    let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .resizable(false)
        .visible_on_all_workspaces(true)
        .position(screen.x, screen.y)
        .inner_size(screen.w, screen.h)
        .build()
        .map_err(|e| e.to_string())?;
    win.set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    crate::macos::float_everywhere(&win);
    std::thread::spawn(move || {
        std::thread::sleep(RAIN_LIFETIME);
        let _ = win.close();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Rect = Rect {
        x: 0.0,
        y: 25.0,
        w: 1440.0,
        h: 875.0,
    };

    #[test]
    fn ancrage_aux_quatre_coins() {
        assert_eq!(
            anchored_origin("top-right", AREA, 260.0, 84.0),
            (1176.0, 29.0)
        );
        assert_eq!(anchored_origin("top-left", AREA, 260.0, 84.0), (4.0, 29.0));
        assert_eq!(
            anchored_origin("bottom-left", AREA, 260.0, 84.0),
            (4.0, 812.0)
        );
        assert_eq!(
            anchored_origin("bottom-right", AREA, 260.0, 84.0),
            (1176.0, 812.0)
        );
    }

    #[test]
    fn le_coin_reste_fixe_quand_le_widget_grandit() {
        let (x1, y1) = anchored_origin("bottom-right", AREA, 260.0, 84.0);
        let (x2, y2) = anchored_origin("bottom-right", AREA, 380.0, 540.0);
        assert_eq!(x1 + 260.0, x2 + 380.0);
        assert_eq!(y1 + 84.0, y2 + 540.0);
    }

    #[test]
    fn coin_inconnu_haut_droite_par_defaut() {
        assert_eq!(
            anchored_origin("?", AREA, 10.0, 10.0),
            anchored_origin("top-right", AREA, 10.0, 10.0)
        );
    }

    #[test]
    fn second_ecran_a_gauche() {
        let area = Rect {
            x: -1920.0,
            y: 0.0,
            w: 1920.0,
            h: 1080.0,
        };
        assert_eq!(
            anchored_origin("top-left", area, 100.0, 50.0),
            (-1916.0, 4.0)
        );
    }
}
