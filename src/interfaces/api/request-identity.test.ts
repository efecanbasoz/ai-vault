import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRateLimitKey, getTrustedClientIp, resolveRateLimitUserId } from './request-identity';

test('getTrustedClientIp ignores proxy headers unless trust is enabled', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' });

  assert.equal(getTrustedClientIp(headers, false), null);
  assert.equal(getTrustedClientIp(headers, true), '203.0.113.1');
});

test('buildRateLimitKey prefers authenticated user IDs', () => {
  const key = buildRateLimitKey({
    headers: new Headers({ 'x-forwarded-for': '203.0.113.1' }),
    path: '/api/v1/chat',
    userId: 'api_deadbeef',
    trustProxyHeaders: true,
  });

  assert.equal(key, 'user:api_deadbeef:/api/v1/chat');
});

test('buildRateLimitKey falls back to trusted proxy IPs when anonymous', () => {
  const key = buildRateLimitKey({
    headers: new Headers({ 'x-real-ip': '198.51.100.3' }),
    path: '/api/v1/status',
    trustProxyHeaders: true,
  });

  assert.equal(key, 'ip:198.51.100.3:/api/v1/status');
});

test('buildRateLimitKey falls back to user-agent fingerprints before the anonymous bucket', () => {
  const key = buildRateLimitKey({
    headers: new Headers({ 'user-agent': 'curl/8.6.0' }),
    path: '/api/v1/status',
    trustProxyHeaders: false,
  });

  assert.equal(key, 'agent:curl/8.6.0:/api/v1/status');
});

test('buildRateLimitKey uses an anonymous bucket when no fallback identity is available', () => {
  const key = buildRateLimitKey({
    headers: new Headers(),
    path: '/api/v1/status',
    trustProxyHeaders: false,
  });

  assert.equal(key, 'anonymous:/api/v1/status');
});

test('resolveRateLimitUserId returns a user only for valid bearer tokens', () => {
  assert.equal(
    resolveRateLimitUserId({
      authorizationHeader: 'Bearer live-token',
      apiKeyConfigured: true,
      validateApiKey: (token) => token === 'live-token',
      resolveUserIdFromApiKey: (token) => `api_${token}`,
    }),
    'api_live-token',
  );

  assert.equal(
    resolveRateLimitUserId({
      authorizationHeader: 'Bearer wrong-token',
      apiKeyConfigured: true,
      validateApiKey: () => false,
      resolveUserIdFromApiKey: (token) => `api_${token}`,
    }),
    null,
  );
});
