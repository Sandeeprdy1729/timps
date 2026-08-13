import { describe, expect, it } from 'vitest';
import { formatDate, formatRelativeTime } from './index';

describe('formatDate', () => {
  it('formats a seconds timestamp', () => {
    const secs = Math.floor(Date.now() / 1000);
    expect(formatDate(secs)).toBe('Today');
  });

  it('formats a milliseconds timestamp identically (M85)', () => {
    const secs = Math.floor(Date.now() / 1000);
    const ms = secs * 1000;
    expect(formatDate(ms)).toBe(formatDate(secs));
  });
});

describe('formatRelativeTime', () => {
  it('formats a seconds timestamp', () => {
    const secs = Math.floor(Date.now() / 1000);
    expect(formatRelativeTime(secs)).toBe('just now');
  });

  it('formats a milliseconds timestamp identically (M85)', () => {
    const secs = Math.floor(Date.now() / 1000);
    const ms = secs * 1000;
    expect(formatRelativeTime(ms)).toBe(formatRelativeTime(secs));
  });
});
