# API Standard — Khanij Nexus

## Base URL

All API endpoints are prefixed with `/api/v1`. The `/health` endpoint is
excluded from this prefix.

## HTTP Methods

| Method | Usage |
|--------|-------|
| `GET` | Read resources. Never mutates state. |
| `POST` | Create resources or trigger actions. Accepts `Idempotency-Key` header. |
| `PATCH` | Partial update of a resource. |
| `PUT` | Full replacement (rare — prefer PATCH). |
| `DELETE` | Soft-delete or state transition to cancelled/archived. Never hard-delete user data. |

## Request Format

- Content-Type: `application/json`
- All request bodies validated with Zod schemas from `@khanij/types`.
- Resource-creating `POST` endpoints must accept an `Idempotency-Key` header.

## Response Envelope

### Success
```json
{
  "data": { ... }
}
```

### Success (list)
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### Error
```json
{
  "code": "ILLEGAL_DEAL_TRANSITION",
  "message": "Cannot transition deal from CREATED to SIGNED",
  "traceId": "abc-123-def"
}
```

No stack traces. No internal entity IDs beyond what the client already knows.

## Pagination

- Query params: `?page=1&pageSize=20`
- Default page size: 20. Maximum: 100.
- Response includes `pagination` object with `total` and `totalPages`.

## Authentication

- `Authorization: Bearer <access_token>` on all protected routes.
- Access tokens expire in 15 minutes.
- Refresh via `POST /api/v1/auth/refresh` with refresh token in body.

## Versioning

- URL-based: `/api/v1/`, `/api/v2/` (when needed).
- Breaking changes require a new version. Additive changes are backward-compatible.

## Rate Limiting

- Global: 100 requests/minute per IP (configurable via `@nestjs/throttler`).
- Auth endpoints: 10 requests/minute per IP.

## CORS

- Origin whitelist from `APP_BASE_URL` environment variable.
- Credentials: allowed (for cookie-based refresh if needed).
