/**
 * Thin fetch wrapper around the ERP REST API. Every micro frontend uses this,
 * so there is one place to add auth headers later (e.g. a JWT).
 * __API_URL__ is injected by webpack's DefinePlugin (env API_URL).
 */
const BASE = typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'http://localhost:4000/api';

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the ERP API. Is the server running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};
