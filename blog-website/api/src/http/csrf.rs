use crate::error::ApiError;
use http::HeaderMap;
use subtle::ConstantTimeEq;

pub const CSRF_HEADER: &str = "x-csrf-token";

pub fn require_csrf(
    request_id: String,
    headers: &HeaderMap,
    expected: &str,
) -> Result<(), ApiError> {
    let Some(got) = headers.get(CSRF_HEADER).and_then(|v| v.to_str().ok()) else {
        return Err(ApiError::forbidden(
            request_id,
            "CSRF token missing or invalid",
        ));
    };

    let got = got.trim();
    if got.is_empty() {
        return Err(ApiError::forbidden(
            request_id,
            "CSRF token missing or invalid",
        ));
    }

    if got.as_bytes().ct_eq(expected.as_bytes()).unwrap_u8() != 1 {
        return Err(ApiError::forbidden(
            request_id,
            "CSRF token missing or invalid",
        ));
    }

    Ok(())
}
