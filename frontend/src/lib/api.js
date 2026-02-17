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

export async function getFeed(page = 0, size = 10) {
  try {
    const { data } = await client.get('/feed', { params: { page, size } });
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

export async function stopSession(userId, sessionId) {
  try {
    const { data } = await client.patch(
      `/sessions/${sessionId}/stop`,
      {},
      { headers: { 'X-User-Id': userId } },
    );
    return data;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Failed to stop session'));
  }
}
