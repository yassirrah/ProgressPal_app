import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const USER_STORAGE_KEY = 'progresspal_user';

const client = axios.create({
  baseURL: API_BASE_URL,
});

function toErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_STORAGE_KEY);
}

export async function signupUser(payload) {
  try {
    const { data } = await client.post('/users', payload);
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Signup failed'));
  }
}

export async function loginUserByEmail(email) {
  try {
    const { data } = await client.get('/users');
    const user = data.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('No user found with that email');
    }
    return user;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(toErrorMessage(error, 'Login failed'));
  }
}

export async function getFeed(userId, page = 0, size = 10) {
  try {
    const { data } = await client.get('/feed', {
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
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

export async function getLiveSession(userId) {
  try {
    const response = await client.get('/sessions/live', {
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
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
      { headers: { 'X-User-Id': userId } },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to stop session'));
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
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
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
      headers: { 'X-User-Id': userId },
      params: { receiverId },
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to send friend request'));
  }
}

export async function acceptFriendRequest(userId, requesterId) {
  try {
    await client.patch('/friends/accept', null, {
      headers: { 'X-User-Id': userId },
      params: { requesterId },
    });
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to accept friend request'));
  }
}

export async function getIncomingFriendRequests(userId) {
  try {
    const { data } = await client.get('/friends/requests/incoming', {
      headers: { 'X-User-Id': userId },
    });
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to load incoming requests'));
  }
}
