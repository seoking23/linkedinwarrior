/**
 * storage.js — Session persistence via localStorage
 * No database needed. Results survive page refresh for demo day.
 */

const SESSION_KEY = "linkedin_warrior_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function saveSession(data) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() })
    );
  } catch (e) {
    console.warn("Could not save session:", e);
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after TTL
    if (Date.now() - data.savedAt > SESSION_TTL_MS) {
      clearSession();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function updateSession(patch) {
  const current = loadSession() || {};
  saveSession({ ...current, ...patch });
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// GitHub token — memory only, never persisted beyond session
let _githubToken = null;
export function setGithubToken(token) { _githubToken = token; }
export function getGithubToken() { return _githubToken; }
export function clearGithubToken() { _githubToken = null; }
