import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../App/InventorySupport/node_modules/react-native/index.js', () => ({ Text: 'span' }));
vi.mock('../../../../App/InventorySupport/node_modules/@react-navigation/native/lib/module/index.js', () => ({ useNavigation: () => ({ navigate: () => undefined }) }));
vi.mock('../../../../App/InventorySupport/src/constants/config', () => ({ API_URL: 'http://test' }));
vi.mock('../../../../App/InventorySupport/src/components/ProductCard', () => ({ ProductCard: () => null }));
vi.mock('../../../../App/InventorySupport/src/components/ui', async () => {
  const path = new URL('../../../../App/InventorySupport/node_modules/react/index.js', import.meta.url).href;
  const { createElement: h } = await import(path);
  return {
    Card: ({ children }: { children: unknown }) => h('section', null, children),
    Field: ({ label, value }: { label: string; value: string }) => h('label', null, label, h('input', { defaultValue: value })),
    Button: ({ title, disabled }: { title: string; disabled: boolean }) => h('button', { disabled }, title),
  };
});

const reactPath = new URL('../../../../App/InventorySupport/node_modules/react/index.js', import.meta.url).href;
const serverPath = new URL('../../../../App/InventorySupport/node_modules/react-dom/server.node.js', import.meta.url).href;
const cardPath = new URL('../../../../App/InventorySupport/src/components/AiSuggestionCard.tsx', import.meta.url).href;
const React = await import(reactPath);
const { renderToStaticMarkup } = await import(serverPath);
const { AiSuggestionCard, AiResultNotice } = await import(cardPath);
beforeAll(() => vi.stubGlobal('React', React));
afterAll(() => vi.unstubAllGlobals());

const suggestion = { name: 'coca', normalizedName: 'Coca-Cola chai 390ml', description: 'Nước ngọt đóng chai dung tích 390ml.', unit: 'chai', category: 'Nước giải khát', source: 'provider', confidence: 0.9 };
describe('suggestion review card', () => {
  it('renders a distinct editable title and description before applying', () => {
    const html = renderToStaticMarkup(React.createElement(AiSuggestionCard, { suggestion, onApply: () => undefined }));
    expect(html).toContain('Tiêu đề / tên sản phẩm');
    expect(html).toContain('value="Coca-Cola chai 390ml"');
    expect(html).toContain('value="Nước ngọt đóng chai dung tích 390ml."');
    expect(html).toContain('Áp dụng vào form');
  });
  it('requires a confirmed unit and makes offline limitations visible', () => {
    const html = renderToStaticMarkup(React.createElement(AiSuggestionCard, { suggestion: { ...suggestion, unit: '' }, onApply: () => undefined }));
    expect(html).toContain('disabled=""');
    const notice = renderToStaticMarkup(React.createElement(AiResultNotice, { result: { source: 'heuristic', fallbackReason: 'provider_unavailable', suggestions: [] } }));
    expect(notice).toContain('Dịch vụ AI đang lỗi');
    expect(notice).toContain('chưa viết title và mô tả bằng AI');
    expect(notice).toContain('Không nhận diện');
  });
});
