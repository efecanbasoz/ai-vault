import type { Context, NextFunction } from 'grammy';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

export async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // Single user mode or no restriction: allow all
  if (config.SINGLE_USER_MODE || config.TELEGRAM_ALLOWED_USERS.length === 0) {
    await next();
    return;
  }

  const userId = ctx.from?.id;
  if (!userId || !config.TELEGRAM_ALLOWED_USERS.includes(userId)) {
    logger.warn({ userId, username: ctx.from?.username }, 'Unauthorized Telegram access attempt');
    return; // Silent rejection
  }

  await next();
}
