/**
 * config.js — Switch between Cloud Shell backend (Mode A) and client-side Gemini (Mode B)
 *
 * Mode A (Cloud Shell): set API base via URL param or localStorage
 *   ?api=https://8080-cs-xxxx.cs.us-central1.cloudshell.dev
 *   localStorage.setItem('api_base', 'https://...')
 *
 * Mode B (client-side): api_base is null → call Gemini directly from browser
 */

const FETCH_TIMEOUT_MS = 45000;

function normalizeApiBase(url) {
  return url.replace(/\/$/, "");
}

export function getApiBase() {
  const param = new URLSearchParams(window.location.search).get("api");
  if (param) {
    localStorage.setItem("api_base", normalizeApiBase(param));
    return normalizeApiBase(param);
  }

  const stored = localStorage.getItem("api_base");
  if (stored) return normalizeApiBase(stored);

  // Injected at deploy time by scripts/inject-frontend-config.py (GitHub Actions)
  if (window._API_BASE) return normalizeApiBase(window._API_BASE);

  return null; // → client-side Mode B
}

export function setApiBase(url) {
  if (url) {
    localStorage.setItem("api_base", url.replace(/\/$/, ""));
  } else {
    localStorage.removeItem("api_base");
  }
}

export function getMode() {
  return getApiBase() ? "server" : "client";
}

function tagged(kind, message) {
  const e = new Error(message);
  e.kind = kind;
  return e;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e.name === "AbortError") throw tagged("network", `Request timed out after ${timeoutMs / 1000}s`);
    throw tagged("network", e.message || "Network error");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unified fetch wrapper — routes to server or client-side based on mode.
 * Used by UI components so they don't need to know which mode is active.
 * Throws tagged errors: e.kind = 'network' (timeout/DNS/refused) or 'http' (4xx/5xx).
 * Network errors are retried once before bubbling up.
 */
export async function apiPost(path, body) {
  const base = getApiBase();
  if (!base) throw tagged("config", "No API base set — use client-side mode directly");

  const doFetch = () =>
    fetchWithTimeout(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res;
  try {
    res = await doFetch();
  } catch (e) {
    if (e.kind === "network") {
      console.warn(`config.js: ${path} network failure, retrying once:`, e.message);
      res = await doFetch();
    } else {
      throw e;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw tagged("http", err.detail || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function apiGet(path) {
  const base = getApiBase();
  if (!base) throw tagged("config", "No API base set");
  const res = await fetchWithTimeout(`${base}${path}`);
  if (!res.ok) throw tagged("http", `Server error: ${res.status}`);
  return res.json();
}

/**
 * Run server-side via apiPost when a backend is configured; on network failure
 * (timeout / DNS / refused), automatically fall back to the client-side function.
 * HTTP errors (4xx/5xx) still bubble up — those are the server's, not the network's.
 */
export async function apiPostWithFallback(path, body, clientFallbackFn) {
  if (!getApiBase()) return clientFallbackFn();
  try {
    return await apiPost(path, body);
  } catch (e) {
    if (e.kind === "network" && typeof clientFallbackFn === "function") {
      console.warn(`config.js: backend ${path} unreachable, falling back to client-side`);
      return clientFallbackFn();
    }
    throw e;
  }
}
