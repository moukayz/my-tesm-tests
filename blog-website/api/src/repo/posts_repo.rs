use crate::repo::{PostDetailRow, PostSummaryRow, PostsRepo, RepoError};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub struct PgPostsRepo {
    pool: PgPool,
}

impl PgPostsRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PostsRepo for PgPostsRepo {
    async fn insert_post(
        &mut self,
        post_id: Uuid,
        author_id: Uuid,
        title: &str,
        body: &str,
        now: DateTime<Utc>,
    ) -> Result<PostDetailRow, RepoError> {
        let rec = sqlx::query_as::<_, PostDetailRow>(
            r#"WITH ins AS (
                 INSERT INTO posts (id, author_id, title, body, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $5)
                 RETURNING id, author_id, title, body, created_at, updated_at
               )
               SELECT
                 ins.id,
                 ins.title,
                 ins.body,
                 ins.author_id,
                 u.username as author_username,
                 ins.created_at,
                 ins.updated_at
               FROM ins
               JOIN users u ON u.id = ins.author_id"#,
        )
        .bind(post_id)
        .bind(author_id)
        .bind(title)
        .bind(body)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(rec)
    }

    async fn get_post_detail(&mut self, post_id: Uuid) -> Result<Option<PostDetailRow>, RepoError> {
        let rec = sqlx::query_as::<_, PostDetailRow>(
            r#"SELECT
                 p.id,
                 p.title,
                 p.body,
                 p.author_id,
                 u.username as author_username,
                 p.created_at,
                 p.updated_at
               FROM posts p
               JOIN users u ON u.id = p.author_id
               WHERE p.id = $1"#,
        )
        .bind(post_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(rec)
    }

    async fn list_posts(
        &mut self,
        limit_plus_one: i64,
        cursor: Option<(DateTime<Utc>, Uuid)>,
    ) -> Result<Vec<PostSummaryRow>, RepoError> {
        let rows = if let Some((c_created_at, c_id)) = cursor {
            sqlx::query_as::<_, PostSummaryRow>(
                r#"SELECT
                     p.id,
                     p.title,
                     u.id as author_id,
                     u.username as author_username,
                     p.created_at,
                     p.updated_at
                   FROM posts p
                   JOIN users u ON u.id = p.author_id
                   WHERE (p.created_at < $2) OR (p.created_at = $2 AND p.id < $3)
                   ORDER BY p.created_at DESC, p.id DESC
                   LIMIT $1"#,
            )
            .bind(limit_plus_one)
            .bind(c_created_at)
            .bind(c_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|_| RepoError::Db)?
        } else {
            sqlx::query_as::<_, PostSummaryRow>(
                r#"SELECT
                     p.id,
                     p.title,
                     u.id as author_id,
                     u.username as author_username,
                     p.created_at,
                     p.updated_at
                   FROM posts p
                   JOIN users u ON u.id = p.author_id
                   ORDER BY p.created_at DESC, p.id DESC
                   LIMIT $1"#,
            )
            .bind(limit_plus_one)
            .fetch_all(&self.pool)
            .await
            .map_err(|_| RepoError::Db)?
        };

        Ok(rows)
    }

    async fn get_post_author_id(&mut self, post_id: Uuid) -> Result<Option<Uuid>, RepoError> {
        #[derive(sqlx::FromRow)]
        struct Row {
            author_id: Uuid,
        }
        let rec = sqlx::query_as::<_, Row>(r#"SELECT author_id FROM posts WHERE id = $1"#)
            .bind(post_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|_| RepoError::Db)?;
        Ok(rec.map(|r| r.author_id))
    }

    async fn update_post(
        &mut self,
        post_id: Uuid,
        title: Option<&str>,
        body: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<PostDetailRow, RepoError> {
        let rec = sqlx::query_as::<_, PostDetailRow>(
            r#"WITH upd AS (
                 UPDATE posts
                 SET
                   title = COALESCE($2, title),
                   body = COALESCE($3, body),
                   updated_at = $4
                 WHERE id = $1
                 RETURNING id, author_id, title, body, created_at, updated_at
               )
               SELECT
                 upd.id,
                 upd.title,
                 upd.body,
                 upd.author_id,
                 u.username as author_username,
                 upd.created_at,
                 upd.updated_at
               FROM upd
               JOIN users u ON u.id = upd.author_id"#,
        )
        .bind(post_id)
        .bind(title)
        .bind(body)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => RepoError::NotFound,
            _ => RepoError::Db,
        })?;
        Ok(rec)
    }

    async fn delete_post(&mut self, post_id: Uuid) -> Result<(), RepoError> {
        let res = sqlx::query(r#"DELETE FROM posts WHERE id = $1"#)
            .bind(post_id)
            .execute(&self.pool)
            .await
            .map_err(|_| RepoError::Db)?;
        if res.rows_affected() == 0 {
            return Err(RepoError::NotFound);
        }
        Ok(())
    }
}
