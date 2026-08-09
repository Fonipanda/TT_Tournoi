/**
 * Helpers fetch JSON pour l'admin avec gestion d'erreurs unifiée.
 *
 * Continuité de session : l'access token expire après 15 minutes. Sur une page
 * restée ouverte (tableau de bord du juge-arbitre, mode TV…), aucune navigation
 * ne vient le renouveler. Un 401 déclenche donc un renouvellement silencieux
 * puis un unique rejeu de la requête ; l'utilisateur n'est déconnecté que si le
 * refresh lui-même n'est plus valable.
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

/**
 * Renouvellement partagé : plusieurs requêtes parallèles qui échouent en 401
 * ne doivent déclencher qu'un seul appel à `/api/auth/refresh`, sinon la
 * rotation des refresh tokens invaliderait la session (rejeu détecté).
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function request(url: string, options: RequestInit): Promise<Response> {
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });
}

export async function apiJson<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let res = await request(url, options);

  // Session peut-être simplement expirée : on tente une remise en session.
  // `/api/auth/refresh` est exclu pour ne pas boucler sur lui-même.
  if (res.status === 401 && !url.startsWith('/api/auth/')) {
    if (await refreshSession()) {
      res = await request(url, options);
    }
  }

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

export async function apiPut<T>(url: string, data: unknown): Promise<T> {
  return apiJson<T>(url, { method: 'PUT', body: JSON.stringify(data) });
}

export async function apiDelete(url: string): Promise<void> {
  await apiJson(url, { method: 'DELETE' });
}
