use crate::app::AppState;
use crate::http::session::RequireSession;
use crate::http::types::MeResponse;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;

pub async fn me(
    State(_state): State<AppState>,
    RequireSession(session): RequireSession,
) -> impl IntoResponse {
    Json(MeResponse { user: session.user })
}
