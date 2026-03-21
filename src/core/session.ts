import type { UserId } from '../types.js';
import type { ChildProcess } from 'node:child_process';

// SEC-006: Prevent unbounded memory growth
const MAX_SESSIONS = 1000;
const MAX_HISTORY_ITEMS = 50;

export interface UserSession {
  userId: UserId;
  providerId: string;
  sessionId: string | null;
  busy: boolean;
  currentProcess: ChildProcess | null;
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const sessions = new Map<UserId, UserSession>();

export function getSession(userId: UserId, defaultProviderId: string): UserSession {
  let session = sessions.get(userId);
  if (!session) {
    // SEC-006: Evict oldest non-busy session when at capacity
    if (sessions.size >= MAX_SESSIONS) {
      for (const [key, s] of sessions) {
        if (!s.busy) { sessions.delete(key); break; }
      }
    }
    session = {
      userId,
      providerId: defaultProviderId,
      sessionId: null,
      busy: false,
      currentProcess: null,
      messageHistory: [],
    };
    sessions.set(userId, session);
  }
  return session;
}

export function trimHistory(session: UserSession): void {
  if (session.messageHistory.length > MAX_HISTORY_ITEMS) {
    session.messageHistory = session.messageHistory.slice(-MAX_HISTORY_ITEMS);
  }
}

export function resetSession(userId: UserId): void {
  const session = sessions.get(userId);
  if (session) {
    session.sessionId = null;
    session.messageHistory = [];
  }
}

export function setProvider(userId: UserId, providerId: string, defaultProviderId: string): void {
  const session = getSession(userId, defaultProviderId);
  if (session.providerId !== providerId) {
    session.providerId = providerId;
    session.sessionId = null;
    session.messageHistory = [];
  }
}

