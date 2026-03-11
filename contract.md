# Session Start Friend Notification Contract

## Scope

This contract defines the API and behavior for the feature:

- when a user starts a session, they can choose whether to notify friends.

This contract supersedes the previous goal-reached feature notes in this file.

## Primary Endpoint Contract

### `POST /api/sessions`

Auth:

- required (`X-User-Id` in current auth flow)

Request body (`SessionCreateDto`):

- `activityTypeId: UUID` (required)
- `title: string | null` (optional, max 120)
- `description: string | null` (optional)
- `visibility: "PRIVATE" | "FRIENDS" | "PUBLIC"` (required)
- `goalType: "NONE" | "TIME" | "METRIC" | null` (optional)
- `goalTarget: number | null` (optional)
- `goalNote: string | null` (optional, max 255)
- `notifyFriends: boolean | null` (optional)

Response:

- `201 Created` with unchanged `SessionDto`

Validation and defaults:

- if `notifyFriends` is omitted or `null`, backend treats it as `false`
- existing start-session validations and one-live-session rule remain unchanged

Common errors:

- `400 Bad Request` (validation)
- `401 Unauthorized` (missing auth)
- `404 Not Found` (missing user or activity type)
- `409 Conflict` (user already has a live session)

## Notification Behavior Contract

When `POST /api/sessions` succeeds:

- if `notifyFriends = false`: no friend notifications are created
- if `notifyFriends = true`:
  - recipients are accepted friends of the actor
  - friendship is evaluated in both directions and recipients are deduplicated
  - actor is never notified about their own session
  - notifications are sent only when session visibility is `FRIENDS` or `PUBLIC`
  - if visibility is `PRIVATE`, no friend notifications are sent

Notification shape:

- notification endpoints remain unchanged:
  - `GET /api/me/notifications`
  - `GET /api/me/notifications/unread-count`
  - `PATCH /api/me/notifications/{notificationId}/read`
  - `PATCH /api/me/notifications/read-all`
  - `DELETE /api/me/notifications`
- `NotificationDto` schema remains unchanged
- `NotificationDto.type` adds enum value: `SESSION_STARTED`
- `NotificationDto.resourceType` uses existing enum value: `SESSION`
- `NotificationDto.resourceId` is the created session id
- message format: `"<actorUsername> started a new session."`

## Backward Compatibility

- existing clients that do not send `notifyFriends` continue to work unchanged
- existing `SessionDto` schema remains unchanged
- existing notification read/clear/list APIs remain unchanged

## Required Persistence Change

Because notification type values are constrained in DB migrations, implementation must include a new Flyway migration to allow:

- `SESSION_STARTED` in `notification.type` check constraint

Without this migration, writes for this new notification type may fail at runtime.

## Frontend Contract Obligations

On Home start-session form:

- show explicit user choice to notify friends (`on/off`)
- default UI value is `off`
- include `notifyFriends` in start-session payload
- if visibility is `PRIVATE`, UI should not send `notifyFriends = true`

UI states:

- preserve existing loading/error/empty states
- preserve existing session-start behavior when notify is off

## Acceptance Criteria

- user can start a session with notify friends enabled or disabled
- notify disabled => no friend notifications
- notify enabled + visibility `FRIENDS`/`PUBLIC` => friends receive `SESSION_STARTED` notification
- notify enabled + visibility `PRIVATE` => no friend notifications
- sender never receives their own start notification
- unread badge and notification list reflect created notifications correctly
