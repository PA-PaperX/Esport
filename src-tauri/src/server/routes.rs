// API Route Handlers with async tokio::sync::RwLock
use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;

use super::ServerState;
use crate::state::{LowerThirdSlot, Player};

// ==========================================
// Request Types
// ==========================================

#[derive(Debug, Deserialize)]
pub struct TeamUpdateRequest {
    pub side: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub logo: Option<String>,
    pub score: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct PlayerUpdateRequest {
    pub side: String,
    pub slot: usize,
    pub name: Option<String>,
    pub hero: Option<String>,
    pub lane: Option<String>,
    #[serde(rename = "isCaptain")]
    pub is_captain: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct LinkMatchRequest {
    #[serde(rename = "matchId")]
    pub match_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LowerThirdUpdateRequest {
    pub enabled: Option<bool>,
    pub title: Option<String>,
    pub slots: Option<Vec<LowerThirdSlot>>,
}

#[derive(Debug, Deserialize)]
pub struct BracketCreateRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub bracket_type: Option<String>,
    pub teams: Vec<String>,
    #[serde(rename = "teamData")]
    pub team_data: Option<Vec<Value>>,
}

#[derive(Debug, Deserialize)]
pub struct MatchUpdateRequest {
    #[serde(rename = "matchId")]
    pub match_id: String,
    #[serde(rename = "scoreA")]
    pub score_a: Option<i32>,
    #[serde(rename = "scoreB")]
    pub score_b: Option<i32>,
    pub winner: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MatchWinnerRequest {
    #[serde(rename = "matchId")]
    pub match_id: String,
    pub winner: String,
}

#[derive(Debug, Deserialize)]
pub struct MatchTitleRequest {
    #[serde(rename = "matchId")]
    pub match_id: String,
    #[serde(rename = "roundName")]
    pub round_name: String,
}

#[derive(Debug, Deserialize)]
pub struct TemplateCreateRequest {
    pub name: String,
    pub color: Option<String>,
    pub logo: Option<String>,
    pub players: Option<Vec<Player>>,
}

#[derive(Debug, Deserialize)]
pub struct TemplateApplyRequest {
    #[serde(rename = "templateId")]
    pub template_id: String,
    pub side: String,
}

#[derive(Debug, Deserialize)]
pub struct FontSettingsRequest {
    #[serde(flatten)]
    pub assignments: std::collections::HashMap<String, Option<String>>,
}

// ==========================================
// State Handlers
// ==========================================

pub async fn get_state(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    Json(json!(g.app_state.match_state))
}

pub async fn update_team(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<TeamUpdateRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    let team = match req.side.as_str() {
        "A" => &mut g.app_state.match_state.teams.a,
        "B" => &mut g.app_state.match_state.teams.b,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid side"})),
            )
        }
    };
    if let Some(v) = req.name {
        team.name = v;
    }
    if let Some(v) = req.color {
        team.color = v;
    }
    if let Some(v) = req.logo {
        team.logo = v;
    }
    if let Some(v) = req.score {
        team.score = v;
    }
    g.app_state.save();
    let s = g.app_state.match_state.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "STATE_UPDATE", "data": &s})).unwrap());
    (StatusCode::OK, Json(json!({"success": true, "state": s})))
}

pub async fn update_player(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<PlayerUpdateRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    let team = match req.side.as_str() {
        "A" => &mut g.app_state.match_state.teams.a,
        "B" => &mut g.app_state.match_state.teams.b,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid side"})),
            )
        }
    };
    if let Some(player) = team.players.iter_mut().find(|p| p.slot == req.slot) {
        if let Some(v) = req.name {
            player.name = v;
        }
        if let Some(v) = req.hero {
            player.hero = Some(v);
        }
        if let Some(v) = req.lane {
            player.lane = Some(v);
        }
        if let Some(v) = req.is_captain {
            player.is_captain = v;
        }
    }
    g.app_state.save();
    let s = g.app_state.match_state.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "STATE_UPDATE", "data": s})).unwrap());
    (StatusCode::OK, Json(json!({"success": true})))
}

pub async fn swap_sides(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let mut g = state.write().await;
    g.app_state.match_state.swapped = !g.app_state.match_state.swapped;
    let swapped = g.app_state.match_state.swapped;
    g.app_state.save();
    let s = g.app_state.match_state.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "STATE_UPDATE", "data": s})).unwrap());
    Json(json!({"success": true, "swapped": swapped}))
}

pub async fn link_match(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<LinkMatchRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    g.app_state.match_state.linked_match_id = req.match_id.clone();
    g.app_state.save();
    let s = g.app_state.match_state.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "STATE_UPDATE", "data": s})).unwrap());
    Json(json!({"success": true, "linkedMatchId": req.match_id}))
}

// ==========================================
// Transition Handlers
// ==========================================

pub async fn trigger_transition(
    State(state): State<Arc<RwLock<ServerState>>>,
    body: Option<Json<Value>>,
) -> impl IntoResponse {
    let config = body
        .and_then(|j| j.get("config").cloned())
        .unwrap_or(json!({}));
    let g = state.read().await;
    g.broadcast(
        &serde_json::to_string(&json!({"type": "TRANSITION_TRIGGER", "data": config})).unwrap(),
    );
    log::info!("🎬 Transition triggered");
    Json(json!({"success": true}))
}

pub async fn get_transition_logo() -> impl IntoResponse {
    let exists = std::path::Path::new("public/assets/transition-logo.png").exists();
    Json(json!({"path": if exists { Some("/assets/transition-logo.png") } else { None }}))
}

pub async fn upload_transition_logo(mut multipart: Multipart) -> impl IntoResponse {
    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        if field.name() == Some("logo") {
            let data = field.bytes().await.unwrap_or_default();
            std::fs::create_dir_all("public/assets").ok();
            if std::fs::write("public/assets/transition-logo.png", &data).is_ok() {
                log::info!("✅ Transition logo uploaded");
                return Json(json!({"success": true, "path": "/assets/transition-logo.png"}));
            }
        }
    }
    Json(json!({"success": false, "error": "Upload failed"}))
}

// ==========================================
// Lower Third Handlers
// ==========================================

pub async fn get_lower_third(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    Json(json!(g.app_state.lower_third))
}

pub async fn update_lower_third(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<LowerThirdUpdateRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    if let Some(v) = req.enabled {
        g.app_state.lower_third.enabled = v;
    }
    if let Some(v) = req.title {
        g.app_state.lower_third.title = v;
    }
    if let Some(v) = req.slots {
        g.app_state.lower_third.slots = v;
    }
    g.app_state.save_lower_third();
    let lt = g.app_state.lower_third.clone();
    g.broadcast(
        &serde_json::to_string(&json!({"type": "LOWER_THIRD_UPDATE", "data": &lt})).unwrap(),
    );
    Json(json!({"success": true, "state": lt}))
}

pub async fn upload_slot_logo(
    State(state): State<Arc<RwLock<ServerState>>>,
    Path(id): Path<u32>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        if field.name() == Some("logo") {
            let data = field.bytes().await.unwrap_or_default();
            let path = format!("public/assets/lower-third-slot-{}.png", id);
            std::fs::create_dir_all("public/assets").ok();
            if std::fs::write(&path, &data).is_ok() {
                let logo_path = format!("/assets/lower-third-slot-{}.png", id);
                let mut g = state.write().await;
                if let Some(slot) = g
                    .app_state
                    .lower_third
                    .slots
                    .iter_mut()
                    .find(|s| s.id == id)
                {
                    slot.logo_path = Some(logo_path.clone());
                }
                g.app_state.save_lower_third();
                let lt = g.app_state.lower_third.clone();
                g.broadcast(
                    &serde_json::to_string(&json!({"type": "LOWER_THIRD_UPDATE", "data": lt}))
                        .unwrap(),
                );
                return Json(json!({"success": true, "path": logo_path}));
            }
        }
    }
    Json(json!({"success": false, "error": "Upload failed"}))
}

// ==========================================
// Bracket Handlers
// ==========================================

pub async fn get_bracket(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    Json(json!(g.app_state.bracket))
}

pub async fn create_bracket(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<BracketCreateRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    let b = g
        .app_state
        .create_bracket(
            &req.name,
            req.bracket_type.as_deref().unwrap_or("single"),
            &req.teams,
            req.team_data.as_deref(),
        )
        .clone();
    g.app_state.save_bracket();
    g.broadcast(&serde_json::to_string(&json!({"type": "BRACKET_UPDATE", "data": &b})).unwrap());
    log::info!(
        "🏆 Bracket created: {} with {} teams",
        req.name,
        req.teams.len()
    );
    Json(json!({"success": true, "bracket": b}))
}

pub async fn update_bracket_match(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<MatchUpdateRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    if let Some(b) = &mut g.app_state.bracket {
        if let Some(m) = b.matches.iter_mut().find(|m| m.id == req.match_id) {
            if let Some(v) = req.score_a {
                m.score_a = v;
            }
            if let Some(v) = req.score_b {
                m.score_b = v;
            }
            if let Some(v) = req.winner {
                m.winner = Some(v);
            }
        }
    }
    g.app_state.save_bracket();
    let b = g.app_state.bracket.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "BRACKET_UPDATE", "data": &b})).unwrap());
    log::info!("📊 Match updated: {}", req.match_id);
    Json(json!({"success": true, "bracket": b}))
}

pub async fn set_match_winner(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<MatchWinnerRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    if let Some(b) = &mut g.app_state.bracket {
        if let Some(m) = b.matches.iter_mut().find(|m| m.id == req.match_id) {
            m.winner = Some(req.winner.clone());
        }
    }
    g.app_state.save_bracket();
    let b = g.app_state.bracket.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "BRACKET_UPDATE", "data": &b})).unwrap());
    log::info!("🏆 Winner set: {} -> {}", req.match_id, req.winner);
    Json(json!({"success": true, "bracket": b}))
}

pub async fn update_match_title(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<MatchTitleRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    if let Some(b) = &mut g.app_state.bracket {
        if let Some(m) = b.matches.iter_mut().find(|m| m.id == req.match_id) {
            m.round_name = Some(req.round_name);
        }
    }
    g.app_state.save_bracket();
    Json(json!({"success": true}))
}

pub async fn shuffle_bracket(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    Json(json!({"success": true, "bracket": g.app_state.bracket}))
}

pub async fn reset_bracket(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let mut g = state.write().await;
    g.app_state.bracket = None;
    g.app_state.save_bracket();
    g.broadcast(&serde_json::to_string(&json!({"type": "BRACKET_UPDATE", "data": null})).unwrap());
    log::info!("🗑️ Bracket reset");
    Json(json!({"success": true}))
}

// ==========================================
// Template Handlers
// ==========================================

pub async fn get_templates(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    Json(json!(g.app_state.templates))
}

pub async fn create_template(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<TemplateCreateRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    let t = crate::state::Template {
        id: format!("tpl_{}", chrono::Utc::now().timestamp_millis()),
        name: req.name.clone(),
        color: req.color.unwrap_or_else(|| "#3b82f6".to_string()),
        logo: req.logo.unwrap_or_default(),
        players: req.players.unwrap_or_default(),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: None,
    };
    g.app_state.templates.push(t.clone());
    g.app_state.save_templates();
    let all = g.app_state.templates.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "TEMPLATES_UPDATE", "data": all})).unwrap());
    log::info!("📁 Template created: {}", req.name);
    Json(json!({"success": true, "template": t}))
}

pub async fn update_template(
    State(state): State<Arc<RwLock<ServerState>>>,
    Path(id): Path<String>,
    Json(req): Json<TemplateCreateRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    if let Some(t) = g.app_state.templates.iter_mut().find(|t| t.id == id) {
        t.name = req.name;
        if let Some(v) = req.color {
            t.color = v;
        }
        if let Some(v) = req.logo {
            t.logo = v;
        }
        if let Some(v) = req.players {
            t.players = v;
        }
        t.updated_at = Some(chrono::Utc::now().to_rfc3339());
    }
    g.app_state.save_templates();
    let all = g.app_state.templates.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "TEMPLATES_UPDATE", "data": all})).unwrap());
    Json(json!({"success": true}))
}

pub async fn delete_template(
    State(state): State<Arc<RwLock<ServerState>>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    g.app_state.templates.retain(|t| t.id != id);
    g.app_state.save_templates();
    let all = g.app_state.templates.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "TEMPLATES_UPDATE", "data": all})).unwrap());
    log::info!("🗑️ Template deleted: {}", id);
    Json(json!({"success": true}))
}

pub async fn apply_template(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<TemplateApplyRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    let template = g
        .app_state
        .templates
        .iter()
        .find(|t| t.id == req.template_id)
        .cloned();
    if let Some(t) = template {
        let team = match req.side.as_str() {
            "A" => &mut g.app_state.match_state.teams.a,
            "B" => &mut g.app_state.match_state.teams.b,
            _ => return Json(json!({"success": false, "error": "Invalid side"})),
        };
        team.name = t.name;
        team.color = t.color;
        team.logo = t.logo;
        for tp in t.players {
            if let Some(p) = team.players.iter_mut().find(|p| p.slot == tp.slot) {
                p.name = tp.name;
            }
        }
        g.app_state.save();
        let s = g.app_state.match_state.clone();
        g.broadcast(&serde_json::to_string(&json!({"type": "STATE_UPDATE", "data": s})).unwrap());
        return Json(json!({"success": true}));
    }
    Json(json!({"success": false, "error": "Template not found"}))
}

// ==========================================
// Font Handlers
// ==========================================

pub async fn get_fonts(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    Json(json!(g.app_state.fonts))
}

pub async fn get_fonts_css(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    let mut css = String::new();
    for font in &g.app_state.fonts.fonts {
        css.push_str(&format!(
            "@font-face {{ font-family: '{}'; src: url('{}') format('{}'); font-weight: {}; font-style: {}; font-display: swap; }}\n",
            font.name, font.path, font.format, font.weight, font.style
        ));
    }
    axum::response::Response::builder()
        .header("Content-Type", "text/css")
        .body(css)
        .unwrap()
}

pub async fn upload_font(
    State(state): State<Arc<RwLock<ServerState>>>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut font_name = String::new();
    let mut filename = String::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        if name == "font" {
            filename = field.file_name().unwrap_or("font.ttf").to_string();
            let data = field.bytes().await.unwrap_or_default();
            let safe: String = filename
                .chars()
                .map(|c| {
                    if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                        c
                    } else {
                        '_'
                    }
                })
                .collect();
            std::fs::create_dir_all("public/fonts/custom").ok();
            if std::fs::write(format!("public/fonts/custom/{}", safe), &data).is_err() {
                return Json(json!({"success": false, "error": "Write failed"}));
            }
            filename = safe;
        } else if name == "name" {
            font_name = field.text().await.unwrap_or_default();
        }
    }

    if filename.is_empty() {
        return Json(json!({"success": false, "error": "No font file"}));
    }

    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("ttf")
        .to_lowercase();
    let format = match ext.as_str() {
        "ttf" => "truetype",
        "otf" => "opentype",
        "woff" => "woff",
        "woff2" => "woff2",
        _ => "truetype",
    };

    let mut g = state.write().await;
    let f = crate::state::CustomFont {
        id: format!("font_{}", chrono::Utc::now().timestamp_millis()),
        name: if font_name.is_empty() {
            filename.split('.').next().unwrap_or("Font").to_string()
        } else {
            font_name
        },
        filename: filename.clone(),
        format: format.to_string(),
        path: format!("/fonts/custom/{}", filename),
        weight: "400".to_string(),
        style: "normal".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    g.app_state.fonts.fonts.push(f.clone());
    g.app_state.save_fonts();
    let all = g.app_state.fonts.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "FONT_UPDATE", "data": all})).unwrap());
    log::info!("🔤 Font uploaded: {}", f.name);
    Json(json!({"success": true, "font": f}))
}

pub async fn get_font_settings(State(state): State<Arc<RwLock<ServerState>>>) -> impl IntoResponse {
    let g = state.read().await;
    Json(json!(g.app_state.fonts.assignments))
}

pub async fn update_font_settings(
    State(state): State<Arc<RwLock<ServerState>>>,
    Json(req): Json<FontSettingsRequest>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    for (k, v) in req.assignments {
        match k.as_str() {
            "lowerThirdTitle" => g.app_state.fonts.assignments.lower_third_title = v,
            "lowerThirdSlots" => g.app_state.fonts.assignments.lower_third_slots = v,
            "scoreboardTeamName" => g.app_state.fonts.assignments.scoreboard_team_name = v,
            "scoreboardScore" => g.app_state.fonts.assignments.scoreboard_score = v,
            "versusTeamName" => g.app_state.fonts.assignments.versus_team_name = v,
            "bracketTeamName" => g.app_state.fonts.assignments.bracket_team_name = v,
            "transitionTitle" => g.app_state.fonts.assignments.transition_title = v,
            _ => {}
        }
    }
    g.app_state.save_fonts();
    let all = g.app_state.fonts.clone();
    let a = g.app_state.fonts.assignments.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "FONT_UPDATE", "data": all})).unwrap());
    log::info!("⚙️ Font settings updated");
    Json(json!({"success": true, "assignments": a}))
}

pub async fn update_font(
    State(state): State<Arc<RwLock<ServerState>>>,
    Path(id): Path<String>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    let f = if let Some(fnt) = g.app_state.fonts.fonts.iter_mut().find(|f| f.id == id) {
        if let Some(v) = req.get("name").and_then(|v| v.as_str()) {
            fnt.name = v.to_string();
        }
        if let Some(v) = req.get("weight").and_then(|v| v.as_str()) {
            fnt.weight = v.to_string();
        }
        if let Some(v) = req.get("style").and_then(|v| v.as_str()) {
            fnt.style = v.to_string();
        }
        Some(fnt.clone())
    } else {
        None
    };
    g.app_state.save_fonts();
    let all = g.app_state.fonts.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "FONT_UPDATE", "data": all})).unwrap());
    match f {
        Some(font) => Json(json!({"success": true, "font": font})),
        None => Json(json!({"success": false, "error": "Font not found"})),
    }
}

pub async fn delete_font(
    State(state): State<Arc<RwLock<ServerState>>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let mut g = state.write().await;
    if let Some(pos) = g.app_state.fonts.fonts.iter().position(|f| f.id == id) {
        let font = g.app_state.fonts.fonts.remove(pos);
        std::fs::remove_file(format!("public{}", font.path)).ok();
    }
    g.app_state.save_fonts();
    let all = g.app_state.fonts.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "FONT_UPDATE", "data": all})).unwrap());
    log::info!("🗑️ Font deleted: {}", id);
    Json(json!({"success": true}))
}

// ==========================================
// Logo Upload Handler
// ==========================================

pub async fn upload_logo(
    State(state): State<Arc<RwLock<ServerState>>>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut side = String::new();
    let mut logo_data = Vec::new();
    let mut ext = "png".to_string();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let name = field.name().unwrap_or("").to_string();
        if name == "side" {
            side = field.text().await.unwrap_or_default();
        } else if name == "logo" {
            let filename = field.file_name().unwrap_or("logo.png").to_string();
            ext = std::path::Path::new(&filename)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("png")
                .to_string();
            logo_data = field.bytes().await.unwrap_or_default().to_vec();
        }
    }

    if logo_data.is_empty() || (side != "A" && side != "B") {
        return Json(json!({"success": false, "error": "Invalid request"}));
    }

    let out_filename = format!("team-{}.{}", side.to_lowercase(), ext);
    let path = format!("public/logos/{}", out_filename);
    std::fs::create_dir_all("public/logos").ok();

    if std::fs::write(&path, &logo_data).is_err() {
        return Json(json!({"success": false, "error": "Write failed"}));
    }

    let logo_path = format!("/logos/{}", out_filename);
    let mut g = state.write().await;
    let team = match side.as_str() {
        "A" => &mut g.app_state.match_state.teams.a,
        "B" => &mut g.app_state.match_state.teams.b,
        _ => return Json(json!({"success": false, "error": "Invalid side"})),
    };
    team.logo = logo_path.clone();
    g.app_state.save();
    let s = g.app_state.match_state.clone();
    g.broadcast(&serde_json::to_string(&json!({"type": "STATE_UPDATE", "data": s})).unwrap());
    Json(json!({"success": true, "logoPath": logo_path}))
}
