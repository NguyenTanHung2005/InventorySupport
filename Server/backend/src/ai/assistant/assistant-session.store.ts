import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { AuthUser } from '../../common/types.js';

/** docs/AI_ASSISTANT.md mục 4.2 */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_TURNS = 30;
export const MAX_SESSIONS_PER_USER = 5;
const RATE_WINDOW_MS = 5 * 60 * 1000;

export interface AssistantSession {
  id: string;
  userId: string;
  storeId: string;
  /** Đóng băng khi tạo phiên - không được sửa (giữ thinking block hợp lệ). */
  readonly system: string;
  readonly tools: Anthropic.Beta.BetaTool[];
  /** Lịch sử CHỈ nối thêm. */
  readonly messages: Anthropic.Beta.BetaMessageParam[];
  turns: number;
  busy: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Lưu phiên trong RAM. Đủ cho một instance backend; nhiều instance cần chuyển sang Redis.
 */
@Injectable()
export class AssistantSessionStore {
  private readonly sessions = new Map<string, AssistantSession>();
  private readonly requests = new Map<string, number[]>();

  create(user: AuthUser, system: string, tools: Anthropic.Beta.BetaTool[]): AssistantSession {
    this.evictExpired();
    const own = [...this.sessions.values()]
      .filter((session) => session.userId === user.id)
      .sort((a, b) => a.updatedAt - b.updatedAt);
    while (own.length >= MAX_SESSIONS_PER_USER) this.sessions.delete(own.shift()!.id);

    const now = Date.now();
    const session: AssistantSession = {
      id: `asst-${randomUUID()}`,
      userId: user.id,
      storeId: user.storeId,
      system,
      tools,
      messages: [],
      turns: 0,
      busy: false,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** Lấy phiên của chính người dùng; phiên của người khác coi như không tồn tại. */
  get(user: AuthUser, id: string): AssistantSession {
    this.evictExpired();
    const session = this.sessions.get(id);
    if (!session || session.userId !== user.id || session.storeId !== user.storeId) {
      throw new NotFoundException('Phiên trò chuyện đã hết hạn hoặc không tồn tại');
    }
    return session;
  }

  /** Đánh dấu bắt đầu một lượt hỏi; trả về hàm kết thúc. */
  begin(session: AssistantSession): () => void {
    if (session.busy) throw new ConflictException('Trợ lý đang trả lời câu hỏi trước');
    if (session.turns >= MAX_TURNS) {
      throw new BadRequestException(`Cuộc trò chuyện đã đạt ${MAX_TURNS} câu hỏi. Hãy bắt đầu cuộc trò chuyện mới.`);
    }
    session.busy = true;
    return () => {
      session.busy = false;
      session.updatedAt = Date.now();
    };
  }

  delete(user: AuthUser, id: string) {
    const session = this.sessions.get(id);
    if (session && session.userId === user.id) this.sessions.delete(id);
  }

  /** Giới hạn tần suất theo người dùng (cửa sổ trượt 5 phút). */
  checkRate(user: AuthUser) {
    const limit = Number(process.env.AI_RATE_LIMIT ?? 20);
    const now = Date.now();
    const recent = (this.requests.get(user.id) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
    if (recent.length >= limit) {
      const waitSeconds = Math.ceil((RATE_WINDOW_MS - (now - recent[0])) / 1000);
      throw new HttpException(
        `Bạn hỏi quá nhanh. Vui lòng thử lại sau ${Math.ceil(waitSeconds / 60)} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.requests.set(user.id, recent);
  }

  private evictExpired() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (!session.busy && now - session.updatedAt > SESSION_TTL_MS) this.sessions.delete(id);
    }
  }
}
