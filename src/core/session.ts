import type { UserId } from '../types.js';
import type { ChildProcess } from 'node:child_process';

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

export function getAllSessions(): Map<UserId, UserSession> {
  return sessions;
}
