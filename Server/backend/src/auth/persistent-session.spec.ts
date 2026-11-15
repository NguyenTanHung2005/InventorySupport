import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storage: { get: vi.fn(), set: vi.fn(), clear: vi.fn() },
  me: vi.fn(),
}));
vi.mock('../../../../App/InventorySupport/src/services/session-storage', () => ({ tokenStorage: mocks.storage }));
vi.mock('../../../../App/InventorySupport/src/services/auth.service', () => ({ authService: { me: mocks.me } }));
vi.mock('../../../../App/InventorySupport/src/constants/config', () => ({ API_URL: 'http://test' }));

const appRoot = '../../../../App/InventorySupport/';
const React = await import(new URL(`${appRoot}node_modules/react/index.js`, import.meta.url).href);
const { renderToStaticMarkup } = await import(new URL(`${appRoot}node_modules/react-dom/server.node.js`, import.meta.url).href);
const apiPath = new URL(`${appRoot}src/services/api.ts`, import.meta.url).href;
const { ApiError } = await import(apiPath);
const storePath = new URL(`${appRoot}src/store/auth.store.tsx`, import.meta.url).href;
const { AuthProvider, useAuth } = await import(storePath);

function mount() {
  let store: ReturnType<typeof useAuth>;
  function Probe() { store = useAuth(); return null; }
  vi.stubGlobal('React', React);
  renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(Probe)));
  return store!;
}

const user = { id: 'u1', name: 'User', email: 'u@test', role: 'STAFF', storeId: 'store-1' };
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('persistent login callbacks', () => {
  it('saves only the token before sign-in succeeds and removes it on sign-out', async () => {
    mocks.storage.set.mockResolvedValue(undefined);
    mocks.storage.clear.mockResolvedValue(undefined);
    const store = mount();
    await store.signIn('token', user);
    expect(mocks.storage.set.mock.calls).toEqual([['token']]);
    await store.signOut();
    expect(mocks.storage.clear).toHaveBeenCalledTimes(1);
  });

  it('validates a saved token with the current server user instead of caching permissions', async () => {
    mocks.storage.get.mockResolvedValue('saved-token');
    mocks.me.mockResolvedValue({ user });
    const store = mount();
    await store.restoreSession();
    expect(mocks.me).toHaveBeenCalledWith('saved-token');
    expect(mocks.storage.clear).not.toHaveBeenCalled();
  });

  it('keeps a saved session on network failure but removes rejected credentials', async () => {
    mocks.storage.get.mockResolvedValue('saved-token');
    mocks.me.mockRejectedValueOnce(new ApiError('offline', 0));
    const store = mount();
    await store.restoreSession();
    expect(mocks.storage.clear).not.toHaveBeenCalled();
    mocks.me.mockRejectedValueOnce(new ApiError('expired', 401));
    await store.restoreSession();
    expect(mocks.storage.clear).toHaveBeenCalledTimes(1);
  });

  it('does not report sign-in success when the token cannot be stored', async () => {
    mocks.storage.set.mockRejectedValueOnce(new Error('storage locked'));
    const store = mount();
    await expect(store.signIn('token', user)).rejects.toThrow(/lưu phiên/);
  });

  it('does not delete a new login when an old restore request later returns 401', async () => {
    let rejectOld!: (error: Error) => void;
    let meStarted!: () => void;
    const started = new Promise<void>(resolve => { meStarted = resolve; });
    mocks.storage.get.mockResolvedValue('old-token');
    mocks.me.mockImplementationOnce(() => { meStarted(); return new Promise((_resolve, reject) => { rejectOld = reject; }); });
    mocks.storage.set.mockResolvedValue(undefined);
    const store = mount();
    const restoring = store.restoreSession();
    await started;
    await store.signIn('new-token', user);
    rejectOld(new ApiError('old expired', 401));
    await restoring;
    expect(mocks.storage.clear).not.toHaveBeenCalled();
    expect(mocks.storage.set).toHaveBeenCalledWith('new-token');
  });

  it('serializes sign-in and logout so a late save cannot survive logout', async () => {
    let finishSave!: () => void;
    mocks.storage.set.mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
    mocks.storage.clear.mockResolvedValue(undefined);
    const store = mount();
    const saved = store.signIn('token', user);
    await Promise.resolve();
    await Promise.resolve();
    const cleared = store.signOut();
    expect(mocks.storage.clear).not.toHaveBeenCalled();
    finishSave();
    await Promise.all([saved, cleared]);
    expect(mocks.storage.clear).toHaveBeenCalledTimes(1);
  });
});
