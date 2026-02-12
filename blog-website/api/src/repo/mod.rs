pub mod posts_repo;
pub mod sessions_repo;
pub mod users_repo;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("conflict")]
    Conflict,
    #[error("not found")]
    NotFound,
    #[error("db error")]
    Db,
    #[error("internal")]
    Internal,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserWithPasswordRow {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct SessionWithUserRow {
    pub session_id: Uuid,
    pub csrf_token: String,
    pub session_created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub user: UserRow,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PostSummaryRow {
    pub id: Uuid,
    pub title: String,
    pub author_id: Uuid,
    pub author_username: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PostDetailRow {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub author_id: Uuid,
    pub author_username: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[async_trait]
pub trait UsersRepo: Send + Sync {
    async fn insert_user(
        &mut self,
        username: &str,
        password_hash: &str,
    ) -> Result<UserRow, RepoError>;
    async fn get_user_by_username(
        &mut self,
        username: &str,
    ) -> Result<Option<UserWithPasswordRow>, RepoError>;
    async fn get_user_by_id(&mut self, id: Uuid) -> Result<Option<UserRow>, RepoError>;
}

#[async_trait]
pub trait SessionsRepo: Send + Sync {
    async fn insert_session(
        &mut self,
        session_id: Uuid,
        user_id: Uuid,
        csrf_token: &str,
        expires_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Result<(), RepoError>;

    async fn get_session_with_user(
        &mut self,
        session_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Option<SessionWithUserRow>, RepoError>;
    async fn update_session_activity(
        &mut self,
        session_id: Uuid,
        last_seen_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    ) -> Result<(), RepoError>;
    async fn delete_session(&mut self, session_id: Uuid) -> Result<(), RepoError>;
}

#[async_trait]
pub trait PostsRepo: Send + Sync {
    async fn insert_post(
        &mut self,
        post_id: Uuid,
        author_id: Uuid,
        title: &str,
        body: &str,
        now: DateTime<Utc>,
    ) -> Result<PostDetailRow, RepoError>;

    async fn get_post_detail(&mut self, post_id: Uuid) -> Result<Option<PostDetailRow>, RepoError>;
    async fn list_posts(
        &mut self,
        limit_plus_one: i64,
        cursor: Option<(DateTime<Utc>, Uuid)>,
    ) -> Result<Vec<PostSummaryRow>, RepoError>;

    async fn get_post_author_id(&mut self, post_id: Uuid) -> Result<Option<Uuid>, RepoError>;
    async fn update_post(
        &mut self,
        post_id: Uuid,
        title: Option<&str>,
        body: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<PostDetailRow, RepoError>;
    async fn delete_post(&mut self, post_id: Uuid) -> Result<(), RepoError>;
}
