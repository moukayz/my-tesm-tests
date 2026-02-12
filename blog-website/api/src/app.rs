use crate::config::Config;
use crate::http::routes;
use crate::http::{middleware, rate_limit::RateLimiter};
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cfg: Config,
    pub rate_limiter: Arc<RateLimiter>,
}

impl AppState {
    pub fn new(db: PgPool, cfg: Config) -> Self {
        let rate_limiter = Arc::new(RateLimiter::new(cfg.auth_rate_limit_per_minute));
        Self {
            db,
            cfg,
            rate_limiter,
        }
    }
}

pub fn build_router(state: AppState) -> axum::Router {
    use axum::Router;
    use tower_http::trace::TraceLayer;
    use tracing::Level;

    let trace = TraceLayer::new_for_http().make_span_with(|req: &http::Request<_>| {
        let request_id = req
            .extensions()
            .get::<middleware::request_id::RequestId>()
            .map(|x| x.0.clone())
            .unwrap_or_else(|| "missing".to_string());

        tracing::span!(
            Level::INFO,
            "http",
            request_id = %request_id,
            method = %req.method(),
            uri = %req.uri()
        )
    });

    Router::new()
        .merge(routes::router())
        .with_state(state)
        .layer(trace)
        .layer(axum::extract::DefaultBodyLimit::max(256 * 1024))
        .layer(axum::middleware::from_fn(
            middleware::request_id::request_id_middleware,
        ))
}
