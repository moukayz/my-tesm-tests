use blog_website_api::config::Config;
use blog_website_api::db::create_pool;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_target(false)
        .compact()
        .init();

    let cfg = Config::from_env()?;
    let pool = create_pool(&cfg.database_url).await?;
    blog_website_api::db::migrate(&pool).await?;

    let state = blog_website_api::app::AppState::new(pool, cfg.clone());
    let router = blog_website_api::app::build_router(state);

    let listener = tokio::net::TcpListener::bind(&cfg.api_bind).await?;
    tracing::info!(bind = %cfg.api_bind, "api listening");

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;

    Ok(())
}
