import cron from 'node-cron';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { runSynthesis } from './digest.js';
import { listUsers } from '../users/store.js';

export function startScheduler(): void {
  if (!config.SYNTHESIS_ENABLED) return;

  const schedule = config.SYNTHESIS_SCHEDULE;

  if (!cron.validate(schedule)) {
    logger.error({ schedule }, 'Invalid synthesis cron schedule');
    return;
  }

  cron.schedule(schedule, async () => {
    logger.info('Scheduled synthesis triggered');

    if (config.SINGLE_USER_MODE) {
      try {
        await runSynthesis('cli_local');
      } catch (err) {
        logger.error({ err }, 'Scheduled synthesis failed');
      }
    } else {
      const users = listUsers();
      for (const user of users) {
        try {
          await runSynthesis(user.id);
        } catch (err) {
          logger.error({ userId: user.id, err }, 'Scheduled synthesis failed for user');
        }
      }
    }
  });

  logger.info({ schedule }, 'Synthesis scheduler started');
}

