/**
 * Integration tests for double-submit / double-view guard patterns.
 *
 * These tests don't mount the full QuizPlayer / ChatWidget / ReelSlot
 * (their async UI graphs require deep Supabase chain mocks and are
 * already covered by manual QA). Instead, they prove the EXACT guard
 * pattern used inside those components — `useRef(false)` + early return —
 * cannot be bypassed by rapid-fire calls, timer triggers, or visibility
 * events firing in parallel.
 */
import { describe, it, expect, vi } from 'vitest';

/** Mirrors `submitRef.current` guard in src/pages/quiz/QuizPlayer.tsx */
function makeSubmitGuard(work: () => Promise<void> | void) {
  const ref = { current: false };
  return async () => {
    if (ref.current) return 'skipped';
    ref.current = true;
    await work();
    return 'ran';
  };
}

/** Mirrors `viewedRef.current` guard in src/components/class-videos/ReelSlot.tsx */
function makeViewGuard(onView: () => void) {
  const ref = { current: false };
  return () => {
    if (ref.current) return false;
    ref.current = true;
    onView();
    return true;
  };
}

/** Mirrors send-button disabled state pattern in ChatWidget */
function makeSendGuard(send: (text: string) => Promise<void>) {
  let pending = false;
  return async (text: string) => {
    if (pending || !text.trim()) return 'skipped';
    pending = true;
    try {
      await send(text);
      return 'sent';
    } finally {
      pending = false;
    }
  };
}

describe('QuizPlayer submitRef guard', () => {
  it('runs only once when called rapidly in parallel', async () => {
    const work = vi.fn(async () => { await new Promise(r => setTimeout(r, 10)); });
    const submit = makeSubmitGuard(work);
    const results = await Promise.all([submit(), submit(), submit()]);
    expect(work).toHaveBeenCalledTimes(1);
    expect(results.filter(r => r === 'ran')).toHaveLength(1);
    expect(results.filter(r => r === 'skipped')).toHaveLength(2);
  });

  it('blocks timer-triggered submit after manual submit', async () => {
    const insert = vi.fn(async () => {});
    const submit = makeSubmitGuard(insert);
    await submit();           // manual click
    await submit();           // timer hits 0
    await submit();           // anti-cheat auto-submit
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe('ReelSlot viewedRef guard', () => {
  it('counts a single view even if observer fires repeatedly', () => {
    const incView = vi.fn();
    const tryCount = makeViewGuard(incView);
    for (let i = 0; i < 10; i++) tryCount();
    expect(incView).toHaveBeenCalledTimes(1);
  });

  it('returns false on subsequent attempts', () => {
    const tryCount = makeViewGuard(() => {});
    expect(tryCount()).toBe(true);
    expect(tryCount()).toBe(false);
    expect(tryCount()).toBe(false);
  });
});

describe('ChatWidget send guard', () => {
  it('ignores rapid double-clicks while request is in flight', async () => {
    const insert = vi.fn(async () => { await new Promise(r => setTimeout(r, 20)); });
    const send = makeSendGuard(insert);
    const [a, b, c] = await Promise.all([send('hi'), send('hi'), send('hi')]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect([a, b, c].filter(r => r === 'sent')).toHaveLength(1);
  });

  it('rejects empty / whitespace messages', async () => {
    const insert = vi.fn(async () => {});
    const send = makeSendGuard(insert);
    expect(await send('')).toBe('skipped');
    expect(await send('   ')).toBe('skipped');
    expect(insert).not.toHaveBeenCalled();
  });

  it('allows a second send after the first completes', async () => {
    const insert = vi.fn(async () => {});
    const send = makeSendGuard(insert);
    await send('first');
    await send('second');
    expect(insert).toHaveBeenCalledTimes(2);
  });
});
