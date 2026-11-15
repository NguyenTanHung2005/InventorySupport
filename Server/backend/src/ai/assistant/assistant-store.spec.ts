import { afterEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ chat: vi.fn(), resetSession: vi.fn().mockResolvedValue({ deleted: true }) }));
vi.mock('../../../../../App/InventorySupport/src/services/ai.service', () => ({ aiService: api }));
vi.mock('../../../../../App/InventorySupport/src/store/auth.store', () => ({ useAuth: () => ({ token: 'token' }) }));
vi.mock('../../../../../App/InventorySupport/src/constants/config', () => ({ API_URL: 'http://test' }));
const root = '../../../../../App/InventorySupport/';
const React = await import(new URL(`${root}node_modules/react/index.js`, import.meta.url).href);
const { renderToStaticMarkup } = await import(new URL(`${root}node_modules/react-dom/server.node.js`, import.meta.url).href);
const { AssistantProvider, useAssistant } = await import(new URL(`${root}src/store/assistant.store.tsx`, import.meta.url).href);

function mountStore() {
  let store: ReturnType<typeof useAssistant>;
  function Probe() { store = useAssistant(); return null; }
  vi.stubGlobal('React', React);
  renderToStaticMarkup(React.createElement(AssistantProvider, null, React.createElement(Probe)));
  return store!;
}

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('assistant request generations', () => {
  it('ignores an old reply after reset and prevents concurrent sends', async () => {
    let oldReply!: (reply: unknown) => void;
    let newReply!: (reply: unknown) => void;
    api.chat.mockImplementationOnce(() => new Promise(resolve => { oldReply = resolve; }));
    api.chat.mockImplementationOnce(() => new Promise(resolve => { newReply = resolve; }));
    const store = mountStore();
    const first = store.send('old');
    await store.reset();
    const second = store.send('new');
    oldReply({ sessionId: 'old-session', turn: 1, maxTurns: 30, reply: '', provider: 'offline', products: [], actions: [] });
    await first;
    await store.send('duplicate while busy');
    expect(api.chat).toHaveBeenCalledTimes(2);
    newReply({ sessionId: 'new-session', turn: 1, maxTurns: 30, reply: '', provider: 'offline', products: [], actions: [] });
    await second;
    api.chat.mockResolvedValueOnce({ sessionId: 'new-session', turn: 2, maxTurns: 30, reply: '', products: [], actions: [] });
    await store.send('follow-up');
    expect(api.chat.mock.calls[2][2]).toBe('new-session');
  });
});
