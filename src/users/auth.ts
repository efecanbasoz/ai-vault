import { config } from '../config.js';
import type { UserId } from '../types.js';

export function resolveUserIdFromTelegram(telegramId: number): UserId {
  if (config.SINGLE_USER_MODE) return 'cli_local';
  return `telegram_${telegramId}`;
}

export function resolveUserIdFromApiKey(apiKey: string): UserId {
  if (config.SINGLE_USER_MODE) return 'cli_local';
  // Derive a short hash from the API key for user identification
  const hash = simpleHash(apiKey).toString(36);
  return `api_${hash}`;
}

export function resolveUserIdFromCli(): UserId {
  return 'cli_local';
}

export function validateApiKey(providedKey: string): boolean {
  if (!config.API_KEY) return true; // No key configured = open access
  return providedKey === config.API_KEY;
}

export function validateTelegramUser(telegramId: number): boolean {
  if (config.SINGLE_USER_MODE) return true;
  if (config.TELEGRAM_ALLOWED_USERS.length === 0) return true;
  return config.TELEGRAM_ALLOWED_USERS.includes(telegramId);
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
