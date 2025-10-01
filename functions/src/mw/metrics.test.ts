import assert from 'node:assert/strict';
import test from 'node:test';
import { RateLimiter, calculateTokenSavings, estimateTokens } from './metrics.js';

test('estimateTokens rounds up by chunk of four', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});

test('calculateTokenSavings returns ratio and percent', () => {
  const payload = {
    optimized: JSON.stringify({ titles: ['치킨', '피자'] }),
    baseline: JSON.stringify({ baemin_like_json: [{ title: '치킨' }, { title: '피자' }] }),
  };

  const sample = calculateTokenSavings(payload, new Date('2024-03-01T00:00:00Z'));
  assert.ok(sample);
  assert.equal(sample?.captured_at, '2024-03-01T00:00:00.000Z');
  assert.equal(sample?.baseline_tokens >= sample?.optimized_tokens, true);
  assert.equal(sample?.savings_percent >= 0, true);
});

test('RateLimiter enforces the configured limit per window', () => {
  const limiter = new RateLimiter(2, 1_000);
  const now = Date.now();
  assert.equal(limiter.tryConsume('127.0.0.1', now), true);
  assert.equal(limiter.tryConsume('127.0.0.1', now + 10), true);
  assert.equal(limiter.tryConsume('127.0.0.1', now + 20), false);
  assert.equal(limiter.tryConsume('127.0.0.1', now + 1_100), true);
});
