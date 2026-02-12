use crate::app::AppState;
use crate::error::ApiError;
use crate::http::middleware::request_id;
use crate::http::types::UserDto;
use crate::repo::sessions_repo::PgSessionsRepo;
use crate::repo::SessionsRepo;
use axum::async_trait;
use axum::extract::FromRequestParts;
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub const SESSION_COOKIE: &str = "bw_session";

#[derive(Clone, Debug)]
pub struct SessionContext {
    pub session_id: Uuid,
    pub csrf_token: String,
    pub user: UserDto,
    pub session_created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

pub struct OptionalSession(pub Option<SessionContext>);
pub struct RequireSession(pub SessionContext);

#[async_trait]
impl FromRequestParts<AppState> for OptionalSession {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let request_id = request_id::get_request_id(parts);
        let jar = CookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| ApiError::internal(request_id.clone()))?;

        let Some(cookie) = jar.get(SESSION_COOKIE) else {
            return Ok(Self(None));
        };

        let Ok(session_id) = Uuid::parse_str(cookie.value()) else {
            return Ok(Self(None));
        };

        let now = Utc::now();
        let mut sessions = PgSessionsRepo::new(state.db.clone());
        let Some(row) = sessions
            .get_session_with_user(session_id, now)
            .await
            .map_err(|_| ApiError::internal(request_id.clone()))?
        else {
            return Ok(Self(None));
        };

        // Update last_seen_at and extend expiry within policy.
        let abs = chrono::Duration::from_std(state.cfg.session_absolute_ttl)
            .unwrap_or_else(|_| chrono::Duration::days(7));
        let idle = chrono::Duration::from_std(state.cfg.session_idle_ttl)
            .unwrap_or_else(|_| chrono::Duration::days(1));

        let absolute_cap = row.session_created_at + abs;
        let idle_target = now + idle;
        let new_expires_at = if idle_target < absolute_cap {
            idle_target
        } else {
            absolute_cap
        };
        let final_expires = if new_expires_at > row.expires_at {
            new_expires_at
        } else {
            row.expires_at
        };

        let _ = sessions
            .update_session_activity(session_id, now, final_expires)
            .await;

        Ok(Self(Some(SessionContext {
            session_id: row.session_id,
            csrf_token: row.csrf_token,
            user: UserDto {
                id: row.user.id,
                username: row.user.username,
                created_at: row.user.created_at,
            },
            session_created_at: row.session_created_at,
            expires_at: final_expires,
        })))
    }
}

#[async_trait]
impl FromRequestParts<AppState> for RequireSession {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let request_id = request_id::get_request_id(parts);
        let OptionalSession(opt) = OptionalSession::from_request_parts(parts, state).await?;
        match opt {
            Some(ctx) => Ok(Self(ctx)),
            None => Err(ApiError::unauthenticated(request_id)),
        }
    }
}
