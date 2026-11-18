let csrfToken = '';
export const setCsrf = (t: string) => { csrfToken = t; };

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: { path: string; message: string }[]) { super(message); }
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erro inesperado.', data.fields);
  return data as T;
}

export async function apiUpload<T = unknown>(path: string, form: FormData, method = 'POST'): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method, credentials: 'same-origin', body: form,
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erro inesperado.', data.fields);
  return data as T;
}
