use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, thiserror::Error)]
pub enum DecodeCursorError {
    #[error("invalid cursor")]
    Invalid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CursorPayload {
    created_at: DateTime<Utc>,
    id: Uuid,
}

#[derive(Debug, Clone)]
pub struct Cursor {
    pub created_at: DateTime<Utc>,
    pub id: Uuid,
}

pub fn encode_cursor(secret: &str, cursor: Cursor) -> String {
    let payload = CursorPayload {
        created_at: cursor.created_at,
        id: cursor.id,
    };

    let payload_json = serde_json::to_vec(&payload).expect("cursor payload serialize");
    let payload_b64 = URL_SAFE_NO_PAD.encode(payload_json);

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("hmac key");
    mac.update(payload_b64.as_bytes());
    let sig = mac.finalize().into_bytes();
    let sig_b64 = URL_SAFE_NO_PAD.encode(sig);

    format!("v1.{}.{}", payload_b64, sig_b64)
}

pub fn decode_cursor(secret: &str, raw: &str) -> Result<Cursor, DecodeCursorError> {
    let mut parts = raw.split('.');
    let v = parts.next().ok_or(DecodeCursorError::Invalid)?;
    if v != "v1" {
        return Err(DecodeCursorError::Invalid);
    }
    let payload_b64 = parts.next().ok_or(DecodeCursorError::Invalid)?;
    let sig_b64 = parts.next().ok_or(DecodeCursorError::Invalid)?;
    if parts.next().is_some() {
        return Err(DecodeCursorError::Invalid);
    }

    let sig_bytes = URL_SAFE_NO_PAD
        .decode(sig_b64.as_bytes())
        .map_err(|_| DecodeCursorError::Invalid)?;

    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| DecodeCursorError::Invalid)?;
    mac.update(payload_b64.as_bytes());
    mac.verify_slice(&sig_bytes)
        .map_err(|_| DecodeCursorError::Invalid)?;

    let payload_json = URL_SAFE_NO_PAD
        .decode(payload_b64.as_bytes())
        .map_err(|_| DecodeCursorError::Invalid)?;
    let payload: CursorPayload =
        serde_json::from_slice(&payload_json).map_err(|_| DecodeCursorError::Invalid)?;

    Ok(Cursor {
        created_at: payload.created_at,
        id: payload.id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn cursor_roundtrip_and_signature() {
        let secret = "secret";
        let c = Cursor {
            created_at: Utc.with_ymd_and_hms(2026, 2, 12, 12, 0, 0).unwrap(),
            id: Uuid::new_v4(),
        };

        let raw = encode_cursor(secret, c.clone());
        let decoded = decode_cursor(secret, &raw).unwrap();
        assert_eq!(decoded.id, c.id);
        assert_eq!(decoded.created_at, c.created_at);

        assert!(decode_cursor("wrong", &raw).is_err());
    }
}
