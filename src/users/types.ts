import type { UserId, InterfaceType } from '../types.js';

export interface User {
  id: UserId;
  interface: InterfaceType;
  displayName: string;
  createdAt: string;
  lastActiveAt: string;
  settings: UserSettings;
}

export interface UserSettings {
  defaultProvider: string;
}
