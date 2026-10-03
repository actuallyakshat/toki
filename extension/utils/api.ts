import { authItem, settingsItem } from './storage';
import type { Profile, RefreshResult, RefreshTask, User, WishList } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the bearer token (sign-in). */
  anonymous?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<{ status: number; data: T }> {
  const [{ apiOrigin }, auth] = await Promise.all([settingsItem.getValue(), authItem.getValue()]);
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && !options.anonymous) headers.Authorization = `Bearer ${auth.token}`;

  let response: Response;
  try {
    response = await fetch(`${apiOrigin}/api${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Toki could not reach the server. Check your connection and try again.');
  }

  const text = response.status === 204 ? '' : await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (response.status === 401 && auth && !options.anonymous) await authItem.setValue(null);
    throw new ApiError(
      response.status,
      error?.code ?? 'internal',
      error?.message ?? 'Something went wrong on the server. Try again in a moment.',
    );
  }
  return { status: response.status, data: data as T };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  async signIn(email: string, password: string) {
    const { data } = await request<{ token: string; user: User }>('/auth/token', {
      body: { email, password },
      anonymous: true,
    });
    return data;
  },
  async me() {
    return (await request<{ user: User; profile: Profile }>('/me')).data;
  },
  async lists() {
    return (await request<{ lists: WishList[] }>('/lists')).data.lists;
  },
  addItem(body: { url: string; list_id?: string; capture?: unknown; target_price_minor?: number }) {
    return request<unknown>('/items', { body });
  },
  async refreshTasks(limit: number) {
    return (await request<{ tasks: RefreshTask[] }>(`/extension/refresh-tasks?limit=${limit}`)).data.tasks;
  },
  async refreshResults(results: RefreshResult[]) {
    await request('/extension/refresh-results', { body: { results } });
  },
};
