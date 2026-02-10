import type { Context, Next } from 'hono';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { validateApiKey, resolveUserIdFromApiKey } from '../../users/auth.js';

export async function apiAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  // No API key configured = open access
  if (!config.API_KEY) {
    c.set('userId', config.SINGLE_USER_MODE ? 'cli_local' : 'api_anonymous');
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('API request without valid Authorization header');
    return c.json({ error: 'Unauthorized. Provide Authorization: Bearer <API_KEY>' }, 401);
  }

  const token = authHeader.slice(7);
  if (!validateApiKey(token)) {
    logger.warn('API request with invalid API key');
    return c.json({ error: 'Invalid API key' }, 401);
  }

  c.set('userId', resolveUserIdFromApiKey(token));
  return next();
}
