/**
 * config.js — Switch between Cloud Shell backend (Mode A) and client-side Gemini (Mode B)
 *
 * Mode A (Cloud Shell): set API base via URL param or localStorage
 *   ?api=https://8080-cs-xxxx.cs.us-central1.cloudshell.dev
 *   localStorage.setItem('api_base', 'https://...')
 *
 * Mode B (client-side): api_base is null → call Gemini directly from browser
 */

export function getApiBase() {
  const param = new URLSearchParams(window.location.search).get("api");
  if (param) {
    localStorage.setItem("api_base", param);
    return param.replace(/\/$/, "");
  }
  const stored = localStorage.getItem("api_base");
  if (stored) return stored.replace(/\/$/, "");
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

/**
 * Unified fetch wrapper — routes to server or client-side based on mode.
 * Used by UI components so they don't need to know which mode is active.
 */
export async function apiPost(path, body) {
  const base = getApiBase();
  if (!base) throw new Error("No API base set — use client-side mode directly");

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function apiGet(path) {
  const base = getApiBase();
  if (!base) throw new Error("No API base set");
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}
