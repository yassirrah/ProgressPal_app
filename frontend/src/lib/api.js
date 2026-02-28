import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const USER_STORAGE_KEY = 'progresspal_user';
const AUTH_STORAGE_KEY = 'progresspal_auth';

const client = axios.create({
  baseURL: API_BASE_URL,
});

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
    return;
  }

  const normalized = {
    user: state.user,
    token: typeof state.token === 'string' && state.token.trim() ? state.token.trim() : null,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized.user));
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

export async function getFeed(userId, page = 0, size = 10) {
  try {
    const { data } = await client.get('/feed', {
      headers: authHeaders(userId),
      params: { page, size },
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load feed'));
  }
}

export async function getActivityTypes(userId, scope = 'ALL') {
  try {
    const { data } = await client.get('/activity-types', {
      headers: authHeaders(userId),
      params: { scope },
    });
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

export async function getLiveSession(userId) {
  try {
    const response = await client.get('/sessions/live', {
      headers: authHeaders(userId),
      validateStatus: (status) => status === 200 || status === 204,
    });
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

export async function getMySessions(userId, filters = {}) {
  try {
    const params = {};
    const allowedKeys = ['page', 'size', 'from', 'to', 'activityTypeId', 'visibility', 'status'];

    allowedKeys.forEach((key) => {
      const value = filters[key];
      if (value === undefined || value === null || value === '') return;
      params[key] = value;
    });

    const { data } = await client.get('/me/sessions', {
      headers: authHeaders(userId),
      params,
    });
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

export async function searchUsersByUsername(query) {
  try {
    const { data } = await client.get('/users/search', {
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
