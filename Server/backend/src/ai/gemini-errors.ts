import { HttpException } from '@nestjs/common';

export function geminiError(cause: unknown): HttpException {
  if (cause instanceof HttpException) return cause;
  const status = typeof cause === 'object' && cause !== null && 'status' in cause ? Number(cause.status) : 0;
  const name = typeof cause === 'object' && cause !== null && 'name' in cause ? cause.name : undefined;
  const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;
  if (name === 'AbortError' || name === 'TimeoutError') return new HttpException({ code: 'AI_TIMEOUT', message: 'AI phản hồi quá lâu. Vui lòng thử lại.' }, 504);
  if (status === 429 && code === 'quota_exceeded') return new HttpException({ code: 'AI_QUOTA_EXCEEDED', message: 'Chức năng AI đã hết hạn mức sử dụng hôm nay. Bạn vẫn có thể nhập liệu và quản lý kho thủ công.' }, 429);
  if (status === 429 && (code === 'rate_limit_exceeded' || code === 'too_many_requests')) return new HttpException({ code: 'AI_RATE_LIMITED', message: 'AI đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau.' }, 429);
  if (status === 429) return new HttpException({ code: 'AI_USAGE_LIMITED', message: 'AI đang bị giới hạn sử dụng. Vui lòng thử lại sau.' }, 429);
  if ([400, 401, 403, 404].includes(status)) return new HttpException({ code: 'AI_CONFIGURATION_ERROR', message: 'Chức năng AI đang gặp lỗi cấu hình. Vui lòng liên hệ người quản lý.' }, 503);
  return new HttpException({ code: 'AI_UNAVAILABLE', message: 'Tạm thời không kết nối được AI. Vui lòng thử lại.' }, 503);
}
