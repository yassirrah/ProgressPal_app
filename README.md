# ProgressPal

ProgressPal is a full-stack progress tracking app for time-based sessions with optional quantity metrics (for example: `10 games`, `12 pages`, `5 km`), public feed sharing, and friendships.

## Overview

### Backend (Spring Boot)
- Java + Spring Boot
- Spring Data JPA + PostgreSQL
- Flyway migrations
- MapStruct DTO mapping
- MockMvc + Testcontainers integration tests

### Frontend (React + Vite)
- React + React Router
- Axios API client
- Home dashboard (live session, start session, activity type management)
- Public feed (card UI)
- Friends page (friend list + incoming requests)

## Implemented Features

### Users
- Sign up (basic user creation)
- List users
- Get user by id
- Update user
- Frontend login is currently mocked by fetching users and matching by email

### Sessions
- Start a session (`POST /api/sessions`)
- One live session per user rule
- Stop a session (`PATCH /api/sessions/{id}/stop`)
- Live session endpoint (`GET /api/sessions/live`) returns `204` when none exists
- Owner/non-owner visibility rules through `/api/users/{userId}/sessions`
- Public feed endpoint for public sessions only

### Session Metrics (current backend support)
- Activity types can define one optional quantity metric:
  - `metricKind`: `NONE | INTEGER | DECIMAL`
  - `metricLabel`: free text (for example `games`, `pages`, `km`)
- Metric value is captured on **stop**, not start:
  - `PATCH /api/sessions/{id}/stop` accepts optional `metricValue`
- Validation on stop:
  - `NONE` metric type rejects `metricValue`
  - `INTEGER` metric type rejects fractional values
  - `DECIMAL` accepts decimal values

### Activity Types
- Default + custom activity types
- Scope filtering:
  - `DEFAULTS`
  - `MINE`
  - `ALL`
- Create custom activity types
- Update activity types
- Delete custom activity types (owner only)
- Metric metadata lock:
  - `metricKind` / `metricLabel` cannot be changed once the activity type has been used by any session (`409 Conflict`)

### Feed
- Public sessions feed with pagination
- Ordered by `startedAt DESC`
- Includes:
  - session basics
  - activity type name
  - live/ended timestamps
  - session metric (`metricValue`, `metricLabel`) when available

### Friendships
- Send friend request
- Accept friend request
- List friends
- List incoming friend requests
- Frontend hides raw IDs and displays usernames

## Frontend Screens

- `/` Home
  - Live session card with timer
  - Stop flow with optional metric entry (when activity type supports it)
  - Start session form
  - Collapsible activity type manager (create/edit)
- `/feed` Public Feed
  - Session cards
  - Live timer for active sessions
  - Add friend action
  - Session metric display (for example `10 games`)
- `/friends`
  - Friends list
  - Incoming requests
  - Send friend request by user id
- `/login`
- `/signup`

## Backend API Conventions

- Mock auth header: `X-User-Id: <uuid>`
- Standard error response payload:
  - `timestamp`
  - `status`
  - `error`
  - `message`
  - `path`
- Common statuses:
  - `400` bad request / invalid params / missing header
  - `403` forbidden
  - `404` not found
  - `409` conflict
  - `204` no content (for no live session)

## Backend Endpoints (Current)

### Health / Utility

| Method | Path | Description | Auth Header |
|---|---|---|---|
| `GET` | `/api/ping` | Ping endpoint (`pong`) | No |

### Users

| Method | Path | Description | Auth Header |
|---|---|---|---|
| `GET` | `/api/users` | List users | No |
| `GET` | `/api/users/{id}` | Get user by id | No |
| `POST` | `/api/users` | Create user | No |
| `PUT` | `/api/users/{id}` | Update user | No |

User create/update body (`UserCreateDto`):
- `username`
- `email`
- `password`
- `profileImage`
- `bio`

### Sessions

| Method | Path | Description | Auth Header |
|---|---|---|---|
| `GET` | `/api/sessions` | List all sessions (raw/global) | No |
| `POST` | `/api/sessions` | Start session | Yes (`X-User-Id`) |
| `PATCH` | `/api/sessions/{id}/stop` | Stop session and optionally save metric | Yes (`X-User-Id`) |
| `GET` | `/api/sessions/live` | Get current user's live session (`204` if none) | Yes (`X-User-Id`) |
| `GET` | `/api/users/{userId}/sessions` | Get user sessions with visibility rules + pagination | Yes (`X-User-Id`) |

Start session body (`SessionCreateDto`):
- `activityTypeId` (UUID, required)
- `title` (optional)
- `description` (optional)
- `visibility` (`PUBLIC` / `PRIVATE`, required)

Stop session body (`SessionStopDto`, optional body):
- `metricValue` (optional decimal number)

Examples:

```bash
curl -X POST "http://localhost:8080/api/sessions" \
  -H "X-User-Id: <USER_UUID>" \
  -H "Content-Type: application/json" \
  -d '{
    "activityTypeId": "<ACTIVITY_TYPE_UUID>",
    "title": "Chess practice",
    "description": "Openings",
    "visibility": "PUBLIC"
  }'
```

```bash
curl -X PATCH "http://localhost:8080/api/sessions/<SESSION_UUID>/stop" \
  -H "X-User-Id: <USER_UUID>" \
  -H "Content-Type: application/json" \
  -d '{"metricValue": 10}'
```

### Activity Types

| Method | Path | Description | Auth Header |
|---|---|---|---|
| `GET` | `/api/activity-types` | List activity types by scope (`ALL`, `DEFAULTS`, `MINE`) | Yes (`X-User-Id`) |
| `GET` | `/api/activity-types/{id}` | Get one activity type | No |
| `POST` | `/api/activity-types` | Create custom activity type | Yes (`X-User-Id`) |
| `PUT` | `/api/activity-types/{id}` | Update activity type | No (current implementation) |
| `DELETE` | `/api/activity-types/{id}` | Delete custom activity type (owner only) | Yes (`X-User-Id`) |

Query params:
- `scope` on `GET /api/activity-types` (default: `ALL`)

Create/Update body (`ActivityTypeCreateDto`):
- `name`
- `iconUrl`
- `metricKind` (`NONE | INTEGER | DECIMAL`)
- `metricLabel`

Notes:
- If `metricKind` is omitted, backend normalizes it to `NONE`
- If `metricKind = NONE`, backend clears `metricLabel`
- Updating `metricKind` / `metricLabel` after the type has any sessions returns `409`

### Public Feed

| Method | Path | Description | Auth Header |
|---|---|---|---|
| `GET` | `/api/feed` | Paginated public sessions feed | No |

Pagination query params (Spring pageable):
- `page`
- `size`
- `sort` (default sort is `startedAt,desc`)

Feed item includes:
- `id`
- `userId`
- `username`
- `activityTypeId`
- `activityTypeName`
- `title`
- `metricValue` (nullable)
- `metricLabel` (nullable)
- `startedAt`
- `endedAt`
- `visibility`

### Friendships

| Method | Path | Description | Auth Header |
|---|---|---|---|
| `GET` | `/api/friends` | List current user's friends | Yes (`X-User-Id`) |
| `GET` | `/api/friends/requests/incoming` | List incoming pending friend requests | Yes (`X-User-Id`) |
| `POST` | `/api/friends/send` | Send friend request | Yes (`X-User-Id`) |
| `PATCH` | `/api/friends/accept` | Accept friend request | Yes (`X-User-Id`) |

Friend request params:
- `POST /api/friends/send?receiverId=<uuid>`
- `PATCH /api/friends/accept?requesterId=<uuid>`

## Local Development

### Backend

Requirements:
- Java 17+
- PostgreSQL running on `localhost:5432`
- DB: `progresspal`
- user/password: `progress` / `progress`

Run:

```bash
cd backend
./mvnw spring-boot:run
```

### Frontend

Requirements:
- Node.js + npm

Run:

```bash
cd frontend
npm install
npm run dev
```

Optional API URL override:
- `VITE_API_URL` (defaults to `http://localhost:8080/api`)

## Testing

Backend integration tests use Testcontainers (Docker required).

Examples:

```bash
cd backend
./mvnw test
```

```bash
./mvnw -q test -Dtest=ActivityTypeCreateApiTest
./mvnw -q test -Dtest=SessionStopApiTest
./mvnw -q test -Dtest=FeedApiTest,FeedPaginationApiTest
```

## Notes / Current Gaps

- Frontend login is mocked (email lookup from `/api/users`), not real authentication.
- `PUT /api/activity-types/{id}` currently does not require `X-User-Id` in controller (ownership checks for update are not enforced there yet).
- The “Send Friend Request” UI still uses receiver UUID input (can be improved to username search).

