use crate::repo::{RepoError, SessionWithUserRow, SessionsRepo, UserRow};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub struct PgSessionsRepo {
    pool: PgPool,
}

impl PgSessionsRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

pub struct PgSessionsRepoTx<'a, 'c> {
    tx: &'a mut Transaction<'c, Postgres>,
}

impl<'a, 'c> PgSessionsRepoTx<'a, 'c> {
    pub fn new(tx: &'a mut Transaction<'c, Postgres>) -> Self {
        Self { tx }
    }
}

#[async_trait]
impl SessionsRepo for PgSessionsRepo {
    async fn insert_session(
        &mut self,
        session_id: Uuid,
        user_id: Uuid,
        csrf_token: &str,
        expires_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Result<(), RepoError> {
        sqlx::query(
            r#"INSERT INTO sessions (id, user_id, csrf_token, expires_at, last_seen_at)
               VALUES ($1, $2, $3, $4, $5)"#,
        )
        .bind(session_id)
        .bind(user_id)
        .bind(csrf_token)
        .bind(expires_at)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(())
    }

    async fn get_session_with_user(
        &mut self,
        session_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Option<SessionWithUserRow>, RepoError> {
        #[derive(Debug, sqlx::FromRow)]
        struct Row {
            session_id: Uuid,
            csrf_token: String,
            session_created_at: DateTime<Utc>,
            expires_at: DateTime<Utc>,
            user_id: Uuid,
            username: String,
            user_created_at: DateTime<Utc>,
        }

        let rec = sqlx::query_as::<_, Row>(
            r#"SELECT
                 s.id as session_id,
                 s.csrf_token,
                 s.created_at as session_created_at,
                 s.expires_at,
                 u.id as user_id,
                 u.username,
                 u.created_at as user_created_at
               FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.id = $1 AND s.expires_at > $2"#,
        )
        .bind(session_id)
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| RepoError::Db)?;

        Ok(rec.map(|r| SessionWithUserRow {
            session_id: r.session_id,
            csrf_token: r.csrf_token,
            session_created_at: r.session_created_at,
            expires_at: r.expires_at,
            user: UserRow {
                id: r.user_id,
                username: r.username,
                created_at: r.user_created_at,
            },
        }))
    }

    async fn update_session_activity(
        &mut self,
        session_id: Uuid,
        last_seen_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<(), RepoError> {
        sqlx::query(
            r#"UPDATE sessions
               SET last_seen_at = $2, expires_at = $3
               WHERE id = $1"#,
        )
        .bind(session_id)
        .bind(last_seen_at)
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(())
    }

    async fn delete_session(&mut self, session_id: Uuid) -> Result<(), RepoError> {
        sqlx::query(r#"DELETE FROM sessions WHERE id = $1"#)
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|_| RepoError::Db)?;
        Ok(())
    }
}

#[async_trait]
impl<'a, 'c> SessionsRepo for PgSessionsRepoTx<'a, 'c> {
    async fn insert_session(
        &mut self,
        session_id: Uuid,
        user_id: Uuid,
        csrf_token: &str,
        expires_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Result<(), RepoError> {
        sqlx::query(
            r#"INSERT INTO sessions (id, user_id, csrf_token, expires_at, last_seen_at)
               VALUES ($1, $2, $3, $4, $5)"#,
        )
        .bind(session_id)
        .bind(user_id)
        .bind(csrf_token)
        .bind(expires_at)
        .bind(now)
        .execute(&mut **self.tx)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(())
    }

    async fn get_session_with_user(
        &mut self,
        session_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Option<SessionWithUserRow>, RepoError> {
        #[derive(Debug, sqlx::FromRow)]
        struct Row {
            session_id: Uuid,
            csrf_token: String,
            session_created_at: DateTime<Utc>,
            expires_at: DateTime<Utc>,
            user_id: Uuid,
            username: String,
            user_created_at: DateTime<Utc>,
        }

        let rec = sqlx::query_as::<_, Row>(
            r#"SELECT
                 s.id as session_id,
                 s.csrf_token,
                 s.created_at as session_created_at,
                 s.expires_at,
                 u.id as user_id,
                 u.username,
                 u.created_at as user_created_at
               FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.id = $1 AND s.expires_at > $2"#,
        )
        .bind(session_id)
        .bind(now)
        .fetch_optional(&mut **self.tx)
        .await
        .map_err(|_| RepoError::Db)?;

        Ok(rec.map(|r| SessionWithUserRow {
            session_id: r.session_id,
            csrf_token: r.csrf_token,
            session_created_at: r.session_created_at,
            expires_at: r.expires_at,
            user: UserRow {
                id: r.user_id,
                username: r.username,
                created_at: r.user_created_at,
            },
        }))
    }

    async fn update_session_activity(
        &mut self,
        session_id: Uuid,
        last_seen_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<(), RepoError> {
        sqlx::query(
            r#"UPDATE sessions
               SET last_seen_at = $2, expires_at = $3
               WHERE id = $1"#,
        )
        .bind(session_id)
        .bind(last_seen_at)
        .bind(expires_at)
        .execute(&mut **self.tx)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(())
    }

    async fn delete_session(&mut self, session_id: Uuid) -> Result<(), RepoError> {
        sqlx::query(r#"DELETE FROM sessions WHERE id = $1"#)
            .bind(session_id)
            .execute(&mut **self.tx)
            .await
            .map_err(|_| RepoError::Db)?;
        Ok(())
    }
}
