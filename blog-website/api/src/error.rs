use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: ErrorBody,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    pub request_id: String,
}

#[derive(Debug, Clone)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
    pub details: Option<Value>,
    pub request_id: String,
}

impl ApiError {
    pub fn validation(
        request_id: String,
        message: impl Into<String>,
        field_errors: serde_json::Map<String, Value>,
    ) -> Self {
        let details = Some(serde_json::json!({ "fieldErrors": field_errors }));
        Self {
            status: StatusCode::BAD_REQUEST,
            code: "validation_error",
            message: message.into(),
            details,
            request_id,
        }
    }

    pub fn unauthenticated(request_id: String) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code: "unauthenticated",
            message: "Unauthenticated".to_string(),
            details: None,
            request_id,
        }
    }

    pub fn invalid_credentials(request_id: String) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code: "invalid_credentials",
            message: "Invalid username or password".to_string(),
            details: None,
            request_id,
        }
    }

    pub fn forbidden(request_id: String, message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            code: "forbidden",
            message: message.into(),
            details: None,
            request_id,
        }
    }

    pub fn not_found(request_id: String) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            code: "not_found",
            message: "Not found".to_string(),
            details: None,
            request_id,
        }
    }

    pub fn conflict(request_id: String, message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            code: "conflict",
            message: message.into(),
            details: None,
            request_id,
        }
    }

    pub fn rate_limited(request_id: String) -> Self {
        Self {
            status: StatusCode::TOO_MANY_REQUESTS,
            code: "rate_limited",
            message: "Too many requests".to_string(),
            details: None,
            request_id,
        }
    }

    pub fn internal(request_id: String) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            code: "internal",
            message: "Internal server error".to_string(),
            details: None,
            request_id,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = ErrorResponse {
            error: ErrorBody {
                code: self.code.to_string(),
                message: self.message,
                details: self.details,
                request_id: self.request_id,
            },
        };
        (self.status, Json(body)).into_response()
    }
}
