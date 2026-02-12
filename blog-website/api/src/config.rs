use std::time::Duration;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub api_bind: String,
    pub session_cookie_secure: bool,
    pub session_absolute_ttl: Duration,
    pub session_idle_ttl: Duration,
    pub cursor_hmac_secret: String,
    pub auth_rate_limit_per_minute: u32,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL is required"))?;

        // Do not hard-code a localhost bind by default; keep it env-driven.
        let api_bind = std::env::var("API_BIND").unwrap_or_else(|_| "0.0.0.0:3000".to_string());
        let session_cookie_secure = env_bool("SESSION_COOKIE_SECURE", false);

        let session_absolute_ttl =
            Duration::from_secs(env_u64("SESSION_ABSOLUTE_TTL_SECONDS", 604800));
        let session_idle_ttl = Duration::from_secs(env_u64("SESSION_IDLE_TTL_SECONDS", 86400));

        let cursor_hmac_secret = std::env::var("CURSOR_HMAC_SECRET").unwrap_or_else(|_| {
            // Safe default for local dev; production must override.
            "dev-insecure-change-me".to_string()
        });

        let auth_rate_limit_per_minute = env_u32("AUTH_RATE_LIMIT_PER_MINUTE", 20);

        Ok(Self {
            database_url,
            api_bind,
            session_cookie_secure,
            session_absolute_ttl,
            session_idle_ttl,
            cursor_hmac_secret,
            auth_rate_limit_per_minute,
        })
    }
}

fn env_bool(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(v) => matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"),
        Err(_) => default,
    }
}

fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(default)
}

fn env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(default)
}
