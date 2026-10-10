/** VerdiScan auth — email + password, signup access code, KV storage */

export const FREE_SCANS = 10;
const SESSION_DAYS = 30;

function enc(s) {
  return new TextEncoder().encode(s);
}

function b64(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromB64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256
  );
  return { hash: b64(new Uint8Array(bits)), salt: b64(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const { hash: h } = await hashPassword(password, salt);
  return h === hash;
}

function userKey(email) {
  return `user:${email.trim().toLowerCase()}`;
}

function sessionKey(token) {
  return `session:${token}`;
}

export async function getUser(kv, email) {
  const raw = await kv.get(userKey(email));
  return raw ? JSON.parse(raw) : null;
}

export async function saveUser(kv, user) {
  await kv.put(userKey(user.email), JSON.stringify(user));
}

export async function createSession(kv, email) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = b64(bytes).replace(/[+/=]/g, '');
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  await kv.put(sessionKey(token), JSON.stringify({ email: email.toLowerCase(), exp }), {
    expirationTtl: SESSION_DAYS * 86400,
  });
  return { token, exp };
}

export async function resolveSession(kv, token) {
  if (!token) return null;
  const raw = await kv.get(sessionKey(token));
  if (!raw) return null;
  const s = JSON.parse(raw);
  if (s.exp && Date.now() > s.exp) {
    await kv.delete(sessionKey(token));
    return null;
  }
  const user = await getUser(kv, s.email);
  if (!user) return null;
  return { ...user, token };
}

export async function deleteSession(kv, token) {
  if (token) await kv.delete(sessionKey(token));
}

export function publicUser(user) {
  const remaining = user.paid ? null : Math.max(0, FREE_SCANS - (user.scansUsed || 0));
  return {
    email: user.email,
    scansUsed: user.scansUsed || 0,
    scansLimit: FREE_SCANS,
    scansRemaining: remaining,
    paid: Boolean(user.paid),
    unlimited: Boolean(user.paid),
  };
}

export function canScan(user) {
  if (user.paid) return { allowed: true, reason: 'paid' };
  const used = user.scansUsed || 0;
  if (used >= FREE_SCANS) return { allowed: false, reason: 'quota' };
  return { allowed: true, reason: 'free', remaining: FREE_SCANS - used };
}

export async function consumeScan(kv, user) {
  const check = canScan(user);
  if (!check.allowed) return { ok: false, ...check };
  if (!user.paid) {
    user.scansUsed = (user.scansUsed || 0) + 1;
    await saveUser(kv, user);
  }
  return { ok: true, user: publicUser(user) };
}

export function bearerToken(request) {
  const h = request.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function requireUser(request, env) {
  if (!env.USERS) throw new Error('KV_NOT_BOUND');
  const token = bearerToken(request);
  const user = await resolveSession(env.USERS, token);
  if (!user) return null;
  return user;
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export async function registerUser(env, { email, password, signupCode }) {
  const expected = env.VERDISCAN_SIGNUP_CODE || 'VERDI2026';
  if (String(signupCode || '').trim() !== expected) {
    return { error: 'INVALID_CODE', status: 403 };
  }
  if (!validEmail(email)) return { error: 'INVALID_EMAIL', status: 400 };
  if (!password || String(password).length < 6) {
    return { error: 'WEAK_PASSWORD', status: 400 };
  }

  const normalized = email.trim().toLowerCase();
  const existing = await getUser(env.USERS, normalized);
  if (existing) return { error: 'EMAIL_EXISTS', status: 409 };

  const { hash, salt } = await hashPassword(password);
  const user = {
    email: normalized,
    passwordHash: hash,
    salt,
    scansUsed: 0,
    paid: false,
    createdAt: Date.now(),
  };
  await saveUser(env.USERS, user);
  const session = await createSession(env.USERS, normalized);
  return { user: publicUser(user), token: session.token, exp: session.exp };
}

export async function loginUser(env, { email, password }) {
  if (!validEmail(email)) return { error: 'INVALID_CREDENTIALS', status: 401 };
  const user = await getUser(env.USERS, email);
  if (!user) return { error: 'INVALID_CREDENTIALS', status: 401 };
  const ok = await verifyPassword(password, user.passwordHash, user.salt);
  if (!ok) return { error: 'INVALID_CREDENTIALS', status: 401 };
  const session = await createSession(env.USERS, user.email);
  return { user: publicUser(user), token: session.token, exp: session.exp };
}

export async function markUserPaid(kv, email) {
  const user = await getUser(kv, email);
  if (!user) return false;
  user.paid = true;
  user.paidAt = Date.now();
  await saveUser(kv, user);
  return true;
}
