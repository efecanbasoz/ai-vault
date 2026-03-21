import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { UserId, VaultCategory } from '../types.js';
import type { Note, NoteMetadata } from './types.js';
import { generateFilename, generateNoteContent, generateFrontmatter } from './templates.js';

// SEC-002: Disable JavaScript frontmatter engine to prevent eval()-based RCE.
const SAFE_MATTER_OPTIONS = {
  engines: {
    javascript: {
      parse(): never { throw new Error('JavaScript frontmatter is disabled for security'); },
      stringify(): never { throw new Error('JavaScript frontmatter is disabled for security'); },
    },
  },
};

function safeMatter(input: string) {
  return matter(input, SAFE_MATTER_OPTIONS);
}

const VALID_CATEGORIES = new Set<string>(['brainstorm', 'active', 'archive']);

export function isValidCategory(value: string | undefined): value is VaultCategory {
  return value !== undefined && VALID_CATEGORIES.has(value);
}

function getVaultPath(userId: UserId): string {
  if (config.SINGLE_USER_MODE || userId === 'cli_local') {
    return path.resolve(config.VAULT_PATH);
  }
  return path.resolve(config.DATA_PATH, 'users', userId, 'vault');
}

async function ensureVaultDirs(vaultPath: string): Promise<void> {
  for (const cat of ['brainstorm', 'active', 'archive'] as const) {
    const dir = path.join(vaultPath, cat);
    await fs.mkdir(dir, { recursive: true });
  }
}

function resolveSafeVaultPath(vaultPath: string, filepath: string): { fullPath: string; normalizedPath: string; category: VaultCategory } | null {
  const normalized = filepath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length !== 2) return null;

  const [rawCategory, filename] = parts;
  if (!['brainstorm', 'active', 'archive'].includes(rawCategory)) return null;
  if (!filename.endsWith('.md') || filename.includes('/') || filename.includes('..')) return null;

  const category = rawCategory as VaultCategory;
  const fullPath = path.resolve(vaultPath, category, filename);
  const baseDir = path.resolve(vaultPath, category) + path.sep;

  if (!fullPath.startsWith(baseDir)) return null;

  return {
    fullPath,
    normalizedPath: `${category}/${filename}`,
    category,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// SEC-004: Reject symlinks to prevent path redirection attacks
async function rejectSymlink(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(filePath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export async function listNotes(
  userId: UserId,
  category?: VaultCategory,
): Promise<Array<{ filepath: string; metadata: NoteMetadata }>> {
  const vaultPath = getVaultPath(userId);
  await ensureVaultDirs(vaultPath);

  const categories: VaultCategory[] = category ? [category] : ['brainstorm', 'active', 'archive'];
  const notes: Array<{ filepath: string; metadata: NoteMetadata }> = [];

  for (const cat of categories) {
    const dir = path.join(vaultPath, cat);
    if (!(await fileExists(dir))) continue;

    const entries = await fs.readdir(dir);
    const files = entries.filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filepath = `${cat}/${file}`;
      try {
        const raw = await fs.readFile(path.join(vaultPath, filepath), 'utf-8');
        const parsed = safeMatter(raw);
        notes.push({
          filepath,
          metadata: {
            title: parsed.data.title ?? file.replace('.md', ''),
            category: cat,
            tags: parsed.data.tags ?? [],
            created: parsed.data.created ?? '',
            updated: parsed.data.updated ?? '',
          },
        });
      } catch {
        notes.push({
          filepath,
          metadata: { title: file.replace('.md', ''), category: cat, tags: [], created: '', updated: '' },
        });
      }
    }
  }

  // Sort by created date descending
  notes.sort((a, b) => (b.metadata.created > a.metadata.created ? 1 : -1));
  return notes;
}

export async function getNote(userId: UserId, filepath: string): Promise<Note | null> {
  const vaultPath = getVaultPath(userId);
  const resolved = resolveSafeVaultPath(vaultPath, filepath);
  if (!resolved) return null;

  if (!(await fileExists(resolved.fullPath))) return null;
  if (await rejectSymlink(resolved.fullPath)) return null;

  const raw = await fs.readFile(resolved.fullPath, 'utf-8');
  const parsed = safeMatter(raw);

  return {
    filepath: resolved.normalizedPath,
    metadata: {
      title: parsed.data.title ?? path.basename(resolved.normalizedPath, '.md'),
      category: resolved.category,
      tags: parsed.data.tags ?? [],
      created: parsed.data.created ?? '',
      updated: parsed.data.updated ?? '',
    },
    content: parsed.content,
  };
}

export async function createNote(
  userId: UserId,
  category: VaultCategory,
  title: string,
  body: string,
  tags: string[] = [],
): Promise<string> {
  const vaultPath = getVaultPath(userId);
  await ensureVaultDirs(vaultPath);

  const filename = generateFilename(title, new Date());
  const filepath = `${category}/${filename}`;
  const resolved = resolveSafeVaultPath(vaultPath, filepath);
  if (!resolved) throw new Error('Generated note path failed safety validation');

  const content = generateNoteContent(category, title, body);
  await fs.writeFile(resolved.fullPath, content, 'utf-8');

  logger.debug({ filepath: resolved.normalizedPath, userId }, 'Note created');
  return resolved.normalizedPath;
}

export async function updateNote(userId: UserId, filepath: string, body: string): Promise<boolean> {
  const vaultPath = getVaultPath(userId);
  const resolved = resolveSafeVaultPath(vaultPath, filepath);
  if (!resolved) return false;

  if (!(await fileExists(resolved.fullPath))) return false;
  if (await rejectSymlink(resolved.fullPath)) return false;

  const raw = await fs.readFile(resolved.fullPath, 'utf-8');
  const parsed = safeMatter(raw);
  parsed.data.updated = new Date().toISOString();

  const newContent = `${generateFrontmatter(parsed.data as NoteMetadata)}\n\n${body}`;
  await fs.writeFile(resolved.fullPath, newContent, 'utf-8');
  return true;
}

export async function deleteNote(userId: UserId, filepath: string): Promise<boolean> {
  const vaultPath = getVaultPath(userId);
  const resolved = resolveSafeVaultPath(vaultPath, filepath);
  if (!resolved) return false;

  if (!(await fileExists(resolved.fullPath))) return false;
  if (await rejectSymlink(resolved.fullPath)) return false;

  await fs.unlink(resolved.fullPath);
  logger.debug({ filepath: resolved.normalizedPath, userId }, 'Note deleted');
  return true;
}

export async function saveFromChat(
  userId: UserId,
  category: VaultCategory,
  chatContent: string,
  title?: string,
): Promise<string> {
  const autoTitle = title ?? `chat-${new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')}`;
  return createNote(userId, category, autoTitle, chatContent, ['chat']);
}

export async function getAllNoteContents(userId: UserId): Promise<Note[]> {
  const notes = await listNotes(userId);
  const fullNotes: Note[] = [];

  for (const n of notes) {
    const note = await getNote(userId, n.filepath);
    if (note) fullNotes.push(note);
  }

  return fullNotes;
}

export { getVaultPath, ensureVaultDirs };
