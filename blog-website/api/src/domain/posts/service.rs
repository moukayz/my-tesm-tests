use crate::domain::validation::{
    trim_owned, validate_len, validate_required_nonempty, FieldErrors,
};

pub fn validate_create_post(title: &str, body: &str) -> Result<(String, String), FieldErrors> {
    let mut errors = FieldErrors::default();
    let title = trim_owned(title);
    validate_required_nonempty("title", &title, &mut errors);
    if !title.is_empty() {
        validate_len("title", &title, 1, 200, &mut errors);
    }

    validate_required_nonempty("body", body, &mut errors);
    if !body.is_empty() {
        validate_len("body", body, 1, 20000, &mut errors);
    }

    if errors.is_empty() {
        Ok((title, body.to_string()))
    } else {
        Err(errors)
    }
}

pub fn validate_update_post(
    title: &Option<String>,
    body: &Option<String>,
) -> Result<(Option<String>, Option<String>), FieldErrors> {
    let mut errors = FieldErrors::default();
    if title.is_none() && body.is_none() {
        errors.add("_", "min_properties");
        return Err(errors);
    }

    let title_out = if let Some(t) = title {
        let t = trim_owned(t);
        validate_required_nonempty("title", &t, &mut errors);
        if !t.is_empty() {
            validate_len("title", &t, 1, 200, &mut errors);
        }
        Some(t)
    } else {
        None
    };

    let body_out = if let Some(b) = body {
        validate_required_nonempty("body", b, &mut errors);
        if !b.is_empty() {
            validate_len("body", b, 1, 20000, &mut errors);
        }
        Some(b.clone())
    } else {
        None
    };

    if errors.is_empty() {
        Ok((title_out, body_out))
    } else {
        Err(errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_requires_at_least_one_field() {
        let err = validate_update_post(&None, &None).unwrap_err();
        assert!(err.field_errors.contains_key("_"));
    }
}
