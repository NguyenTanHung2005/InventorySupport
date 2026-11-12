import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ApiError } from '../services/api';
import { aiService } from '../services/ai.service';
import { AssistantAction, AssistantProduct } from '../types';
import { useAuth } from './auth.store';

export type ActionStatus = 'pending' | 'done' | 'dismissed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'notice';
  text: string;
  products?: AssistantProduct[];
  actions?: AssistantAction[];
  toolCalls?: { name: string; summary: string }[];
  provider?: 'claude' | 'offline';
  error?: boolean;
}

interface AssistantStore {
  messages: ChatMessage[];
  sending: boolean;
  turn: number;
  maxTurns: number;
  actionStatus: Record<string, ActionStatus>;
  send: (text: string) => Promise<void>;
  reset: () => Promise<void>;
  setActionStatus: (id: string, status: ActionStatus) => void;
}

const AssistantContext = createContext<AssistantStore | undefined>(undefined);
let counter = 0;
const nextId = () => `msg-${Date.now()}-${counter++}`;

/**
 * Giữ lịch sử chat trong suốt phiên đăng nhập (rời màn hình không mất).
 * Lịch sử đầy đủ cho model nằm ở server; ở đây chỉ là phần hiển thị.
 * Provider được gắn `key={user.id}` nên đăng xuất / đổi tài khoản sẽ xóa sạch.
 */
export function AssistantProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [turn, setTurn] = useState(0);
  const [maxTurns, setMaxTurns] = useState(30);
  const [actionStatus, setActionStatusMap] = useState<Record<string, ActionStatus>>({});
  const sessionId = useRef<string | undefined>(undefined);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!token || !message || sending) return;
      setSending(true);
      setMessages((current) => [...current, { id: nextId(), role: 'user', text: message }]);
      try {
        let reply;
        try {
          reply = await aiService.chat(token, message, sessionId.current);
        } catch (error) {
          // Phiên hết hạn hoặc server khởi động lại: tự bắt đầu phiên mới và hỏi lại.
          if (!(error instanceof ApiError && error.status === 404 && sessionId.current)) throw error;
          sessionId.current = undefined;
          setMessages((current) => [...current, { id: nextId(), role: 'notice', text: 'Phiên cũ đã hết hạn, đã bắt đầu cuộc trò chuyện mới.' }]);
          reply = await aiService.chat(token, message);
        }
        sessionId.current = reply.sessionId;
        setTurn(reply.turn);
        setMaxTurns(reply.maxTurns);
        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: 'assistant',
            text: reply.reply,
            products: reply.products,
            actions: reply.actions,
            toolCalls: reply.toolCalls,
            provider: reply.provider,
          },
        ]);
      } catch (error) {
        setMessages((current) => [...current, { id: nextId(), role: 'assistant', text: (error as Error).message, error: true }]);
      } finally {
        setSending(false);
      }
    },
    [token, sending],
  );

  const reset = useCallback(async () => {
    const id = sessionId.current;
    sessionId.current = undefined;
    setMessages([]);
    setTurn(0);
    setActionStatusMap({});
    if (token && id) await aiService.resetSession(token, id).catch(() => undefined);
  }, [token]);

  const setActionStatus = useCallback((id: string, status: ActionStatus) => {
    setActionStatusMap((current) => ({ ...current, [id]: status }));
  }, []);

  const value = useMemo(
    () => ({ messages, sending, turn, maxTurns, actionStatus, send, reset, setActionStatus }),
    [messages, sending, turn, maxTurns, actionStatus, send, reset, setActionStatus],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error('useAssistant must be used inside AssistantProvider');
  return context;
}
