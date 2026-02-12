use crate::repo::{RepoError, UserRow, UserWithPasswordRow, UsersRepo};
use async_trait::async_trait;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub struct PgUsersRepo {
    pool: PgPool,
}

impl PgUsersRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

pub struct PgUsersRepoTx<'a, 'c> {
    tx: &'a mut Transaction<'c, Postgres>,
}

impl<'a, 'c> PgUsersRepoTx<'a, 'c> {
    pub fn new(tx: &'a mut Transaction<'c, Postgres>) -> Self {
        Self { tx }
    }
}

fn map_db_error(e: sqlx::Error) -> RepoError {
    if let sqlx::Error::Database(db_err) = &e {
        if db_err.code().as_deref() == Some("23505") {
            return RepoError::Conflict;
        }
    }
    RepoError::Db
}

#[async_trait]
impl UsersRepo for PgUsersRepo {
    async fn insert_user(
        &mut self,
        username: &str,
        password_hash: &str,
    ) -> Result<UserRow, RepoError> {
        let id = Uuid::new_v4();
        let rec = sqlx::query_as::<_, UserRow>(
            r#"INSERT INTO users (id, username, password_hash)
               VALUES ($1, $2, $3)
               RETURNING id, username, created_at"#,
        )
        .bind(id)
        .bind(username)
        .bind(password_hash)
        .fetch_one(&self.pool)
        .await
        .map_err(map_db_error)?;

        Ok(rec)
    }

    async fn get_user_by_username(
        &mut self,
        username: &str,
    ) -> Result<Option<UserWithPasswordRow>, RepoError> {
        let rec = sqlx::query_as::<_, UserWithPasswordRow>(
            r#"SELECT id, username, password_hash, created_at
               FROM users
               WHERE username = $1"#,
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| RepoError::Db)?;

        Ok(rec)
    }

    async fn get_user_by_id(&mut self, id: Uuid) -> Result<Option<UserRow>, RepoError> {
        let rec = sqlx::query_as::<_, UserRow>(
            r#"SELECT id, username, created_at
               FROM users
               WHERE id = $1"#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(rec)
    }
}

#[async_trait]
impl<'a, 'c> UsersRepo for PgUsersRepoTx<'a, 'c> {
    async fn insert_user(
        &mut self,
        username: &str,
        password_hash: &str,
    ) -> Result<UserRow, RepoError> {
        let id = Uuid::new_v4();
        let rec = sqlx::query_as::<_, UserRow>(
            r#"INSERT INTO users (id, username, password_hash)
               VALUES ($1, $2, $3)
               RETURNING id, username, created_at"#,
        )
        .bind(id)
        .bind(username)
        .bind(password_hash)
        .fetch_one(&mut **self.tx)
        .await
        .map_err(map_db_error)?;

        Ok(rec)
    }

    async fn get_user_by_username(
        &mut self,
        username: &str,
    ) -> Result<Option<UserWithPasswordRow>, RepoError> {
        let rec = sqlx::query_as::<_, UserWithPasswordRow>(
            r#"SELECT id, username, password_hash, created_at
               FROM users
               WHERE username = $1"#,
        )
        .bind(username)
        .fetch_optional(&mut **self.tx)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(rec)
    }

    async fn get_user_by_id(&mut self, id: Uuid) -> Result<Option<UserRow>, RepoError> {
        let rec = sqlx::query_as::<_, UserRow>(
            r#"SELECT id, username, created_at
               FROM users
               WHERE id = $1"#,
        )
        .bind(id)
        .fetch_optional(&mut **self.tx)
        .await
        .map_err(|_| RepoError::Db)?;
        Ok(rec)
    }
}
