// WebSocket handler for real-time updates
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::RwLock;

use super::ServerState;

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<RwLock<ServerState>>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, state: Arc<RwLock<ServerState>>) {
    let (mut sender, mut receiver) = socket.split();

    // Send initial state
    {
        let state_guard = state.read().await;
        let initial_state = serde_json::json!({
            "type": "STATE_UPDATE",
            "data": state_guard.app_state.match_state
        });
        let _ = sender.send(Message::Text(initial_state.to_string())).await;
    }

    // Subscribe to broadcast channel
    let mut rx = {
        let state_guard = state.read().await;
        state_guard.broadcast_tx.subscribe()
    };

    // Spawn task to forward broadcasts to this WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Receive messages from client (optional, for future use)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(_text) => {
                    // Handle incoming messages if needed
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = &mut send_task => {},
        _ = recv_task => {
            send_task.abort();
        },
    }

    log::info!("🔌 WebSocket client disconnected");
}
