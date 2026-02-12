use axum::body::to_bytes;
use blog_website_api::app;
use blog_website_api::config::Config;
use blog_website_api::db;
use http::{Method, Request, StatusCode};
use serde_json::json;
use tower::ServiceExt;
use uuid::Uuid;

fn test_db_url() -> Option<String> {
    // Prefer the contract/LLD key; keep BW_TEST_DATABASE_URL for compatibility.
    std::env::var("TEST_DATABASE_URL")
        .ok()
        .or_else(|| std::env::var("BW_TEST_DATABASE_URL").ok())
}

fn database_name_from_url(database_url: &str) -> Option<&str> {
    // Minimal parse for postgres://.../<db>?<params>
    let after_slash = database_url.rsplit_once('/')?.1;
    let db = after_slash.split('?').next()?;
    if db.is_empty() {
        None
    } else {
        Some(db)
    }
}

fn assert_safe_test_database(database_url: &str) {
    let Some(db_name) = database_name_from_url(database_url) else {
        panic!("unable to determine database name from TEST_DATABASE_URL/BW_TEST_DATABASE_URL");
    };

    let db_name_lc = db_name.to_ascii_lowercase();
    let looks_like_test = db_name_lc.contains("_test") || db_name_lc.contains("_e2e");

    assert!(
        looks_like_test,
        "refusing to run destructive test setup against non-test database '{db_name}'. \
Set TEST_DATABASE_URL (preferred) or BW_TEST_DATABASE_URL to a database whose name contains '_test' or '_e2e'."
    );
}

async fn setup() -> Option<axum::Router> {
    let Some(database_url) = test_db_url() else {
        return None;
    };

    // Tests run migrations and truncate tables; fail fast if pointed at a non-test DB.
    assert_safe_test_database(&database_url);

    let cfg = Config {
        database_url: database_url.clone(),
        api_bind: "0.0.0.0:0".to_string(),
        session_cookie_secure: false,
        session_absolute_ttl: std::time::Duration::from_secs(604800),
        session_idle_ttl: std::time::Duration::from_secs(86400),
        cursor_hmac_secret: "test-secret".to_string(),
        auth_rate_limit_per_minute: 10_000,
    };

    let pool = db::create_pool(&cfg.database_url).await.ok()?;
    db::migrate(&pool).await.ok()?;

    // Best-effort cleanup.
    let _ = sqlx::query("TRUNCATE sessions, posts, users CASCADE")
        .execute(&pool)
        .await;

    let state = app::AppState::new(pool, cfg);
    Some(app::build_router(state))
}

fn header_value(s: &str) -> http::HeaderValue {
    http::HeaderValue::from_str(s).expect("header value")
}

fn extract_cookie(set_cookie: &http::HeaderValue) -> String {
    // Very small parser: take first segment before ';'
    set_cookie
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string()
}

async fn read_json_response(
    res: axum::response::Response,
) -> (StatusCode, http::HeaderMap, serde_json::Value) {
    let status = res.status();
    let headers = res.headers().clone();
    let bytes = to_bytes(res.into_body(), usize::MAX)
        .await
        .expect("read body");
    let v: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
    (status, headers, v)
}

async fn fetch_csrf(app: axum::Router, cookie: &str) -> String {
    let req = Request::builder()
        .method(Method::GET)
        .uri("/v1/auth/session")
        .header("cookie", header_value(cookie))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.oneshot(req).await.unwrap();
    let (status, _headers, v) = read_json_response(res).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(v["authenticated"], true);
    v["csrfToken"].as_str().expect("csrfToken").to_string()
}

async fn register_user(
    app: axum::Router,
    username: &str,
) -> (String, serde_json::Value, String) {
    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/register")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"username": username, "password": "password123"}))
                .unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let (status, headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::CREATED);
    let set_cookie = headers.get("set-cookie").expect("set-cookie");
    let cookie = extract_cookie(set_cookie);
    let csrf = fetch_csrf(app, &cookie).await;
    (cookie, body["user"].clone(), csrf)
}

async fn create_post(
    app: axum::Router,
    cookie: &str,
    csrf: &str,
    title: &str,
    body: &str,
) -> serde_json::Value {
    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/posts")
        .header("content-type", "application/json")
        .header("cookie", header_value(cookie))
        .header("x-csrf-token", header_value(csrf))
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"title": title, "body": body})).unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::CREATED);
    body["post"].clone()
}

#[tokio::test]
async fn session_unauthenticated() {
    let Some(app) = setup().await else {
        return;
    };

    let req = Request::builder()
        .method(Method::GET)
        .uri("/v1/auth/session")
        .body(axum::body::Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn register_session_and_csrf_flow() {
    let Some(app) = setup().await else {
        return;
    };

    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/register")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"username":"alice_1","password":"password123"})).unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let set_cookie = res.headers().get("set-cookie").expect("set-cookie");
    let cookie = extract_cookie(set_cookie);

    let req = Request::builder()
        .method(Method::GET)
        .uri("/v1/auth/session")
        .header("cookie", header_value(&cookie))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = to_bytes(res.into_body(), usize::MAX)
        .await
        .expect("read body");
    let v: serde_json::Value = serde_json::from_slice(&bytes).expect("json");
    assert_eq!(v["authenticated"], true);
    assert!(v.get("csrfToken").is_some());
    assert!(v.get("csrf_token").is_none());
}

#[tokio::test]
async fn register_conflict_returns_409() {
    let Some(app) = setup().await else {
        return;
    };

    let _ = register_user(app.clone(), "conflict_user").await;

    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/register")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"username":"conflict_user","password":"password123"}))
                .unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"]["code"], "conflict");
}

#[tokio::test]
async fn login_invalid_credentials_returns_401() {
    let Some(app) = setup().await else {
        return;
    };

    let _ = register_user(app.clone(), "login_user").await;

    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"username":"login_user","password":"wrongpass"}))
                .unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "invalid_credentials");
}

#[tokio::test]
async fn login_success_sets_cookie() {
    let Some(app) = setup().await else {
        return;
    };

    let _ = register_user(app.clone(), "login_ok_user").await;

    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/login")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"username":"login_ok_user","password":"password123"}))
                .unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let (status, headers, _body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::OK);
    assert!(headers.get("set-cookie").is_some());
}

#[tokio::test]
async fn logout_requires_csrf_and_clears_session() {
    let Some(app) = setup().await else {
        return;
    };

    let (cookie, _user, csrf) = register_user(app.clone(), "logout_user").await;

    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/logout")
        .header("cookie", header_value(&cookie))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"]["code"], "forbidden");

    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/logout")
        .header("cookie", header_value(&cookie))
        .header("x-csrf-token", header_value(&csrf))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    assert_eq!(status, StatusCode::NO_CONTENT);
    let set_cookie = headers.get("set-cookie").expect("set-cookie");
    let cookie_str = set_cookie.to_str().unwrap();
    assert!(cookie_str.contains("Max-Age=0"));

    let req = Request::builder()
        .method(Method::GET)
        .uri("/v1/auth/session")
        .header("cookie", header_value(&cookie))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["authenticated"], false);
}

#[tokio::test]
async fn posts_require_auth_and_csrf() {
    let Some(app) = setup().await else {
        return;
    };

    // Unauthenticated create -> 401
    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/posts")
        .header("content-type", "application/json")
        .header("x-csrf-token", "x")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"title":"t","body":"b"})).unwrap(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // Register and then create without csrf -> 403
    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/auth/register")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"username":"bob_1","password":"password123"})).unwrap(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let set_cookie = res.headers().get("set-cookie").expect("set-cookie");
    let cookie = extract_cookie(set_cookie);

    let req = Request::builder()
        .method(Method::POST)
        .uri("/v1/posts")
        .header("content-type", "application/json")
        .header("cookie", header_value(&cookie))
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"title":"t","body":"b"})).unwrap(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn view_posts_list_and_detail() {
    let Some(app) = setup().await else {
        return;
    };

    let (cookie, _user, csrf) = register_user(app.clone(), "viewer_user").await;
    let post = create_post(app.clone(), &cookie, &csrf, "Title 1", "Body 1").await;
    let post_id = post["id"].as_str().expect("post id");

    let req = Request::builder()
        .method(Method::GET)
        .uri("/v1/posts")
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["items"].as_array().unwrap().len(), 1);
    assert_eq!(body["items"][0]["title"], "Title 1");
    assert!(body["nextCursor"].is_null());

    let req = Request::builder()
        .method(Method::GET)
        .uri(format!("/v1/posts/{post_id}"))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["post"]["title"], "Title 1");
    assert_eq!(body["post"]["body"], "Body 1");
}

#[tokio::test]
async fn create_update_delete_post_flow() {
    let Some(app) = setup().await else {
        return;
    };

    let (cookie, _user, csrf) = register_user(app.clone(), "owner_user").await;
    let post = create_post(app.clone(), &cookie, &csrf, "Title 2", "Body 2").await;
    let post_id = post["id"].as_str().expect("post id");

    let req = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/v1/posts/{post_id}"))
        .header("content-type", "application/json")
        .header("cookie", header_value(&cookie))
        .header("x-csrf-token", header_value(&csrf))
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"title":"Updated","body":"Updated body"}))
                .unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["post"]["title"], "Updated");
    assert_eq!(body["post"]["body"], "Updated body");

    let req = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/v1/posts/{post_id}"))
        .header("cookie", header_value(&cookie))
        .header("x-csrf-token", header_value(&csrf))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    let req = Request::builder()
        .method(Method::GET)
        .uri(format!("/v1/posts/{post_id}"))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");
}

#[tokio::test]
async fn update_delete_non_owner_and_missing_post() {
    let Some(app) = setup().await else {
        return;
    };

    let (owner_cookie, _owner_user, owner_csrf) =
        register_user(app.clone(), "owner_user_2").await;
    let post = create_post(app.clone(), &owner_cookie, &owner_csrf, "Title 3", "Body 3").await;
    let post_id = post["id"].as_str().expect("post id");

    let (other_cookie, _other_user, other_csrf) =
        register_user(app.clone(), "other_user_2").await;

    let req = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/v1/posts/{post_id}"))
        .header("content-type", "application/json")
        .header("cookie", header_value(&other_cookie))
        .header("x-csrf-token", header_value(&other_csrf))
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"title":"Nope"})).unwrap(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"]["code"], "forbidden");

    let req = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/v1/posts/{post_id}"))
        .header("cookie", header_value(&other_cookie))
        .header("x-csrf-token", header_value(&other_csrf))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"]["code"], "forbidden");

    let missing_id = Uuid::new_v4();

    let req = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/v1/posts/{missing_id}"))
        .header("content-type", "application/json")
        .header("cookie", header_value(&owner_cookie))
        .header("x-csrf-token", header_value(&owner_csrf))
        .body(axum::body::Body::from(
            serde_json::to_vec(&json!({"title":"No post"})).unwrap(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");

    let req = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/v1/posts/{missing_id}"))
        .header("cookie", header_value(&owner_cookie))
        .header("x-csrf-token", header_value(&owner_csrf))
        .body(axum::body::Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, _headers, body) = read_json_response(res).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");
}
