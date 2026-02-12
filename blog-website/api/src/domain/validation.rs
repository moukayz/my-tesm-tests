use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Default, Clone)]
pub struct FieldErrors {
    pub field_errors: BTreeMap<String, Vec<String>>,
}

impl FieldErrors {
    pub fn add(&mut self, field: &str, tag: &str) {
        self.field_errors
            .entry(field.to_string())
            .or_default()
            .push(tag.to_string());
    }

    pub fn is_empty(&self) -> bool {
        self.field_errors.is_empty()
    }

    pub fn into_json_map(self) -> serde_json::Map<String, Value> {
        let mut map = serde_json::Map::new();
        for (k, v) in self.field_errors {
            map.insert(k, Value::from(v));
        }
        map
    }
}

pub fn trim_owned(s: &str) -> String {
    s.trim().to_string()
}

pub fn validate_required_nonempty(field: &str, value: &str, errors: &mut FieldErrors) {
    if value.is_empty() {
        errors.add(field, "required");
    }
}

pub fn validate_len(field: &str, value: &str, min: usize, max: usize, errors: &mut FieldErrors) {
    let len = value.chars().count();
    if len < min {
        errors.add(field, "too_short");
    }
    if len > max {
        errors.add(field, "too_long");
    }
}
