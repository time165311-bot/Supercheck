import { auth } from './firebase';

interface SessionCache {
  token: string;
  expiresAt: number;
}

let cachedSession: SessionCache | null = null;
let inflightSessionPromise: Promise<string> | null = null;

export function clearCachedApiSessionToken(): void {
  cachedSession = null;
}

async function fetchServerSessionToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedSession && cachedSession.expiresAt - 30_000 > now) {
    return cachedSession.token;
  }

  if (!forceRefresh && inflightSessionPromise) {
    return inflightSessionPromise;
  }

  inflightSessionPromise = (async () => {
    try {
      // If a real Firebase user is authenticated, prefer their Firebase ID token first
      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken(forceRefresh);
          if (idToken) {
            return idToken;
          }
        } catch {
          // Fallback to server session token
        }
      }

      const res = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        return '';
      }

      const data = await res.json();
      if (data?.token) {
        cachedSession = {
          token: String(data.token),
          expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : Date.now() + 3600_000,
        };
        return cachedSession.token;
      }
      return '';
    } catch {
      return '';
    } finally {
      inflightSessionPromise = null;
    }
  })();

  return inflightSessionPromise;
}

/**
 * Returns HTTP headers with Bearer token for protected /api/ai/* and /api/fhir/* routes.
 */
export async function getApiAuthHeaders(
  forceRefresh: boolean = false
): Promise<Record<string, string>> {
  const token = await fetchServerSessionToken(forceRefresh);
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Wrapper around fetch() that automatically injects auth headers + same-origin cookies
 * and retries once on HTTP 401 by refreshing the session token.
 */
export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const buildInit = async (forceRefresh: boolean): Promise<RequestInit> => {
    const authHeaders = await getApiAuthHeaders(forceRefresh);
    const mergedHeaders = new Headers(init.headers || {});
    Object.entries(authHeaders).forEach(([k, v]) => {
      if (!mergedHeaders.has(k)) {
        mergedHeaders.set(k, v);
      }
    });
    return {
      ...init,
      credentials: init.credentials || 'same-origin',
      headers: mergedHeaders,
    };
  };

  let res = await fetch(input, await buildInit(false));
  if (res.status === 401) {
    clearCachedApiSessionToken();
    res = await fetch(input, await buildInit(true));
  }
  return res;
}

export interface AuraChatAttachment {
  index?: number;
  base64: string;
  mimeType: string;
  fileName?: string;
}

export interface AuraChatRequestPayload {
  message?: string;
  messages?: Array<{ role: 'user' | 'assistant'; text: string }>;
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  channelName?: string;
  liveContext?: Record<string, any>;
  context?: Record<string, any>;
  systemContext?: string;
  attachment?: AuraChatAttachment;
  attachments?: AuraChatAttachment[];
}

export async function sendAuraChatRequest(
  payload: AuraChatRequestPayload,
  signal?: AbortSignal
): Promise<Response> {
  return authorizedFetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}
