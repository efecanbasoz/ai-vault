export type UserId = string; // e.g. "telegram_123456", "api_a1b2c3", "cli_local"

export type VaultCategory = 'brainstorm' | 'active' | 'archive';

export interface Prompt {
  userId: UserId;
  message: string;
  sessionId: string | null;
  providerId?: string;
}

export interface PromptResult {
  text: string;
  sessionId: string | null;
  providerId: string;
  costUsd: number | null;
  isError: boolean;
  durationMs: number;
}

export type InterfaceType = 'telegram' | 'api' | 'cli';
