let API = import.meta.env.VITE_API_URL || '';
if (API && !API.startsWith('http')) API = 'https://' + API;
API = API.replace(/\/+$/, ''); // strip trailing slashes
if (API.endsWith('/api')) API = API.slice(0, -4); // strip trailing /api if user added it

function authHeaders() {
  const token = localStorage.getItem('dg_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
  })
  if (res.status === 401) { localStorage.clear(); window.location.href = '/login'; }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  getRepos: () => apiFetch('/api/repos'),
  getRepoChecks: (owner, name) => apiFetch(`/api/repos/${owner}/${name}/checks`),
  getThresholds:  (owner, name) => apiFetch(`/api/repos/${owner}/${name}/thresholds`),
  updateThresholds: (owner, name, body) =>
    apiFetch(`/api/repos/${owner}/${name}/thresholds`, { method: 'PUT', body: JSON.stringify(body) }),
}
