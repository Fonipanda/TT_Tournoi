/**
 * Helpers fetch JSON pour l'admin avec gestion d'erreurs unifiée.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function apiJson<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `HTTP ${res.status}`) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return apiJson<T>(url, { method: 'GET' });
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  return apiJson<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
}

export async function apiPatch<T>(url: string, data: unknown): Promise<T> {
  return apiJson<T>(url, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function apiDelete(url: string): Promise<void> {
  await apiJson(url, { method: 'DELETE' });
}
