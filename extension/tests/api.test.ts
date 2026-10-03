import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { api, ApiError, request } from '@/utils/api';
import { authItem, normaliseOrigin, settingsItem } from '@/utils/storage';

const user = { id: 'u1', email: 'a@b.in', name: 'A', created_at: '2026-01-01T00:00:00Z' };

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), { status });
}

let fetchMock: ReturnType<typeof vi.fn>;

type Init = { method: string; headers: Record<string, string>; body?: string };
/** The url and init of the nth fetch call. */
function call(n: number): [string, Init] {
  const c = fetchMock.mock.calls[n];
  if (!c) throw new Error(`fetch call ${n} was not made`);
  return c as [string, Init];
}
beforeEach(async () => {
  fakeBrowser.reset();
  await settingsItem.setValue({ apiOrigin: 'https://api.toki.test', webOrigin: 'https://toki.test' });
  await authItem.setValue({ token: 'tok-123', user });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('sends the bearer token and JSON body to the configured origin', async () => {
    fetchMock.mockResolvedValue(respond(201, { id: 'i1' }));
    const res = await request('/items', { body: { url: 'https://x.test' } });
    expect(res).toEqual({ status: 201, data: { id: 'i1' } });
    const [url, init] = call(0);
    expect(url).toBe('https://api.toki.test/api/items');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-123' });
    expect(JSON.parse(init.body ?? '')).toEqual({ url: 'https://x.test' });
  });

  it('defaults to GET without a body and handles 204', async () => {
    fetchMock.mockResolvedValue(respond(204));
    expect(await request('/auth/logout', { method: 'POST' })).toEqual({ status: 204, data: null });
    fetchMock.mockResolvedValue(respond(200, { lists: [] }));
    await request('/lists');
    expect(call(1)[1].method).toBe('GET');
    expect(call(1)[1].headers['Content-Type']).toBeUndefined();
  });

  it('turns contract errors into ApiError', async () => {
    fetchMock.mockResolvedValue(respond(422, { error: { code: 'extract_failed', message: 'No price.' } }));
    const err = await request('/items', { body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'extract_failed', message: 'No price.' });
    expect(await authItem.getValue()).not.toBeNull();
  });

  it('falls back to a generic error for non-JSON bodies', async () => {
    fetchMock.mockResolvedValue(respond(502, '<html>Bad gateway</html>'));
    await expect(request('/me')).rejects.toMatchObject({ status: 502, code: 'internal' });
  });

  it('signs the user out on 401', async () => {
    fetchMock.mockResolvedValue(respond(401, { error: { code: 'unauthorized', message: 'Sign in.' } }));
    await expect(request('/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(await authItem.getValue()).toBeNull();
  });

  it('reports network failures as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/me')).rejects.toMatchObject({ status: 0, code: 'network' });
  });

  it('works signed out with the default origin', async () => {
    fakeBrowser.reset();
    fetchMock.mockResolvedValue(respond(200, { ok: true }));
    await request('/healthz');
    const [url, init] = call(0);
    expect(url).toBe('http://localhost:8080/api/healthz');
    expect(init.headers.Authorization).toBeUndefined();
  });
});

describe('api.signIn', () => {
  it('posts credentials without the old token and keeps auth on a wrong password', async () => {
    fetchMock.mockResolvedValue(respond(200, { token: 'new', user }));
    expect(await api.signIn('a@b.in', 'pw')).toEqual({ token: 'new', user });
    const [url, init] = call(0);
    expect(url).toBe('https://api.toki.test/api/auth/token');
    expect(init.headers.Authorization).toBeUndefined();

    fetchMock.mockResolvedValue(respond(401, { error: { code: 'invalid_credentials', message: 'Wrong.' } }));
    await expect(api.signIn('a@b.in', 'bad')).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(await authItem.getValue()).not.toBeNull();
  });
});

describe('api helpers unwrap responses', () => {
  it('lists, refreshTasks and refreshResults', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { lists: [{ id: 'l1', name: 'Wishlist', item_count: 0 }] }));
    expect(await api.lists()).toEqual([{ id: 'l1', name: 'Wishlist', item_count: 0 }]);

    fetchMock.mockResolvedValueOnce(respond(200, { tasks: [{ product_id: 'p', url: 'u', retailer: 'generic' }] }));
    expect(await api.refreshTasks(3)).toHaveLength(1);
    expect(call(1)[0]).toBe('https://api.toki.test/api/extension/refresh-tasks?limit=3');

    fetchMock.mockResolvedValueOnce(respond(200, { accepted: 1 }));
    await api.refreshResults([{ product_id: 'p', error: 'x' }]);
    expect(JSON.parse(call(2)[1].body ?? '')).toEqual({ results: [{ product_id: 'p', error: 'x' }] });
  });
});

describe('normaliseOrigin', () => {
  it.each([
    ['https://toki.example/some/path?q=1', 'https://toki.example'],
    ['  http://localhost:8080/  ', 'http://localhost:8080'],
    ['ftp://toki.example', null],
    ['toki.example', null],
    ['', null],
  ])('%j → %j', (input, want) => {
    expect(normaliseOrigin(input)).toBe(want);
  });
});
