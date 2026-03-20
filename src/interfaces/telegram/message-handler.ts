import type { Context } from 'grammy';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { execute } from '../../core/engine.js';
import { getSession } from '../../core/session.js';
import { resolveUserIdFromTelegram } from '../../users/auth.js';
import { formatForTelegram, splitMessage } from './formatter.js';

export async function handleMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const userId = resolveUserIdFromTelegram(ctx.from?.id ?? 0);
  const session = getSession(userId, config.DEFAULT_PROVIDER);

  if (session.busy) {
    await ctx.reply('A request is already in progress. Use /stop to cancel it first.');
    return;
  }

  // Show processing status
  let statusMsg;
  try {
    statusMsg = await ctx.reply('Processing...');
  } catch { /* ignore */ }

  const result = await execute({
    userId,
    message: text,
    sessionId: session.sessionId,
  });

  // Delete status message
  if (statusMsg) {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id);
    } catch { /* ignore */ }
  }

  // Format and send response
  const formatted = formatForTelegram(result.text);
  const parts = splitMessage(formatted);

  for (let i = 0; i < parts.length; i++) {
    const pageIndicator = parts.length > 1 ? `\n\n[${i + 1}/${parts.length}]` : '';
    try {
      await ctx.reply(parts[i] + pageIndicator, { parse_mode: 'HTML' });
    } catch (err) {
      logger.debug({ err }, 'HTML parse failed, falling back to plain text');
      try {
        await ctx.reply(result.text.slice(i * 4000, (i + 1) * 4000));
      } catch { /* give up */ }
    }
  }
}
