use crate::http::handlers;
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router<crate::app::AppState> {
    Router::new()
        .route("/v1/auth/register", post(handlers::auth::register))
        .route("/v1/auth/login", post(handlers::auth::login))
        .route("/v1/auth/logout", post(handlers::auth::logout))
        .route("/v1/auth/session", get(handlers::auth::session))
        .route("/v1/users/me", get(handlers::users::me))
        .route(
            "/v1/posts",
            get(handlers::posts::list).post(handlers::posts::create),
        )
        .route(
            "/v1/posts/:postId",
            get(handlers::posts::detail)
                .patch(handlers::posts::update)
                .delete(handlers::posts::delete_post),
        )
        .fallback(handlers::fallback::not_found)
}
