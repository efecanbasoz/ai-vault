import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { UserId, InterfaceType } from '../types.js';
import type { User } from './types.js';

function getUserDir(userId: UserId): string {
  return path.resolve(config.DATA_PATH, 'users', userId);
}

function getUserFile(userId: UserId): string {
  return path.join(getUserDir(userId), 'user.json');
}

export function getUser(userId: UserId): User | null {
  if (config.SINGLE_USER_MODE) return getLocalUser();

  const file = getUserFile(userId);
  if (!fs.existsSync(file)) return null;

  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export function ensureUser(userId: UserId, iface: InterfaceType, displayName?: string): User {
  if (config.SINGLE_USER_MODE) return getLocalUser();

  let user = getUser(userId);
  if (user) {
    user.lastActiveAt = new Date().toISOString();
    saveUser(user);
    return user;
  }

  user = {
    id: userId,
    interface: iface,
    displayName: displayName ?? userId,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    settings: {
      defaultProvider: config.DEFAULT_PROVIDER,
    },
  };

  const userDir = getUserDir(userId);
  fs.mkdirSync(userDir, { recursive: true });

  // Create user's vault directories synchronously (consistent with rest of store)
  const vaultDir = path.join(userDir, 'vault');
  for (const cat of ['brainstorm', 'active', 'archive']) {
    fs.mkdirSync(path.join(vaultDir, cat), { recursive: true });
  }

  saveUser(user);
  logger.info({ userId, interface: iface }, 'New user created');
  return user;
}

function saveUser(user: User): void {
  const file = getUserFile(user.id);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(user, null, 2), 'utf-8');
}

function getLocalUser(): User {
  return {
    id: 'cli_local',
    interface: 'cli',
    displayName: 'Local User',
    createdAt: '',
    lastActiveAt: new Date().toISOString(),
    settings: { defaultProvider: config.DEFAULT_PROVIDER },
  };
}

export function listUsers(): User[] {
  if (config.SINGLE_USER_MODE) return [getLocalUser()];

  const usersDir = path.resolve(config.DATA_PATH, 'users');
  if (!fs.existsSync(usersDir)) return [];

  return fs
    .readdirSync(usersDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => getUser(e.name))
    .filter((u): u is User => u !== null);
}
