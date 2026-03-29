import { scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import type { UserId } from '../types.js';

const API_USER_ID_SALT = 'ai-vault:api-user-id:v1';

export function resolveUserIdFromTelegram(telegramId: number): UserId {
  if (config.SINGLE_USER_MODE) return 'cli_local';
  return `telegram_${telegramId}`;
}

export function resolveUserIdFromApiKey(apiKey: string): UserId {
  if (config.SINGLE_USER_MODE) return 'cli_local';
  const digest = scryptSync(apiKey, API_USER_ID_SALT, 8).toString('hex');
  return `api_${digest}`;
}

export function resolveUserIdFromCli(): UserId {
  return 'cli_local';
}

export function validateApiKey(providedKey: string): boolean {
  // SEC-001: Support multiple API keys for per-user isolation.
  // Check API_KEYS first (comma-separated list), then fall back to single API_KEY.
  const keys = config.API_KEYS.length > 0 ? config.API_KEYS : config.API_KEY ? [config.API_KEY] : [];

  if (keys.length === 0) return true; // No keys configured = open access

  for (const key of keys) {
    if (timingSafeKeyEquals(providedKey, key)) return true;
  }
  return false;
}

export function validateTelegramUser(telegramId: number): boolean {
  if (config.SINGLE_USER_MODE) return true;
  if (config.TELEGRAM_ALLOWED_USERS.length === 0) {
    return config.TELEGRAM_ALLOW_PUBLIC;
  }
  return config.TELEGRAM_ALLOWED_USERS.includes(telegramId);
}

function timingSafeKeyEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const maxLength = Math.max(leftBuffer.length, rightBuffer.length);
  const paddedLeft = Buffer.alloc(maxLength);
  const paddedRight = Buffer.alloc(maxLength);

  leftBuffer.copy(paddedLeft);
  rightBuffer.copy(paddedRight);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(paddedLeft, paddedRight);
}
