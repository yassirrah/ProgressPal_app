# Live Session Join Request + Room Chat Contract

## Title and Scope

Actors:

- User A = requester
- User B = host (session owner)

Transport:

- HTTP polling in v1 (no websocket requirement)

Source of truth:

- this file supersedes previous contract content and is the contract of record for this feature.

## Core Rules

- Join request is allowed only if requester currently passes existing visibility access to that session:
  - `PUBLIC`, or
  - `FRIENDS` with friendship access.
- Join request is never allowed for inaccessible `PRIVATE` sessions.
- Requester cannot request their own session.
- Requests are allowed only while session is live (`endedAt == null`).
- Exactly one request record per `(sessionId, requesterId)` for the same live session.
- If an existing request for that live session is `PENDING`, `ACCEPTED`, or `REJECTED`, creating another request returns `409 Conflict`.
- Accepted requester can enter room via explicit `Enter Room` CTA.
- Room access and room chat access are restricted to host + accepted participants only.

## Public APIs

### 1) `POST /api/sessions/{sessionId}/join-requests`

Request:

- no body

Response:

- `201 Created`
- `SessionJoinRequestDto { id, sessionId, requesterId, requesterUsername, status, createdAt, respondedAt }`

Errors:

- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`

### 2) `GET /api/me/join-requests/outgoing`

Query params:

- `status` optional: `PENDING | ACCEPTED | REJECTED`
- `liveOnly` optional, default `true`

Response:

- `200 OK`
- list of `MyJoinRequestDto { requestId, sessionId, hostUserId, status, createdAt, respondedAt }`

### 3) `GET /api/sessions/{sessionId}/join-requests/incoming`

Authorization:

- host-only endpoint

Response:

- `200 OK`
- list of `SessionJoinRequestDto` (typically `PENDING` rows)

Errors:

- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` (session not live)

### 4) `PATCH /api/sessions/{sessionId}/join-requests/{requestId}`

Authorization:

- host-only endpoint

Request body:

- `{ "decision": "ACCEPT" | "REJECT" }`

Response:

- `200 OK`
- updated `SessionJoinRequestDto`

Errors:

- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` (already decided or session not live)

### 5) `GET /api/sessions/{sessionId}/room`

Authorization:

- host or accepted participant only

Response:

- `200 OK`
- `RoomStateDto { sessionId, host { id, username, profileImage }, participants[], live }`

Errors:

- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` (session not live)

### 6) `GET /api/sessions/{sessionId}/room/messages`

Authorization:

- host or accepted participant only

Query params:

- `page`
- `size`

Response:

- `200 OK`
- paged `RoomMessageDto { id, sessionId, senderId, senderUsername, senderProfileImage, content, createdAt }`

### 7) `POST /api/sessions/{sessionId}/room/messages`

Authorization:

- host or accepted participant only

Request body:

- `{ "content": "..." }`

Validation:

- content is required
- content is trimmed
- content must be non-blank after trimming
- max content length is `1000`

Response:

- `201 Created`
- `RoomMessageDto`

Errors:

- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` (session not live)

## Frontend Behavior Obligations

- Feed live cards requester states:
  - `Request to Join` -> `Pending` -> `Enter Room` (accepted) or `Rejected`.
- Home host UX:
  - right-side room panel as a toggle,
  - pending requests list,
  - accept/reject controls,
  - participant list,
  - room chat stream + composer.
- Accepted requester enters a separate room component/page (not host Home panel).
- Polling is active only while relevant view is active.
- Existing loading/empty/error state patterns must be preserved.

## Persistence and Enums

- New table: `session_join_request`
  - unique constraint on `(session_id, requester_id)`.
- New table: `session_room_message`
  - linked to session and sender.
- Join request status enum values:
  - `PENDING`
  - `ACCEPTED`
  - `REJECTED`
- Implementation requires Flyway migration(s) for:
  - both tables,
  - required constraints and indexes,
  - enum/check-constraint compatibility.

## Compatibility

- Existing session start/stop/pause/resume APIs are unchanged.
- Existing comments/likes/notifications APIs are unchanged for v1.
- No websocket or push delivery guarantees in v1.

## Acceptance and Validation Matrix

- Requester can submit join request for visible live session.
- Requester is blocked for:
  - own session,
  - private inaccessible session,
  - ended session,
  - duplicate request.
- Host sees incoming requests on Home polling endpoint.
- Host accept/reject updates requester outgoing status.
- Accepted requester can fetch room state/messages and post chat.
- Rejected or non-participant requester gets `403` on room state/messages/post.
- Room endpoints return `409` when session is ended.
- Feed and Home UI transitions match statuses:
  - `Request`, `Pending`, `Enter Room`, `Rejected`.

## Assumptions and Defaults

- Contract scope is join-room only and replaces previous file content.
- Polling cadence is implementation detail; contract requires eventual consistency via repeated `GET` polling.
- No leave-room or kick-participant capability in v1.
- Chat history is persisted and visible to authorized room members while the session is live.
