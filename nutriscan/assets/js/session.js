/** Client auth session for VerdiScan */

const TOKEN_KEY = 'verdiscan_token';
const USER_KEY = 'verdiscan_user';

let currentUser = null;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  currentUser = user;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser = null;
}

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: authHeaders({
      'content-type': 'application/json',
      ...(options.headers || {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function refreshMe() {
  const token = getToken();
  if (!token) {
    currentUser = null;
    return null;
  }
  try {
    const { res, data } = await api('/api/auth/me');
    // Solo cerrar sesión si el token es inválido — no por errores de red/5xx
    if (res.status === 401 || res.status === 403) {
      clearSession();
      return null;
    }
    if (!res.ok) {
      return currentUser; // mantener sesión cacheada
    }
    currentUser = data.user;
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    return currentUser;
  } catch {
    return currentUser;
  }
}

export async function register(email, password, signupCode) {
  const { res, data } = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, signupCode }),
  });
  if (!res.ok) return { error: data.error || 'REGISTER_FAILED' };
  saveSession(data.token, data.user);
  return { user: data.user };
}

export async function login(email, password) {
  const { res, data } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { error: data.error || 'LOGIN_FAILED' };
  saveSession(data.token, data.user);
  return { user: data.user };
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  clearSession();
}

export async function startCheckout() {
  const { res, data } = await api('/api/billing/checkout', { method: 'POST' });
  if (!res.ok) return { error: data.error || 'CHECKOUT_FAILED' };
  if (data.url) window.location.href = data.url;
  return { ok: true };
}

export function hydrateUserFromCache() {
  const cached = localStorage.getItem(USER_KEY);
  if (!cached) return null;
  try {
    currentUser = JSON.parse(cached);
    return currentUser;
  } catch {
    return null;
  }
}

export function canScanLocally(user = currentUser) {
  if (!user) user = hydrateUserFromCache();
  if (!user) {
    // Logged in but profile not loaded yet — don't block the camera
    return Boolean(getToken());
  }
  if (user.paid || user.unlimited) return true;
  return (user.scansRemaining ?? 0) > 0;
}

export function updateUserFromAccount(account) {
  if (!account) return;
  currentUser = { ...(currentUser || {}), ...account };
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
}

export async function initSession() {
  hydrateUserFromCache();
  return refreshMe();
}
