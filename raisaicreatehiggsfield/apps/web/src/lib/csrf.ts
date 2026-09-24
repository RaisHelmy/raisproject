export function readCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)rais_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : undefined;
}

/** Merge CSRF header into fetch init for mutating requests made outside `api()`. */
export function withCsrf(init: RequestInit = {}): RequestInit {
  const token = readCsrfToken();
  return { ...init, headers: { ...(init.headers ?? {}), ...(token ? { "x-csrf-token": token } : {}) } };
}
