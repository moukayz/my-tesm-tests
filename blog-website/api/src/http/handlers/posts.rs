use crate::app::AppState;
use crate::domain::posts::{cursor, service as posts_service};
use crate::error::ApiError;
use crate::http::csrf;
use crate::http::extract::{AppJson, AppQuery, PathUuid, ReqId};
use crate::http::session::RequireSession;
use crate::http::types::{
    CreatePostRequest, ListPostsResponse, PostDetailDto, PostResponse, PostSummaryDto,
    UpdatePostRequest,
};
use crate::repo::posts_repo::PgPostsRepo;
use crate::repo::PostsRepo;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ListQuery {
    pub limit: Option<u32>,
    pub cursor: Option<String>,
}

pub async fn list(
    ReqId(request_id): ReqId,
    State(state): State<AppState>,
    AppQuery(q): AppQuery<ListQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let limit = q.limit.unwrap_or(20);
    if !(1..=50).contains(&limit) {
        let mut fe = serde_json::Map::new();
        fe.insert("limit".to_string(), Value::from(vec!["invalid_format"]));
        return Err(ApiError::validation(request_id, "Validation error", fe));
    }

    let cursor_decoded = if let Some(raw) = q.cursor.as_deref() {
        match cursor::decode_cursor(&state.cfg.cursor_hmac_secret, raw) {
            Ok(c) => Some((c.created_at, c.id)),
            Err(_) => {
                let mut fe = serde_json::Map::new();
                fe.insert("cursor".to_string(), Value::from(vec!["invalid_format"]));
                return Err(ApiError::validation(request_id, "Validation error", fe));
            }
        }
    } else {
        None
    };

    let mut repo = PgPostsRepo::new(state.db.clone());
    let rows = repo
        .list_posts(limit as i64 + 1, cursor_decoded)
        .await
        .map_err(|_| ApiError::internal(request_id.clone()))?;

    let mut items = Vec::new();
    for r in rows.iter().take(limit as usize) {
        items.push(PostSummaryDto {
            id: r.id,
            title: r.title.clone(),
            author: crate::http::types::AuthorDto {
                id: r.author_id,
                username: r.author_username.clone(),
            },
            created_at: r.created_at,
            updated_at: r.updated_at,
        });
    }

    let next_cursor = if rows.len() > limit as usize {
        let last = rows.get(limit as usize - 1).expect("last item");
        Some(cursor::encode_cursor(
            &state.cfg.cursor_hmac_secret,
            cursor::Cursor {
                created_at: last.created_at,
                id: last.id,
            },
        ))
    } else {
        None
    };

    Ok(Json(ListPostsResponse { items, next_cursor }))
}

pub async fn detail(
    ReqId(request_id): ReqId,
    State(state): State<AppState>,
    Path(post_id_raw): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let post_id = PathUuid::parse(request_id.clone(), "postId", &post_id_raw)?.value;

    let mut repo = PgPostsRepo::new(state.db.clone());
    let Some(row) = repo
        .get_post_detail(post_id)
        .await
        .map_err(|_| ApiError::internal(request_id.clone()))?
    else {
        return Err(ApiError::not_found(request_id));
    };

    let post = PostDetailDto {
        id: row.id,
        title: row.title,
        body: row.body,
        author: crate::http::types::AuthorDto {
            id: row.author_id,
            username: row.author_username,
        },
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok(Json(PostResponse { post }))
}

pub async fn create(
    ReqId(request_id): ReqId,
    State(state): State<AppState>,
    headers: HeaderMap,
    RequireSession(session): RequireSession,
    AppJson(req): AppJson<CreatePostRequest>,
) -> Result<impl IntoResponse, ApiError> {
    csrf::require_csrf(request_id.clone(), &headers, &session.csrf_token)?;

    let (title, body) = posts_service::validate_create_post(
        req.title.as_deref().unwrap_or(""),
        req.body.as_deref().unwrap_or(""),
    )
    .map_err(|fe| {
        ApiError::validation(request_id.clone(), "Validation error", fe.into_json_map())
    })?;

    let now = Utc::now();
    let mut repo = PgPostsRepo::new(state.db.clone());
    let row = repo
        .insert_post(Uuid::new_v4(), session.user.id, &title, &body, now)
        .await
        .map_err(|_| ApiError::internal(request_id.clone()))?;

    let post = PostDetailDto {
        id: row.id,
        title: row.title,
        body: row.body,
        author: crate::http::types::AuthorDto {
            id: row.author_id,
            username: row.author_username,
        },
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok((StatusCode::CREATED, Json(PostResponse { post })))
}

pub async fn update(
    ReqId(request_id): ReqId,
    State(state): State<AppState>,
    headers: HeaderMap,
    RequireSession(session): RequireSession,
    Path(post_id_raw): Path<String>,
    AppJson(req): AppJson<UpdatePostRequest>,
) -> Result<impl IntoResponse, ApiError> {
    csrf::require_csrf(request_id.clone(), &headers, &session.csrf_token)?;
    let post_id = PathUuid::parse(request_id.clone(), "postId", &post_id_raw)?.value;

    let (title, body) =
        posts_service::validate_update_post(&req.title, &req.body).map_err(|fe| {
            ApiError::validation(request_id.clone(), "Validation error", fe.into_json_map())
        })?;

    let now = Utc::now();
    let mut repo = PgPostsRepo::new(state.db.clone());
    let Some(author_id) = repo
        .get_post_author_id(post_id)
        .await
        .map_err(|_| ApiError::internal(request_id.clone()))?
    else {
        return Err(ApiError::not_found(request_id));
    };

    if author_id != session.user.id {
        return Err(ApiError::forbidden(request_id, "Forbidden"));
    }

    let row = repo
        .update_post(post_id, title.as_deref(), body.as_deref(), now)
        .await
        .map_err(|e| match e {
            crate::repo::RepoError::NotFound => ApiError::not_found(request_id.clone()),
            _ => ApiError::internal(request_id.clone()),
        })?;

    let post = PostDetailDto {
        id: row.id,
        title: row.title,
        body: row.body,
        author: crate::http::types::AuthorDto {
            id: row.author_id,
            username: row.author_username,
        },
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok(Json(PostResponse { post }))
}

pub async fn delete_post(
    ReqId(request_id): ReqId,
    State(state): State<AppState>,
    headers: HeaderMap,
    RequireSession(session): RequireSession,
    Path(post_id_raw): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    csrf::require_csrf(request_id.clone(), &headers, &session.csrf_token)?;
    let post_id = PathUuid::parse(request_id.clone(), "postId", &post_id_raw)?.value;

    let mut repo = PgPostsRepo::new(state.db.clone());
    let Some(author_id) = repo
        .get_post_author_id(post_id)
        .await
        .map_err(|_| ApiError::internal(request_id.clone()))?
    else {
        return Err(ApiError::not_found(request_id));
    };

    if author_id != session.user.id {
        return Err(ApiError::forbidden(request_id, "Forbidden"));
    }

    repo.delete_post(post_id).await.map_err(|e| match e {
        crate::repo::RepoError::NotFound => ApiError::not_found(request_id.clone()),
        _ => ApiError::internal(request_id.clone()),
    })?;

    Ok(StatusCode::NO_CONTENT)
}
