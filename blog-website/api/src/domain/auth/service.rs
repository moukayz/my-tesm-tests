use crate::domain::validation::{
    trim_owned, validate_len, validate_required_nonempty, FieldErrors,
};
use crate::repo::{RepoError, SessionsRepo, UsersRepo};
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use chrono::{DateTime, Utc};
use rand::rngs::OsRng;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug)]
pub enum AuthError {
    Validation(FieldErrors),
    Conflict,
    InvalidCredentials,
    RateLimited,
    Repo(RepoError),
}

pub fn validate_username_password(
    username: &str,
    password: &str,
) -> Result<(String, String), FieldErrors> {
    let mut errors = FieldErrors::default();

    let username = trim_owned(username);
    validate_required_nonempty("username", &username, &mut errors);
    if !username.is_empty() {
        validate_len("username", &username, 3, 32, &mut errors);
        let ok = username
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
        if !ok {
            errors.add("username", "invalid_format");
        }
    }

    // Do not trim passwords.
    validate_required_nonempty("password", password, &mut errors);
    if !password.is_empty() {
        validate_len("password", password, 8, 72, &mut errors);
    }

    if errors.is_empty() {
        Ok((username, password.to_string()))
    } else {
        Err(errors)
    }
}

pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| AuthError::Repo(RepoError::Internal))?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, encoded_hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(encoded_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

pub fn new_csrf_token() -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    let mut bytes = [0u8; 32];
    rand::RngCore::fill_bytes(&mut OsRng, &mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub async fn register<U: UsersRepo, S: SessionsRepo>(
    users: &mut U,
    sessions: &mut S,
    now: DateTime<Utc>,
    absolute_ttl_seconds: i64,
    username: &str,
    password: &str,
) -> Result<(User, Uuid, String, DateTime<Utc>), AuthError> {
    let (username, password) =
        validate_username_password(username, password).map_err(AuthError::Validation)?;
    let password_hash = hash_password(&password)?;

    let user_row = users
        .insert_user(&username, &password_hash)
        .await
        .map_err(|e| match e {
            RepoError::Conflict => AuthError::Conflict,
            other => AuthError::Repo(other),
        })?;

    let csrf_token = new_csrf_token();
    let session_id = Uuid::new_v4();
    let expires_at = now + chrono::Duration::seconds(absolute_ttl_seconds);
    sessions
        .insert_session(session_id, user_row.id, &csrf_token, expires_at, now)
        .await
        .map_err(AuthError::Repo)?;

    Ok((
        User {
            id: user_row.id,
            username: user_row.username,
            created_at: user_row.created_at,
        },
        session_id,
        csrf_token,
        expires_at,
    ))
}

pub async fn login<U: UsersRepo, S: SessionsRepo>(
    users: &mut U,
    sessions: &mut S,
    now: DateTime<Utc>,
    absolute_ttl_seconds: i64,
    username: &str,
    password: &str,
) -> Result<(User, Uuid, String, DateTime<Utc>), AuthError> {
    let (username, password) =
        validate_username_password(username, password).map_err(AuthError::Validation)?;

    let Some(user_row) = users
        .get_user_by_username(&username)
        .await
        .map_err(AuthError::Repo)?
    else {
        return Err(AuthError::InvalidCredentials);
    };

    if !verify_password(&password, &user_row.password_hash) {
        return Err(AuthError::InvalidCredentials);
    }

    let csrf_token = new_csrf_token();
    let session_id = Uuid::new_v4();
    let expires_at = now + chrono::Duration::seconds(absolute_ttl_seconds);
    sessions
        .insert_session(session_id, user_row.id, &csrf_token, expires_at, now)
        .await
        .map_err(AuthError::Repo)?;

    Ok((
        User {
            id: user_row.id,
            username: user_row.username,
            created_at: user_row.created_at,
        },
        session_id,
        csrf_token,
        expires_at,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn username_validation_rules() {
        assert!(validate_username_password("ab", "password123").is_err());
        assert!(validate_username_password("ABC", "password123").is_err());
        assert!(validate_username_password("a-b", "password123").is_err());
        assert!(validate_username_password("valid_name", "password123").is_ok());
    }

    #[test]
    fn password_length_limits() {
        assert!(validate_username_password("valid_name", "short").is_err());
        let long = "a".repeat(100);
        assert!(validate_username_password("valid_name", &long).is_err());
    }
}
