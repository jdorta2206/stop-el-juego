const API_BASE_URL = "https://www.stopjuegodepalabras.com";
const CLIENT_PLATFORM = "ios";
const CLIENT_VERSION = "1.0.0";
const ANALYTICS_SESSION_ID = `ios_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Client-Platform", CLIENT_PLATFORM);
  headers.set("X-Client-Version", CLIENT_VERSION);
  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body:
      options.body === undefined || options.body instanceof FormData || typeof options.body === "string"
        ? (options.body as BodyInit | null | undefined)
        : JSON.stringify(options.body),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
        ? data.message
        : `Error de API (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export async function analyticsHeartbeat(playerId?: string | null, language?: string | null): Promise<void> {
  try {
    await apiFetch('/api/analytics/heartbeat', {
      method: 'POST',
      body: { sessionId: ANALYTICS_SESSION_ID, playerId: playerId ?? null, language: language ?? null },
    });
  } catch {
    // Analytics must never interfere with gameplay or login.
  }
}

export async function analyticsEvent(input: {
  eventName: string;
  playerId?: string | null;
  language?: string | null;
  mode?: string | null;
  aiDifficulty?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await apiFetch('/api/analytics/event', { method: 'POST', body: { ...input, sessionId: ANALYTICS_SESSION_ID } });
  } catch {
    // Analytics must never interfere with gameplay.
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export { API_BASE_URL, CLIENT_PLATFORM, CLIENT_VERSION, ANALYTICS_SESSION_ID };
