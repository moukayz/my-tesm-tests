use crate::error::ApiError;
use crate::http::middleware::request_id;
use axum::async_trait;
use axum::body::Body;
use axum::extract::{FromRequest, FromRequestParts, Query};
use axum::http::request::Parts;
use axum::http::Request;
use axum::Json;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::net::SocketAddr;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct ReqId(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for ReqId
where
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        Ok(Self(request_id::get_request_id(parts)))
    }
}

#[derive(Clone, Debug)]
pub struct ClientIp(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for ClientIp
where
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Prefer `ConnectInfo<SocketAddr>` when available (server is started with it).
        if let Some(addr) = parts
            .extensions
            .get::<axum::extract::ConnectInfo<SocketAddr>>()
        {
            return Ok(Self(addr.0.ip().to_string()));
        }
        Ok(Self("unknown".to_string()))
    }
}

pub struct AppJson<T>(pub T);

#[async_trait]
impl<S, T> FromRequest<S> for AppJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request(req: Request<Body>, state: &S) -> Result<Self, Self::Rejection> {
        let request_id = req
            .extensions()
            .get::<request_id::RequestId>()
            .map(|x| x.0.clone())
            .unwrap_or_else(|| "missing".to_string());

        match Json::<T>::from_request(req, state).await {
            Ok(Json(v)) => Ok(Self(v)),
            Err(_) => {
                let mut field_errors = serde_json::Map::new();
                field_errors.insert("_".to_string(), Value::from(vec!["invalid_format"]));
                Err(ApiError::validation(
                    request_id,
                    "Invalid JSON body",
                    field_errors,
                ))
            }
        }
    }
}

pub struct AppQuery<T>(pub T);

#[async_trait]
impl<S, T> FromRequestParts<S> for AppQuery<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let request_id = request_id::get_request_id(parts);
        match Query::<T>::from_request_parts(parts, state).await {
            Ok(Query(v)) => Ok(Self(v)),
            Err(_) => {
                let mut field_errors = serde_json::Map::new();
                field_errors.insert("_".to_string(), Value::from(vec!["invalid_format"]));
                Err(ApiError::validation(
                    request_id,
                    "Invalid query parameters",
                    field_errors,
                ))
            }
        }
    }
}

pub struct PathUuid {
    pub value: Uuid,
}

impl PathUuid {
    pub fn parse(request_id: String, field: &str, raw: &str) -> Result<Self, ApiError> {
        match Uuid::parse_str(raw) {
            Ok(v) => Ok(Self { value: v }),
            Err(_) => {
                let mut field_errors = serde_json::Map::new();
                field_errors.insert(field.to_string(), Value::from(vec!["invalid_format"]));
                Err(ApiError::validation(
                    request_id,
                    "Invalid path parameter",
                    field_errors,
                ))
            }
        }
    }
}

// Note: path params are parsed in handlers via `axum::extract::Path<String>` and `PathUuid::parse`.
