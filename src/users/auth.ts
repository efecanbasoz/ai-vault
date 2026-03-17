import { createHash, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import type { UserId } from '../types.js';

export function resolveUserIdFromTelegram(telegramId: number): UserId {
  if (config.SINGLE_USER_MODE) return 'cli_local';
  return `telegram_${telegramId}`;
}

export function resolveUserIdFromApiKey(apiKey: string): UserId {
  if (config.SINGLE_USER_MODE) return 'cli_local';
  const digest = createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  return `api_${digest}`;
}

export function resolveUserIdFromCli(): UserId {
  return 'cli_local';
}

export function validateApiKey(providedKey: string): boolean {
  if (!config.API_KEY) return true; // No key configured = open access
  const a = Buffer.from(providedKey);
  const b = Buffer.from(config.API_KEY);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function validateTelegramUser(telegramId: number): boolean {
  if (config.SINGLE_USER_MODE) return true;
  if (config.TELEGRAM_ALLOWED_USERS.length === 0) return true;
  return config.TELEGRAM_ALLOWED_USERS.includes(telegramId);
}
