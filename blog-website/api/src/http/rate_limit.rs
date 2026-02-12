use dashmap::DashMap;
use std::time::{Duration, Instant};

#[derive(Debug)]
pub struct RateLimiter {
    limit_per_window: u32,
    window: Duration,
    hits: DashMap<String, Vec<Instant>>,
}

impl RateLimiter {
    pub fn new(limit_per_minute: u32) -> Self {
        Self {
            limit_per_window: limit_per_minute.max(1),
            window: Duration::from_secs(60),
            hits: DashMap::new(),
        }
    }

    pub fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let cutoff = now.checked_sub(self.window).unwrap_or(now);

        let mut entry = self.hits.entry(key.to_string()).or_default();
        entry.retain(|t| *t >= cutoff);
        if entry.len() as u32 >= self.limit_per_window {
            return false;
        }
        entry.push(now);
        true
    }
}
