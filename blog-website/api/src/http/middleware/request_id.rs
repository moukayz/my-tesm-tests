use axum::body::Body;
use axum::http::{HeaderName, HeaderValue, Request};
use axum::middleware::Next;
use axum::response::Response;
use ulid::Ulid;

#[derive(Clone, Debug)]
pub struct RequestId(pub String);

static X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

pub async fn request_id_middleware(mut req: Request<Body>, next: Next) -> Response {
    let request_id = req
        .headers()
        .get(&X_REQUEST_ID)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.to_string())
        .unwrap_or_else(|| format!("req_{}", Ulid::new()));

    req.extensions_mut().insert(RequestId(request_id.clone()));

    let mut res = next.run(req).await;
    let _ = res.headers_mut().insert(
        X_REQUEST_ID.clone(),
        HeaderValue::from_str(&request_id).unwrap_or(HeaderValue::from_static("invalid")),
    );
    res
}

pub fn get_request_id(req: &axum::http::request::Parts) -> String {
    req.extensions
        .get::<RequestId>()
        .map(|x| x.0.clone())
        .unwrap_or_else(|| "missing".to_string())
}
