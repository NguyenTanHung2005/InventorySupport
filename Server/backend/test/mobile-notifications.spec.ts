import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ os: 'android', expoGo: true, handler: vi.fn() }));
vi.mock('../../../App/InventorySupport/node_modules/react-native', () => ({ Platform: { get OS() { return state.os; } } }));
vi.mock('../../../App/InventorySupport/node_modules/expo', () => ({ isRunningInExpoGo: () => state.expoGo }));
vi.mock('../../../App/InventorySupport/node_modules/expo-notifications', () => ({ setNotificationHandler: state.handler }));
import { loadNativeNotifications } from '../../../App/InventorySupport/src/services/native-notifications';

beforeEach(() => { state.os = 'android'; state.expoGo = true; state.handler.mockClear(); });
describe('native notification availability', () => {
  it('does not load native notifications in Expo Go', async () => {
    expect(await loadNativeNotifications()).toBeUndefined();
    expect(state.handler).not.toHaveBeenCalled();
  });
  it('keeps native notifications in development/standalone builds', async () => {
    state.expoGo = false;
    expect(await loadNativeNotifications()).toBeDefined();
    expect(state.handler).toHaveBeenCalledOnce();
  });
  it('does not load native notifications on web', async () => {
    state.os = 'web'; state.expoGo = false;
    expect(await loadNativeNotifications()).toBeUndefined();
    expect(state.handler).not.toHaveBeenCalled();
  });
});
