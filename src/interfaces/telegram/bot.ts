import { Bot } from 'grammy';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import type { AppInterface } from '../types.js';
import { authMiddleware } from './middleware.js';
import { handleMessage } from './message-handler.js';
import {
  startCommand,
  helpCommand,
  newCommand,
  stopCommand,
  statusCommand,
  providerCommand,
  saveCommand,
  searchCommand,
  listCommand,
  synthesizeCommand,
} from './commands.js';

export class TelegramInterface implements AppInterface {
  readonly name = 'telegram';
  private bot: Bot;

  constructor() {
    this.bot = new Bot(config.TELEGRAM_BOT_TOKEN);

    // Middleware
    this.bot.use(authMiddleware);

    // Commands
    this.bot.command('start', startCommand);
    this.bot.command('help', helpCommand);
    this.bot.command('new', newCommand);
    this.bot.command('stop', stopCommand);
    this.bot.command('status', statusCommand);
    this.bot.command('provider', providerCommand);
    this.bot.command('save', saveCommand);
    this.bot.command('search', searchCommand);
    this.bot.command('list', listCommand);
    this.bot.command('synthesize', synthesizeCommand);

    // Text messages
    this.bot.on('message:text', handleMessage);

    // Error handler
    this.bot.catch((err) => {
      logger.error({ err: err.error, updateId: err.ctx?.update?.update_id }, 'Telegram bot error');
    });
  }

  async start(): Promise<void> {
    this.bot.start({
      onStart: () => {
        logger.info('Telegram interface started (long polling)');
      },
    });
  }

  async stop(): Promise<void> {
    this.bot.stop();
    logger.info('Telegram interface stopped');
  }
}
