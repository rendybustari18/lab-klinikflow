// KlinikFlow API Client Helper

const API_BASE = '/api';

export function clearToken(): void {
  localStorage.removeItem('klinikflow_token');
  localStorage.removeItem('klinikflow_user');
}

export function getCurrentUser(): any | null {
  const userJson = localStorage.getItem('klinikflow_user');
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: any): void {
  localStorage.setItem('klinikflow_user', JSON.stringify(user));
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const csrf = document.cookie.split('; ').find((cookie) => cookie.startsWith('klinikflow_csrf='));
  if (csrf) {
    headers.set('X-CSRF-Token', csrf.substring('klinikflow_csrf='.length));
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = await res.json().catch(() => ({ success: false, error: 'Respons server tidak valid' }));

  if (!res.ok && !data.error) {
    data.error = `Error ${res.status}: ${res.statusText}`;
  }
  if (!res.ok) data.status = res.status;

  return data;
}

