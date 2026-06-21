import axios from 'axios';
import { clearKeycloakSession } from './oidc';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const USER_STORAGE_KEY = 'progresspal_user';
const AUTH_STORAGE_KEY = 'progresspal_auth';
const DEV_REQUEST_TELEMETRY_ENABLED = import.meta.env.DEV;
const AUTH_ROUTE_PATHS = new Set(['/login', '/signup', '/auth/callback']);

let unauthorizedRedirectInFlight = false;

const client = axios.create({
  baseURL: API_BASE_URL,
});

const requestTelemetryStore = {
  entries: [],
  startedAt: null,
};

function encodeSize(value) {
  try {
    return new TextEncoder().encode(String(value || '')).length;
  } catch {
    return String(value || '').length;
  }
}

function estimateBytes(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return encodeSize(value);
  if (typeof value === 'number' || typeof value === 'boolean') return encodeSize(String(value));
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  try {
    return encodeSize(JSON.stringify(value));
  } catch {
    return encodeSize(String(value));
  }
}

function toPlainHeaders(headers) {
  if (!headers) return null;
  if (typeof headers.toJSON === 'function') return headers.toJSON();
  return headers;
}

function absolutizeUrl(url) {
  if (!url) return API_BASE_URL;
  try {
    return new URL(url, API_BASE_URL).toString();
  } catch {
    return String(url);
  }
}

function normalizeRoute(url) {
  let pathname = '';
  try {
    pathname = new URL(absolutizeUrl(url)).pathname || '';
  } catch {
    pathname = String(url || '');
  }

  const withoutBase = pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  return withoutBase
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8,}$/i.test(segment)) return ':id';
      if (/^[A-Za-z0-9_-]{16,}$/.test(segment)) return ':id';
      return segment;
    })
    .join('/') || '/';
}

function estimateRequestBytes(config) {
  return estimateBytes({
    method: config?.method,
    url: absolutizeUrl(config?.url),
    params: config?.params || null,
    headers: toPlainHeaders(config?.headers),
    data: config?.data ?? null,
  });
}

function estimateResponseBytes(response) {
  const contentLength = Number(response?.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength >= 0) {
    return contentLength;
  }
  return estimateBytes(response?.data);
}

function currentPathname() {
  return typeof window !== 'undefined' ? window.location.pathname : '';
}

function currentVisibilityState() {
  return typeof document !== 'undefined' ? document.visibilityState : 'unknown';
}

function createGroupedStats(entries, groupKey) {
  const grouped = new Map();
  entries.forEach((entry) => {
    const key = groupKey(entry);
    const current = grouped.get(key) || {
      key,
      requests: 0,
      bytes: 0,
      requestBytes: 0,
      responseBytes: 0,
      avgDurationMs: 0,
      totalDurationMs: 0,
    };
    current.requests += 1;
    current.bytes += entry.requestBytes + entry.responseBytes;
    current.requestBytes += entry.requestBytes;
    current.responseBytes += entry.responseBytes;
    current.totalDurationMs += entry.durationMs;
    grouped.set(key, current);
  });

  const firstTs = entries[0]?.timestamp ?? Date.now();
  const lastTs = entries[entries.length - 1]?.timestamp ?? firstTs;
  const durationMinutes = Math.max((lastTs - firstTs) / 60000, 1 / 60);

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      avgDurationMs: row.requests > 0 ? row.totalDurationMs / row.requests : 0,
      bytesPerMinute: row.bytes / durationMinutes,
      requestsPerMinute: row.requests / durationMinutes,
    }))
    .sort((left, right) => (
      right.bytes - left.bytes
      || right.requests - left.requests
      || left.key.localeCompare(right.key)
    ));
}

function createTelemetrySnapshot() {
  const entries = [...requestTelemetryStore.entries].sort((left, right) => left.timestamp - right.timestamp);
  const totalBytes = entries.reduce((sum, entry) => sum + entry.requestBytes + entry.responseBytes, 0);
  const totalRequests = entries.length;
  const firstTs = entries[0]?.timestamp ?? Date.now();
  const lastTs = entries[entries.length - 1]?.timestamp ?? firstTs;
  const durationMinutes = Math.max((lastTs - firstTs) / 60000, 1 / 60);

  return {
    startedAt: requestTelemetryStore.startedAt,
    generatedAt: Date.now(),
    totalRequests,
    totalBytes,
    requestsPerMinute: totalRequests / durationMinutes,
    bytesPerMinute: totalBytes / durationMinutes,
    entries,
    byLabel: createGroupedStats(entries, (entry) => entry.initiator || 'unlabeled'),
    byRoute: createGroupedStats(entries, (entry) => entry.route || 'unknown'),
  };
}

function resetRequestTelemetry() {
  requestTelemetryStore.entries = [];
  requestTelemetryStore.startedAt = null;
}

function printRequestTelemetrySummary() {
  const snapshot = createTelemetrySnapshot();
  const headline = {
    totalRequests: snapshot.totalRequests,
    totalBytes: snapshot.totalBytes,
    requestsPerMinute: Number(snapshot.requestsPerMinute.toFixed(2)),
    bytesPerMinute: Number(snapshot.bytesPerMinute.toFixed(2)),
  };

  console.log('[ProgressPal net audit] summary', headline);
  console.table(snapshot.byLabel.map((row) => ({
    label: row.key,
    requests: row.requests,
    bytes: row.bytes,
    bytesPerMinute: Number(row.bytesPerMinute.toFixed(2)),
    requestsPerMinute: Number(row.requestsPerMinute.toFixed(2)),
    avgDurationMs: Number(row.avgDurationMs.toFixed(2)),
  })));
  console.table(snapshot.byRoute.map((row) => ({
    route: row.key,
    requests: row.requests,
    bytes: row.bytes,
    bytesPerMinute: Number(row.bytesPerMinute.toFixed(2)),
    requestsPerMinute: Number(row.requestsPerMinute.toFixed(2)),
    avgDurationMs: Number(row.avgDurationMs.toFixed(2)),
  })));

  return snapshot;
}

function recordRequestTelemetry(config, responseOrError, statusOverride = null) {
  if (!DEV_REQUEST_TELEMETRY_ENABLED || !config) return;

  const meta = config.progresspalAuditMeta || {};
  const status = statusOverride ?? responseOrError?.status ?? responseOrError?.response?.status ?? 0;
  const durationMs = Math.max(0, Math.round(performance.now() - Number(meta.startedPerf || performance.now())));
  const response = responseOrError?.data !== undefined || responseOrError?.headers
    ? responseOrError
    : responseOrError?.response;

  if (!requestTelemetryStore.startedAt) {
    requestTelemetryStore.startedAt = Date.now();
  }

  requestTelemetryStore.entries.push({
    timestamp: meta.timestamp || Date.now(),
    method: String(config.method || 'GET').toUpperCase(),
    route: meta.route || normalizeRoute(config.url),
    status,
    durationMs,
    initiator: meta.initiator || 'unlabeled',
    pathname: meta.pathname || currentPathname(),
    visibilityState: meta.visibilityState || currentVisibilityState(),
    requestBytes: meta.requestBytes ?? estimateRequestBytes(config),
    responseBytes: estimateResponseBytes(response),
  });
}

function attachDevRequestTelemetry() {
  if (!DEV_REQUEST_TELEMETRY_ENABLED || typeof window === 'undefined') return;
  window.__progresspalNetStats = {
    reset: resetRequestTelemetry,
    snapshot: createTelemetrySnapshot,
    printSummary: printRequestTelemetrySummary,
  };

  client.interceptors.request.use((config) => {
    const requestConfig = config;
    requestConfig.progresspalAuditMeta = {
      timestamp: Date.now(),
      startedPerf: performance.now(),
      route: normalizeRoute(requestConfig.url),
      initiator: requestConfig.progresspalInitiator || 'unlabeled',
      pathname: currentPathname(),
      visibilityState: currentVisibilityState(),
      requestBytes: estimateRequestBytes(requestConfig),
    };
    return requestConfig;
  });

  client.interceptors.response.use(
    (response) => {
      recordRequestTelemetry(response.config, response);
      return response;
    },
    (error) => {
      if (error?.config) {
        recordRequestTelemetry(error.config, error, error?.response?.status ?? 0);
      }
      return Promise.reject(error);
    },
  );
}

function withAuditConfig(config = {}, options = {}) {
  if (!options?.initiator) return config;
  return {
    ...config,
    progresspalInitiator: options.initiator,
  };
}

attachDevRequestTelemetry();

function shouldRedirectUnauthorized() {
  if (typeof window === 'undefined') return false;
  return !AUTH_ROUTE_PATHS.has(window.location.pathname);
}

function attachUnauthorizedRedirect() {
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (
        error?.response?.status === 401
        && shouldRedirectUnauthorized()
        && !unauthorizedRedirectInFlight
      ) {
        unauthorizedRedirectInFlight = true;
        clearKeycloakSession();
        clearStoredUser();
        window.location.replace('/login');
      }
      return Promise.reject(error);
    },
  );
}

attachUnauthorizedRedirect();

function toErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readAuthState() {
  const auth = safeParse(localStorage.getItem(AUTH_STORAGE_KEY));
  if (auth && auth.user && auth.user.id) {
    return {
      user: auth.user,
      token: typeof auth.token === 'string' && auth.token.trim() ? auth.token.trim() : null,
    };
  }

  const legacyUser = safeParse(localStorage.getItem(USER_STORAGE_KEY));
  if (legacyUser && legacyUser.id) {
    return { user: legacyUser, token: null };
  }

  return null;
}

function persistAuthState(state) {
  if (!state || !state.user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('progresspal-auth-changed'));
    }
    return;
  }

  const normalized = {
    user: state.user,
    token: typeof state.token === 'string' && state.token.trim() ? state.token.trim() : null,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized.user));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('progresspal-auth-changed'));
  }
}

function authHeaders(userId) {
  const state = readAuthState();
  if (state?.token) {
    return { Authorization: `Bearer ${state.token}` };
  }

  const fallbackUserId = userId || state?.user?.id;
  if (fallbackUserId) {
    return { 'X-User-Id': fallbackUserId };
  }

  return {};
}

export function getStoredAuth() {
  return readAuthState();
}

export function getStoredAuthToken() {
  return readAuthState()?.token || null;
}

export function getStoredUser() {
  return readAuthState()?.user || null;
}

export function setStoredUser(user, token = null) {
  persistAuthState({ user, token });
}

export function setStoredAuthToken(token) {
  const state = readAuthState();
  if (!state?.user) return;
  persistAuthState({ user: state.user, token });
}

export function clearStoredUser() {
  persistAuthState(null);
}

export async function signupUser(payload) {
  try {
    const { data } = await client.post('/users', payload);
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Signup failed'));
  }
}

export async function loginUser(email, password) {
  try {
    const { data } = await client.post('/auth/login', { email, password });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Login failed'));
  }
}

export async function loginUserByEmail(email, password) {
  const auth = await loginUser(email, password);
  return auth.user;
}

export async function getFeed(userId, page = 0, size = 10, options = {}) {
  try {
    const { data } = await client.get('/feed', withAuditConfig({
      headers: {
        ...authHeaders(userId),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      params: {
        page,
        size,
        _t: Date.now(),
      },
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load feed'));
  }
}

export async function getActivityTypes(userId, scope = 'ALL', options = {}) {
  try {
    const { data } = await client.get('/activity-types', withAuditConfig({
      headers: authHeaders(userId),
      params: { scope },
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load activity types'));
  }
}

export async function createActivityType(userId, payload) {
  try {
    const { data } = await client.post('/activity-types', payload, {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to create activity type'));
  }
}

export async function updateActivityType(id, payload) {
  try {
    const { data } = await client.put(`/activity-types/${id}`, payload);
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to update activity type'));
  }
}

export async function deleteActivityType(userId, id) {
  try {
    await client.delete(`/activity-types/${id}`, {
      headers: authHeaders(userId),
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to delete activity type'));
  }
}

export async function getLiveSession(userId, options = {}) {
  try {
    const response = await client.get('/sessions/live', withAuditConfig({
      headers: authHeaders(userId),
      validateStatus: (status) => status === 200 || status === 204,
    }, options));
    return response.status === 204 ? null : response.data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load live session'));
  }
}

export async function createSession(userId, payload) {
  try {
    const { data } = await client.post('/sessions', payload, {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to start session'));
  }
}

export async function stopSession(userId, sessionId, payload = {}) {
  try {
    const { data } = await client.patch(
      `/sessions/${sessionId}/stop`,
      payload,
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to stop session'));
  }
}

export async function pauseSession(userId, sessionId) {
  try {
    const { data } = await client.patch(
      `/sessions/${sessionId}/pause`,
      null,
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to pause session'));
  }
}

export async function resumeSession(userId, sessionId) {
  try {
    const { data } = await client.patch(
      `/sessions/${sessionId}/resume`,
      null,
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to resume session'));
  }
}

export async function sendSessionHeartbeat(userId, sessionId, options = {}) {
  try {
    await client.patch(
      `/sessions/${sessionId}/heartbeat`,
      null,
      withAuditConfig({
        headers: authHeaders(userId),
        validateStatus: (status) => status === 204,
      }, options),
    );
  } catch (error) {
    const heartbeatError = new Error(toErrorMessage(error, 'Failed to send session heartbeat'));
    heartbeatError.status = error?.response?.status;
    throw heartbeatError;
  }
}

export async function updateSessionGoal(userId, sessionId, payload) {
  try {
    const { data } = await client.patch(
      `/sessions/${sessionId}/goal`,
      payload,
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to update session goal'));
  }
}

export async function updateSessionProgress(userId, sessionId, payload) {
  try {
    const { data } = await client.patch(
      `/sessions/${sessionId}/progress`,
      payload,
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to update session progress'));
  }
}

export async function submitSessionJoinRequest(userId, sessionId) {
  try {
    const { data } = await client.post(
      `/sessions/${sessionId}/join-requests`,
      null,
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to submit join request'));
  }
}

export async function getOutgoingSessionJoinRequests(userId, filters = {}, options = {}) {
  try {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.liveOnly !== undefined && filters.liveOnly !== null) {
      params.liveOnly = Boolean(filters.liveOnly);
    }
    if (filters.liveOnly === undefined && filters.status === undefined) {
      params.liveOnly = true;
    }

    const { data } = await client.get('/me/join-requests/outgoing', withAuditConfig({
      headers: authHeaders(userId),
      params,
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load outgoing join requests'));
  }
}

export async function getIncomingSessionJoinRequests(userId, sessionId, options = {}) {
  try {
    const { data } = await client.get(`/sessions/${sessionId}/join-requests/incoming`, withAuditConfig({
      headers: authHeaders(userId),
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load incoming join requests'));
  }
}

export async function decideSessionJoinRequest(userId, sessionId, requestId, decision) {
  try {
    const { data } = await client.patch(
      `/sessions/${sessionId}/join-requests/${requestId}`,
      { decision },
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to update join request'));
  }
}

export async function getSessionRoomState(userId, sessionId, options = {}) {
  try {
    const { data } = await client.get(`/sessions/${sessionId}/room`, withAuditConfig({
      headers: authHeaders(userId),
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load room state'));
  }
}

export async function getSessionRoomMessages(userId, sessionId, page = 0, size = 50, options = {}) {
  try {
    const { data } = await client.get(`/sessions/${sessionId}/room/messages`, withAuditConfig({
      headers: authHeaders(userId),
      params: { page, size },
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load room messages'));
  }
}

export async function postSessionRoomMessage(userId, sessionId, content) {
  try {
    const { data } = await client.post(
      `/sessions/${sessionId}/room/messages`,
      { content },
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to send room message'));
  }
}

export async function getMySessions(userId, filters = {}, options = {}) {
  try {
    const params = {};
    const allowedKeys = ['page', 'size', 'from', 'to', 'activityTypeId', 'visibility', 'status'];

    allowedKeys.forEach((key) => {
      const value = filters[key];
      if (value === undefined || value === null || value === '') return;
      params[key] = value;
    });

    const { data } = await client.get('/me/sessions', withAuditConfig({
      headers: authHeaders(userId),
      params,
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load your sessions'));
  }
}

export async function getMyDashboardSummary(userId, filters = {}) {
  try {
    const params = {};
    ['from', 'to'].forEach((key) => {
      const value = filters[key];
      if (value === undefined || value === null || value === '') return;
      params[key] = value;
    });

    const { data } = await client.get('/me/dashboard/summary', {
      headers: authHeaders(userId),
      params,
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load dashboard summary'));
  }
}

export async function getMyDashboardByActivityType(userId, filters = {}) {
  try {
    const params = {};
    ['from', 'to'].forEach((key) => {
      const value = filters[key];
      if (value === undefined || value === null || value === '') return;
      params[key] = value;
    });

    const { data } = await client.get('/me/dashboard/by-activity-type', {
      headers: authHeaders(userId),
      params,
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load activity type breakdown'));
  }
}

export async function getMyDashboardTrends(userId, filters = {}) {
  try {
    const params = {};
    const allowedKeys = ['from', 'to', 'bucket', 'activityTypeId'];
    allowedKeys.forEach((key) => {
      const value = filters[key];
      if (value === undefined || value === null || value === '') return;
      params[key] = value;
    });

    const { data } = await client.get('/me/dashboard/trends', {
      headers: authHeaders(userId),
      params,
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load trends'));
  }
}

export async function getFriends(userId) {
  try {
    const { data } = await client.get('/friends', {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load friends'));
  }
}

export async function getUserProfile(userId, targetUserId) {
  try {
    const { data } = await client.get(`/users/${targetUserId}/profile`, {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load user profile'));
  }
}

export async function getFriendSuggestions(userId, limit = 10) {
  try {
    const { data } = await client.get('/friends/suggestions', {
      headers: authHeaders(userId),
      params: { limit },
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load friend suggestions'));
  }
}

export async function searchUsersByUsername(query, userId = null) {
  try {
    const { data } = await client.get('/users/search', {
      headers: authHeaders(userId),
      params: { q: query },
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to search users'));
  }
}

export async function sendFriendRequest(userId, receiverId) {
  try {
    await client.post('/friends/send', null, {
      headers: authHeaders(userId),
      params: { receiverId },
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to send friend request'));
  }
}

export async function acceptFriendRequest(userId, requesterId) {
  try {
    await client.patch('/friends/accept', null, {
      headers: authHeaders(userId),
      params: { requesterId },
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to accept friend request'));
  }
}

export async function rejectFriendRequest(userId, requesterId) {
  try {
    await client.patch('/friends/reject', null, {
      headers: authHeaders(userId),
      params: { requesterId },
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to reject friend request'));
  }
}

export async function deleteFriend(userId, friendId) {
  try {
    await client.delete(`/friends/${friendId}`, {
      headers: authHeaders(userId),
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to delete friend'));
  }
}

export async function getIncomingFriendRequests(userId) {
  try {
    const { data } = await client.get('/friends/requests/incoming', {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load incoming requests'));
  }
}

export async function getMyAccount(userId) {
  try {
    const { data } = await client.get('/me/account', {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load account'));
  }
}

export async function hydrateAccountFromToken(token) {
  try {
    const { data } = await client.get('/me/account', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to hydrate your account'));
  }
}

export async function updateMyAccount(userId, payload) {
  try {
    const { data } = await client.patch('/me/account', payload, {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to update account'));
  }
}

function buildNotificationScopeParams(baseParams = {}, options = {}) {
  const params = { ...baseParams };
  if (options.scope) params.scope = options.scope;
  return params;
}

export async function getMyNotifications(userId, page = 0, size = 12, options = {}) {
  try {
    const { data } = await client.get('/me/notifications', withAuditConfig({
      headers: authHeaders(userId),
      params: buildNotificationScopeParams({ page, size }, options),
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load notifications'));
  }
}

export async function getUnreadNotificationsCount(userId, options = {}) {
  try {
    const { data } = await client.get('/me/notifications/unread-count', withAuditConfig({
      headers: authHeaders(userId),
      params: buildNotificationScopeParams({}, options),
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load unread notifications'));
  }
}

export async function markNotificationRead(userId, notificationId) {
  try {
    const { data } = await client.patch(`/me/notifications/${notificationId}/read`, null, {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to mark notification as read'));
  }
}

export async function markAllNotificationsRead(userId, options = {}) {
  try {
    const params = buildNotificationScopeParams({}, options);
    if (options.resourceId) params.resourceId = options.resourceId;
    await client.patch('/me/notifications/read-all', null, {
      headers: authHeaders(userId),
      params,
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to mark all notifications as read'));
  }
}

export async function clearMyNotifications(userId) {
  try {
    await client.delete('/me/notifications', {
      headers: authHeaders(userId),
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to clear notifications'));
  }
}

export async function getSessionLikes(userId, sessionId, options = {}) {
  try {
    const { data } = await client.get(`/sessions/${sessionId}/likes`, withAuditConfig({
      headers: authHeaders(userId),
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load likes'));
  }
}

export async function likeSession(userId, sessionId) {
  try {
    const { data } = await client.put(`/sessions/${sessionId}/likes`, null, {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to like session'));
  }
}

export async function unlikeSession(userId, sessionId) {
  try {
    const { data } = await client.delete(`/sessions/${sessionId}/likes`, {
      headers: authHeaders(userId),
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to unlike session'));
  }
}

export async function getSessionComments(userId, sessionId, options = {}) {
  try {
    const { data } = await client.get(`/sessions/${sessionId}/comments`, withAuditConfig({
      headers: authHeaders(userId),
    }, options));
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load comments'));
  }
}

export async function createSessionComment(userId, sessionId, comment) {
  const payload = typeof comment === 'string'
    ? { content: comment }
    : {
      content: comment?.content,
      ...(comment?.parentCommentId != null ? { parentCommentId: comment.parentCommentId } : {}),
      ...(comment?.replyToCommentId != null ? { replyToCommentId: comment.replyToCommentId } : {}),
    };

  try {
    const { data } = await client.post(
      `/sessions/${sessionId}/comments`,
      payload,
      { headers: authHeaders(userId) },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to add comment'));
  }
}
