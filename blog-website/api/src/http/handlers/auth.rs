use crate::app::AppState;
use crate::domain::auth::service as auth;
use crate::error::ApiError;
use crate::http::csrf;
use crate::http::extract::{AppJson, ClientIp, ReqId};
use crate::http::session::{OptionalSession, SESSION_COOKIE};
use crate::http::types::{AuthResponse, LoginRequest, RegisterRequest, SessionResponse, UserDto};
use crate::repo::sessions_repo::PgSessionsRepo;
use crate::repo::users_repo::PgUsersRepo;
use crate::repo::SessionsRepo;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use axum_extra::extract::cookie::CookieJar;
use chrono::Utc;
use cookie::{Cookie, SameSite};

fn build_session_cookie(
    cfg: &crate::config::Config,
    session_id: uuid::Uuid,
    max_age_seconds: i64,
) -> Cookie<'static> {
    Cookie::build((SESSION_COOKIE, session_id.to_string()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(cfg.session_cookie_secure)
        .path("/")
        .max_age(cookie::time::Duration::seconds(max_age_seconds.max(0)))
        .build()
}

fn clear_session_cookie(cfg: &crate::config::Config) -> Cookie<'static> {
    Cookie::build((SESSION_COOKIE, ""))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(cfg.session_cookie_secure)
        .path("/")
        .max_age(cookie::time::Duration::seconds(0))
        .build()
}

pub async fn register(
    ReqId(request_id): ReqId,
    ClientIp(ip): ClientIp,
    State(state): State<AppState>,
    jar: CookieJar,
    AppJson(req): AppJson<RegisterRequest>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.rate_limiter.check(&format!("register:{}", ip)) {
        return Err(ApiError::rate_limited(request_id));
    }

    let now = Utc::now();
    let ttl = state.cfg.session_absolute_ttl.as_secs() as i64;

    let mut users = PgUsersRepo::new(state.db.clone());
    let mut sessions = PgSessionsRepo::new(state.db.clone());

    let (user, session_id, _csrf, expires_at) = auth::register(
        &mut users,
        &mut sessions,
        now,
        ttl,
        req.username.as_deref().unwrap_or(""),
        req.password.as_deref().unwrap_or(""),
    )
    .await
    .map_err(|e| match e {
        auth::AuthError::Validation(fe) => {
            ApiError::validation(request_id.clone(), "Validation error", fe.into_json_map())
        }
        auth::AuthError::Conflict => {
            ApiError::conflict(request_id.clone(), "Username already taken")
        }
        _ => ApiError::internal(request_id.clone()),
    })?;

    let max_age = (expires_at - now).num_seconds();
    let jar = jar.add(build_session_cookie(&state.cfg, session_id, max_age));

    let user = UserDto {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
    };

    Ok((StatusCode::CREATED, jar, Json(AuthResponse { user })))
}

pub async fn login(
    ReqId(request_id): ReqId,
    ClientIp(ip): ClientIp,
    State(state): State<AppState>,
    jar: CookieJar,
    AppJson(req): AppJson<LoginRequest>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.rate_limiter.check(&format!("login:{}", ip)) {
        return Err(ApiError::rate_limited(request_id));
    }

    let now = Utc::now();
    let ttl = state.cfg.session_absolute_ttl.as_secs() as i64;

    let mut users = PgUsersRepo::new(state.db.clone());
    let mut sessions = PgSessionsRepo::new(state.db.clone());

    let (user, session_id, _csrf, expires_at) = auth::login(
        &mut users,
        &mut sessions,
        now,
        ttl,
        req.username.as_deref().unwrap_or(""),
        req.password.as_deref().unwrap_or(""),
    )
    .await
    .map_err(|e| match e {
        auth::AuthError::Validation(fe) => {
            ApiError::validation(request_id.clone(), "Validation error", fe.into_json_map())
        }
        auth::AuthError::InvalidCredentials => ApiError::invalid_credentials(request_id.clone()),
        _ => ApiError::internal(request_id.clone()),
    })?;

    let max_age = (expires_at - now).num_seconds();
    let jar = jar.add(build_session_cookie(&state.cfg, session_id, max_age));

    let user = UserDto {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
    };

    Ok((StatusCode::OK, jar, Json(AuthResponse { user })))
}

pub async fn logout(
    ReqId(request_id): ReqId,
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    OptionalSession(session): OptionalSession,
) -> Response {
    let Some(ctx) = session else {
        let jar = jar.add(clear_session_cookie(&state.cfg));
        return (jar, ApiError::unauthenticated(request_id)).into_response();
    };

    if let Err(e) = csrf::require_csrf(request_id.clone(), &headers, &ctx.csrf_token) {
        return e.into_response();
    }

    let mut sessions = PgSessionsRepo::new(state.db.clone());
    let _ = sessions.delete_session(ctx.session_id).await;
    let jar = jar.add(clear_session_cookie(&state.cfg));
    (jar, StatusCode::NO_CONTENT).into_response()
}

pub async fn session(
    State(_state): State<AppState>,
    OptionalSession(session): OptionalSession,
) -> impl IntoResponse {
    if let Some(ctx) = session {
        Json(SessionResponse::authenticated(ctx.user, ctx.csrf_token))
    } else {
        Json(SessionResponse::unauthenticated())
    }
}
