import type { SessionUser } from '../types';

const SESSION_STORAGE_KEY = 'session';
const originalFetch = window.fetch.bind(window);

function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SessionUser;
    return session?.token ? session : null;
  } catch {
    return null;
  }
}

function isInternalApiRequest(input: RequestInfo | URL): boolean {
  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  const url = new URL(rawUrl, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith('/api/');
}

export function installAuthenticatedFetch(): void {
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isInternalApiRequest(input)) return originalFetch(input, init);

    const session = readSession();
    const headers = new Headers(init.headers);
    if (session?.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.token}`);
    }

    const response = await originalFetch(input, { ...init, headers });
    const requestUrl = typeof input === 'string' ? input : input.toString();

    if (response.status === 401 && !requestUrl.includes('/api/auth/login')) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('lavadero:session-expired'));
    }

    return response;
  };
}
