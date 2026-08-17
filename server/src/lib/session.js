const crypto = require('node:crypto');
const { db } = require('../db');
const { parseCookies, setCookie, clearCookie } = require('./cookies');

const CUSTOMER_COOKIE = 'mc_customer_session';
const ADMIN_COOKIE = 'mc_admin_session';
const CUSTOMER_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const ADMIN_TTL_SECONDS = 12 * 60 * 60; // 12 hours

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function createSession(res, { subjectType, subjectId, userAgent }) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const ttl = subjectType === 'admin' ? ADMIN_TTL_SECONDS : CUSTOMER_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (token_hash, subject_type, subject_id, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)`
  ).run(tokenHash, subjectType, subjectId, expiresAt, userAgent || null);

  const cookieName = subjectType === 'admin' ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  setCookie(res, cookieName, rawToken, { maxAgeSeconds: ttl });
  return rawToken;
}

function resolveSession(req, subjectType) {
  const cookieName = subjectType === 'admin' ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const cookies = parseCookies(req);
  const rawToken = cookies[cookieName];
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(`SELECT * FROM sessions WHERE token_hash = ? AND subject_type = ?`)
    .get(tokenHash, subjectType);
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
    return null;
  }

  return { subjectId: row.subject_id, tokenHash };
}

function destroySession(req, res, subjectType) {
  const cookieName = subjectType === 'admin' ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const cookies = parseCookies(req);
  const rawToken = cookies[cookieName];
  if (rawToken) {
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(rawToken));
  }
  clearCookie(res, cookieName);
}

function destroyAllSessionsForSubject(subjectType, subjectId) {
  db.prepare(`DELETE FROM sessions WHERE subject_type = ? AND subject_id = ?`).run(subjectType, subjectId);
}

module.exports = {
  CUSTOMER_COOKIE,
  ADMIN_COOKIE,
  createSession,
  resolveSession,
  destroySession,
  destroyAllSessionsForSubject,
};
