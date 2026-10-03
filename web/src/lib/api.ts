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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "internal", "Toki could not reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
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
  signup: (b: { email: string; password: string; name: string }) => post<{ user: User }>("/auth/signup", b),
  login: (b: { email: string; password: string }) => post<{ user: User }>("/auth/login", b),
  logout: () => post<void>("/auth/logout"),
  me: () => get<{ user: User; profile: Profile }>("/me"),
  updateProfile: (b: Partial<Profile>) => patch<{ profile: Profile }>("/me/profile", b),

  lists: () => get<{ lists: List[] }>("/lists"),
  createList: (b: { name: string; emoji?: string }) => post<List>("/lists", b),
  updateList: (id: string, b: { name?: string; emoji?: string; visibility?: Visibility }) =>
    patch<List>(`/lists/${id}`, b),
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
