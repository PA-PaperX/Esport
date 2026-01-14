// Server module - HTTP + WebSocket server using axum
mod routes;
mod websocket;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

use crate::state::AppState;

/// Shared application state
pub struct ServerState {
    pub app_state: AppState,
    pub broadcast_tx: broadcast::Sender<String>,
}

impl ServerState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            app_state: AppState::load_or_default(),
            broadcast_tx: tx,
        }
    }

    /// Broadcast message to all WebSocket clients
    pub fn broadcast(&self, message: &str) {
        let _ = self.broadcast_tx.send(message.to_string());
    }
}

/// Start the HTTP server
pub async fn start_server() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state = Arc::new(RwLock::new(ServerState::new()));

    // Get the public folder path (relative to exe or project root)
    let public_path = get_public_path();

    // CORS layer - allow all origins for OBS Browser Source
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        // API Routes
        .route("/api/state", get(routes::get_state))
        .route("/api/team/update", post(routes::update_team))
        .route("/api/player/update", post(routes::update_player))
        .route("/api/swap", post(routes::swap_sides))
        .route("/api/match/link", post(routes::link_match))
        // Transition
        .route("/api/transition/trigger", post(routes::trigger_transition))
        .route(
            "/api/transition/logo",
            get(routes::get_transition_logo).post(routes::upload_transition_logo),
        )
        // Lower Third
        .route(
            "/api/lower-third",
            get(routes::get_lower_third).post(routes::update_lower_third),
        )
        .route(
            "/api/lower-third/slot/:id/logo",
            post(routes::upload_slot_logo),
        )
        // Bracket
        .route(
            "/api/bracket",
            get(routes::get_bracket).delete(routes::reset_bracket),
        )
        .route("/api/bracket/create", post(routes::create_bracket))
        .route(
            "/api/bracket/match/update",
            post(routes::update_bracket_match),
        )
        .route("/api/bracket/match/winner", post(routes::set_match_winner))
        .route("/api/bracket/match/title", post(routes::update_match_title))
        .route("/api/bracket/shuffle", post(routes::shuffle_bracket))
        // Templates
        .route(
            "/api/templates",
            get(routes::get_templates).post(routes::create_template),
        )
        .route(
            "/api/templates/:id",
            put(routes::update_template).delete(routes::delete_template),
        )
        .route("/api/templates/apply", post(routes::apply_template))
        // Fonts
        .route("/api/fonts", get(routes::get_fonts))
        .route("/api/fonts/css", get(routes::get_fonts_css))
        .route("/api/fonts/upload", post(routes::upload_font))
        .route(
            "/api/fonts/settings",
            get(routes::get_font_settings).post(routes::update_font_settings),
        )
        .route(
            "/api/fonts/:id",
            put(routes::update_font).delete(routes::delete_font),
        )
        // Logo upload
        .route("/api/logo/upload", post(routes::upload_logo))
        // WebSocket
        .route("/ws", get(websocket::ws_handler))
        // Serve static files from public folder
        .nest_service("/", ServeDir::new(&public_path))
        // Add state and middleware
        .with_state(state)
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("✅ Esport Server running on http://localhost:3000");
    println!("📡 WebSocket ready on ws://localhost:3000/ws");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Get path to public folder
fn get_public_path() -> String {
    // Try multiple locations

    // 1. Check if exe has public folder next to it (production)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let public_in_exe = exe_dir.join("public");
            if public_in_exe.exists() {
                println!("📂 Serving from: {}", public_in_exe.display());
                return public_in_exe.to_string_lossy().to_string();
            }
        }
    }

    // 2. Check current dir (for cargo tauri dev from project root)
    let cwd = std::env::current_dir().unwrap_or_default();
    let public_cwd = cwd.join("public");
    if public_cwd.exists() {
        println!("📂 Serving from: {}", public_cwd.display());
        return public_cwd.to_string_lossy().to_string();
    }

    // 3. Check parent dir (for cargo run from src-tauri)
    let parent_public = cwd.parent().map(|p| p.join("public")).unwrap_or_default();
    if parent_public.exists() {
        println!("📂 Serving from: {}", parent_public.display());
        return parent_public.to_string_lossy().to_string();
    }

    // 4. Try hardcoded path based on typical project structure
    let project_public = std::path::PathBuf::from(r"C:\Users\Administrator\Desktop\Esport\public");
    if project_public.exists() {
        println!("📂 Serving from: {}", project_public.display());
        return project_public.to_string_lossy().to_string();
    }

    // Fallback
    println!("⚠️ Could not find public folder, using relative path");
    "public".to_string()
}
