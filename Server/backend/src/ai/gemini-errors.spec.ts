import { describe, expect, it } from 'vitest';
import { geminiError } from './gemini-errors.js';

describe('geminiError', () => {
  it('returns a generic limit message for an unclassified 429', () => {
    const error = geminiError({ status: 429 });
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({ code: 'AI_USAGE_LIMITED' });
  });

  it('does not turn a provider authentication failure into a user logout', () => {
    const error = geminiError({ status: 401 });
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toMatchObject({ code: 'AI_CONFIGURATION_ERROR' });
  });

  it('distinguishes a request timeout from an unavailable service', () => {
    expect(geminiError({ name: 'AbortError' }).getResponse()).toMatchObject({ code: 'AI_TIMEOUT' });
    expect(geminiError(new Error('network')).getResponse()).toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('preserves an already classified HTTP error', () => {
    const first = geminiError({ status: 429 });
    expect(geminiError(first)).toBe(first);
  });
  it('distinguishes structured daily quota and short-term rate errors', () => {
    expect(geminiError({ status: 429, code: 'quota_exceeded' }).getResponse()).toMatchObject({ code: 'AI_QUOTA_EXCEEDED' });
    expect(geminiError({ status: 429, code: 'rate_limit_exceeded' }).getResponse()).toMatchObject({ code: 'AI_RATE_LIMITED' });
  });
});
