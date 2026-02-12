# Data Model (Persistence Contract)

This is the recommended initial relational schema. It is an internal contract for backend implementation, and explains how API fields map to persistent storage.

## Database: PostgreSQL (default)

### Table: `users`
- `id` UUID primary key
- `username` TEXT NOT NULL UNIQUE
- `password_hash` TEXT NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints / indexes:
- Unique index on `username`.

### Table: `posts`
- `id` UUID primary key
- `author_id` UUID NOT NULL references `users(id)` on delete restrict
- `title` TEXT NOT NULL
- `body` TEXT NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints / indexes:
- Index on `author_id`.
- Index on `(created_at desc, id desc)` to support cursor pagination.

### Table: `sessions`
- `id` UUID primary key (or a random 128-bit token stored as UUID-like string)
- `user_id` UUID NOT NULL references `users(id)` on delete cascade
- `csrf_token` TEXT NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `expires_at` TIMESTAMPTZ NOT NULL
- `last_seen_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints / indexes:
- Index on `user_id`.
- Index on `expires_at` for cleanup.

## Validation (recommended)
- `username`: 3..32 chars, lowercase+digits+underscore recommended; enforce at API boundary.
- `password`: 8..72 chars; reject very long inputs to avoid hash DoS.
- `title`: 1..200 chars.
- `body`: 1..20000 chars (tune as needed).

## Pagination Cursor (recommended)
- Cursor is an opaque encoding of `(created_at, id)`.
- Sorting: newest first (created_at desc, id desc).
- `nextCursor` is the last item in the returned page.
