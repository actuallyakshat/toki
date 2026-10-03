import type {
  AlertRule,
  Capture,
  ErrorCode,
  Item,
  ItemStatus,
  List,
  PricePoint,
  Profile,
  Stats,
  User,
  Visibility,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The app authenticates like the extension: a bearer token from `POST /auth/token` (CONTRACT.md).
 * The session provider keeps this in sync with what is stored on the device.
 */
const connection = {
  origin: "",
  token: null as string | null,
  onUnauthorized: () => {},
};

export function configureApi(next: Partial<typeof connection>) {
  Object.assign(connection, next);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { anonymous?: boolean; origin?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (connection.token && !opts.anonymous) headers.Authorization = `Bearer ${connection.token}`;

  let res: Response;
  try {
    res = await fetch(`${opts.origin ?? connection.origin}/api${path}`, {
      method,
      headers,
      // Only the bearer token identifies the person; never fall back to a cookie left by sign-up.
      credentials: "omit",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "internal", "Toki could not reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    if (res.status === 401 && !opts.anonymous && connection.token) connection.onUnauthorized();
    throw new ApiError(res.status, err?.code ?? "internal", err?.message ?? "Something went wrong. Try again.");
  }
  return data as T;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = (path: string) => request<void>("DELETE", path);

export interface ItemPatch {
  target_price_minor?: number | null;
  alert_rule?: AlertRule;
  note?: string;
  status?: ItemStatus;
  cooling_until?: string | null;
  list_id?: string;
}

export interface NewItem {
  url: string;
  list_id?: string;
  capture?: Capture;
  target_price_minor?: number;
}

export const api = {
  /** Exchanges credentials for a bearer token. `origin` lets sign-in try a server before saving it. */
  token: (b: { email: string; password: string }, origin: string) =>
    request<{ token: string; user: User }>("POST", "/auth/token", b, { anonymous: true, origin }),
  signup: (b: { email: string; password: string; name: string }, origin: string) =>
    request<{ user: User }>("POST", "/auth/signup", b, { anonymous: true, origin }),
  logout: () => post<void>("/auth/logout"),
  me: () => get<{ user: User; profile: Profile }>("/me"),
  updateProfile: (b: Partial<Profile>) => patch<{ profile: Profile }>("/me/profile", b),

  lists: () => get<{ lists: List[] }>("/lists"),
  createList: (b: { name: string; emoji?: string }) => post<List>("/lists", b),
  updateList: (id: string, b: { name?: string; emoji?: string; visibility?: Visibility }) => patch<List>(`/lists/${id}`, b),
  deleteList: (id: string) => del(`/lists/${id}`),
  items: (listId: string, status: ItemStatus | "all" = "wanted") =>
    get<{ items: Item[] }>(`/lists/${listId}/items?status=${status}`),
  reorder: (listId: string, itemIds: string[]) => post<void>(`/lists/${listId}/reorder`, { item_ids: itemIds }),

  extract: (url: string) => post<{ capture: Capture }>("/extract", { url }),
  addItem: (b: NewItem) => post<Item>("/items", b),
  updateItem: (id: string, b: ItemPatch) => patch<Item>(`/items/${id}`, b),
  deleteItem: (id: string) => del(`/items/${id}`),
  history: (id: string, days = 90) => get<{ points: PricePoint[] }>(`/items/${id}/history?days=${days}`),
  refresh: (id: string) => post<Item>(`/items/${id}/refresh`),

  stats: () => get<Stats>("/stats"),
};

export function errorMessage(e: unknown, fallback = "Something went wrong. Try again."): string {
  return e instanceof ApiError ? e.message : fallback;
}
