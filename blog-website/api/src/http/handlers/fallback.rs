use crate::error::ApiError;
use crate::http::extract::ReqId;

pub async fn not_found(ReqId(request_id): ReqId) -> ApiError {
    ApiError::not_found(request_id)
}
