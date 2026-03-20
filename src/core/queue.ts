import { logger } from '../logger.js';
import type { UserId } from '../types.js';
import { getSession } from './session.js';

export function cancelCurrent(userId: UserId, defaultProviderId: string): boolean {
  const session = getSession(userId, defaultProviderId);
  if (session.currentProcess) {
    session.currentProcess.kill('SIGTERM');
    session.currentProcess = null;
    session.busy = false;
    logger.info({ userId }, 'Cancelled running process');
    return true;
  }
  return false;
}
