//! Fenêtre widget : ancrage au coin de l'écran, redimensionnement, pluie de pétales (D-026, D-027).

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;
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

/// Les huit positions du widget (D-041) : quatre coins et le milieu de chaque bord.
pub const ANCHORS: [&str; 8] = [
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
];

/// Position du coin haut-gauche d'une fenêtre `w × h` ancrée en `anchor` dans `area`.
/// Le point d'ancrage reste fixe quand la taille change : la fenêtre grandit vers l'intérieur,
/// ou des deux côtés quand elle est centrée sur un bord. Valeur inconnue : en haut à droite.
pub fn anchored_origin(anchor: &str, area: Rect, w: f64, h: f64) -> (f64, f64) {
    let (v, hz) = match anchor.split_once('-') {
        Some(pair) if ANCHORS.contains(&anchor) => pair,
        _ => ("top", "right"),
    };
    let x = match hz {
        "left" => area.x + EDGE_GAP,
        "center" => area.x + (area.w - w) / 2.0,
        _ => area.x + area.w - w - EDGE_GAP,
    };
    let y = match v {
        "middle" => area.y + (area.h - h) / 2.0,
        "bottom" => area.y + area.h - h - EDGE_GAP,
        _ => area.y + EDGE_GAP,
    };
    (x, y)
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

/// Position la plus proche du point (centre du widget lâché) : l'écran est découpé en tiers.
/// Lâché en plein centre, le widget rejoint le bord le plus proche.
pub fn nearest_anchor(center: (f64, f64), area: Rect) -> &'static str {
    let fx = (center.0 - area.x) / area.w;
    let fy = (center.1 - area.y) / area.h;
    let col = if fx < 1.0 / 3.0 {
        0
    } else if fx < 2.0 / 3.0 {
        1
    } else {
        2
    };
    let row = if fy < 1.0 / 3.0 {
        0
    } else if fy < 2.0 / 3.0 {
        1
    } else {
        2
    };
    if (row, col) == (1, 1) {
        // Distance en points à chaque bord.
        let d = [
            (center.0 - area.x, "middle-left"),
            (area.x + area.w - center.0, "middle-right"),
            (center.1 - area.y, "top-center"),
            (area.y + area.h - center.1, "bottom-center"),
        ];
        return d
            .iter()
            .min_by(|a, b| a.0.total_cmp(&b.0))
            .map_or("top-center", |p| p.1);
    }
    let grid = [
        ["top-left", "top-center", "top-right"],
        ["middle-left", "", "middle-right"],
        ["bottom-left", "bottom-center", "bottom-right"],
    ];
    grid[row][col]
}

/// Bouton gauche de la souris enfoncé (fin d'un glisser ou d'un clic, D-041).
#[tauri::command]
pub fn mouse_pressed() -> bool {
    #[cfg(target_os = "macos")]
    {
        objc2_app_kit::NSEvent::pressedMouseButtons() & 1 == 1
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snap {
    corner: &'static str,
    /// Lâché sur un autre écran que celui de départ.
    moved_screen: bool,
}

/// Écran du widget avant le glisser (position physique du coin haut-gauche de l'écran).
static DRAG_FROM: Mutex<Option<(i32, i32)>> = Mutex::new(None);

/// Début d'un glisser : mémorise l'écran de départ (D-040).
#[tauri::command]
pub fn widget_drag_start(window: WebviewWindow) {
    let from = monitor_of(&window).map(|m| (m.position().x, m.position().y));
    if let Ok(mut d) = DRAG_FROM.lock() {
        *d = from;
    }
}

/// Fin d'un glisser : aimante le widget à la position la plus proche sur l'écran où il a été lâché.
#[tauri::command]
pub fn widget_snap(window: WebviewWindow) -> Result<Snap, String> {
    let monitor = monitor_of(&window).ok_or("aucun écran détecté")?;
    let area = logical_work_area(&monitor);
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let (w, h) = (size.width as f64 / scale, size.height as f64 / scale);
    let center = (
        pos.x as f64 / scale + w / 2.0,
        pos.y as f64 / scale + h / 2.0,
    );
    let corner = nearest_anchor(center, area);
    let (x, y) = anchored_origin(corner, area, w, h);
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    if let Ok(mut c) = CORNER.lock() {
        *c = corner.to_string();
    }
    let here = (monitor.position().x, monitor.position().y);
    let moved_screen = DRAG_FROM
        .lock()
        .ok()
        .and_then(|mut d| d.take())
        .is_some_and(|from| from != here);
    Ok(Snap {
        corner,
        moved_screen,
    })
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
    if let Ok(mut c) = CORNER.lock() {
        c.clone_from(&corner);
    }
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

// ---------- suivre l'écran du curseur (D-038) ----------

static CORNER: Mutex<String> = Mutex::new(String::new());
static FOLLOW_ENABLED: AtomicBool = AtomicBool::new(true);
const FOLLOW_POLL: Duration = Duration::from_millis(400);
/// Le curseur doit rester sur l'autre écran 3 relevés de suite (≈ 1,2 s) : traverser un écran
/// pour atteindre l'autre ne déplace pas le widget.
pub const FOLLOW_STEPS: u32 = 3;

/// Index de l'écran (rectangles logiques) qui contient le point.
pub fn screen_at(point: (f64, f64), screens: &[Rect]) -> Option<usize> {
    screens.iter().position(|r| {
        point.0 >= r.x && point.0 < r.x + r.w && point.1 >= r.y && point.1 < r.y + r.h
    })
}

/// Hystérésis : propose de changer d'écran seulement après `FOLLOW_STEPS` relevés concordants.
#[derive(Default)]
pub struct Follower {
    pending: Option<usize>,
    count: u32,
}

impl Follower {
    pub fn step(&mut self, current: usize, under_cursor: Option<usize>) -> Option<usize> {
        match under_cursor {
            Some(s) if s != current => {
                if self.pending == Some(s) {
                    self.count += 1;
                } else {
                    self.pending = Some(s);
                    self.count = 1;
                }
                if self.count >= FOLLOW_STEPS {
                    self.pending = None;
                    self.count = 0;
                    return Some(s);
                }
            }
            _ => {
                self.pending = None;
                self.count = 0;
            }
        }
        None
    }
}

#[tauri::command]
pub fn set_follow_screen(enabled: bool) {
    FOLLOW_ENABLED.store(enabled, Ordering::Relaxed);
}

/// Surveille l'écran du curseur et y déplace le widget, au même coin.
pub fn start_follow(app: AppHandle) {
    std::thread::spawn(move || {
        let mut follower = Follower::default();
        loop {
            std::thread::sleep(FOLLOW_POLL);
            if FOLLOW_ENABLED.load(Ordering::Relaxed) {
                let _ = follow_once(&app, &mut follower);
            }
        }
    });
}

fn follow_once(app: &AppHandle, follower: &mut Follower) -> Option<()> {
    let widget = app.get_webview_window("widget")?;
    if !widget.is_visible().ok()? {
        return None;
    }
    let monitors = app.available_monitors().ok()?;
    if monitors.len() < 2 {
        return None;
    }
    // Position du curseur : en pixels de l'écran principal (tao) → points.
    let primary_scale = app.primary_monitor().ok()??.scale_factor();
    let c = app.cursor_position().ok()?;
    let cursor = (c.x / primary_scale, c.y / primary_scale);
    let screens: Vec<Rect> = monitors.iter().map(logical_full_area).collect();
    let here = widget.current_monitor().ok()??;
    let current = monitors
        .iter()
        .position(|m| m.position() == here.position() && m.size() == here.size())?;
    let target = follower.step(current, screen_at(cursor, &screens))?;
    let size = widget.outer_size().ok()?;
    let scale = widget.scale_factor().ok()?;
    let corner = CORNER.lock().ok()?.clone();
    let (x, y) = anchored_origin(
        &corner,
        logical_work_area(&monitors[target]),
        size.width as f64 / scale,
        size.height as f64 / scale,
    );
    widget.set_position(LogicalPosition::new(x, y)).ok()
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
    fn position_inconnue_haut_droite_par_defaut() {
        for bad in ["?", "middle-center", "top", ""] {
            assert_eq!(
                anchored_origin(bad, AREA, 10.0, 10.0),
                anchored_origin("top-right", AREA, 10.0, 10.0)
            );
        }
    }

    #[test]
    fn ancrage_au_milieu_des_bords() {
        // Centré en haut, juste sous la barre de menu (et la caméra).
        assert_eq!(
            anchored_origin("top-center", AREA, 260.0, 84.0),
            (590.0, 29.0)
        );
        assert_eq!(
            anchored_origin("bottom-center", AREA, 260.0, 84.0),
            (590.0, 812.0)
        );
        assert_eq!(
            anchored_origin("middle-left", AREA, 260.0, 84.0),
            (4.0, 420.5)
        );
        assert_eq!(
            anchored_origin("middle-right", AREA, 260.0, 84.0),
            (1176.0, 420.5)
        );
    }

    #[test]
    fn centre_sur_un_bord_le_widget_grandit_des_deux_cotes() {
        let (x1, y1) = anchored_origin("top-center", AREA, 260.0, 84.0);
        let (x2, y2) = anchored_origin("top-center", AREA, 380.0, 540.0);
        assert_eq!(x1 + 130.0, x2 + 190.0);
        assert_eq!(y1, y2);
        let (_, y3) = anchored_origin("middle-right", AREA, 260.0, 84.0);
        let (_, y4) = anchored_origin("middle-right", AREA, 380.0, 540.0);
        assert_eq!(y3 + 42.0, y4 + 270.0);
    }

    #[test]
    fn aimantation_a_la_position_la_plus_proche() {
        assert_eq!(nearest_anchor((100.0, 100.0), AREA), "top-left");
        assert_eq!(nearest_anchor((700.0, 60.0), AREA), "top-center");
        assert_eq!(nearest_anchor((1400.0, 60.0), AREA), "top-right");
        assert_eq!(nearest_anchor((60.0, 450.0), AREA), "middle-left");
        assert_eq!(nearest_anchor((1380.0, 500.0), AREA), "middle-right");
        assert_eq!(nearest_anchor((80.0, 850.0), AREA), "bottom-left");
        assert_eq!(nearest_anchor((720.0, 880.0), AREA), "bottom-center");
        assert_eq!(nearest_anchor((1300.0, 800.0), AREA), "bottom-right");
    }

    #[test]
    fn lache_en_plein_centre_le_widget_rejoint_le_bord_le_plus_proche() {
        // Zone 1440 × 875 depuis y = 25 : le centre (720, 462,5) est plus près du haut/bas.
        assert_eq!(nearest_anchor((720.0, 400.0), AREA), "top-center");
        assert_eq!(nearest_anchor((720.0, 520.0), AREA), "bottom-center");
        let tall = Rect {
            x: 0.0,
            y: 0.0,
            w: 900.0,
            h: 1600.0,
        };
        assert_eq!(nearest_anchor((350.0, 800.0), tall), "middle-left");
        assert_eq!(nearest_anchor((560.0, 800.0), tall), "middle-right");
    }

    #[test]
    fn ecran_sous_le_curseur() {
        let screens = [
            AREA,
            Rect {
                x: 1440.0,
                y: 0.0,
                w: 1920.0,
                h: 1080.0,
            },
        ];
        assert_eq!(screen_at((100.0, 100.0), &screens), Some(0));
        assert_eq!(screen_at((2000.0, 500.0), &screens), Some(1));
        assert_eq!(screen_at((-5.0, 100.0), &screens), None);
    }

    #[test]
    fn le_widget_change_d_ecran_apres_trois_releves() {
        let mut f = Follower::default();
        assert_eq!(f.step(0, Some(1)), None);
        assert_eq!(f.step(0, Some(1)), None);
        assert_eq!(f.step(0, Some(1)), Some(1));
    }

    #[test]
    fn traverser_un_ecran_ne_deplace_pas_le_widget() {
        let mut f = Follower::default();
        assert_eq!(f.step(0, Some(1)), None);
        assert_eq!(f.step(0, Some(0)), None); // retour : compteur remis à zéro
        assert_eq!(f.step(0, Some(1)), None);
        assert_eq!(f.step(0, Some(1)), None);
        assert_eq!(f.step(0, Some(2)), None); // autre écran : on recommence
        assert_eq!(f.step(0, None), None);
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
