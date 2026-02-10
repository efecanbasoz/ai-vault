import type { VaultCategory } from '../types.js';

export interface NoteMetadata {
  title: string;
  category: VaultCategory;
  tags: string[];
  created: string; // ISO date
  updated: string; // ISO date
}

export interface Note {
  filepath: string;  // Relative to vault root, e.g. "brainstorm/2024-01-15-my-idea.md"
  metadata: NoteMetadata;
  content: string;   // Markdown body (without frontmatter)
}

export interface SearchResult {
  filepath: string;
  snippet: string;
  score: number;
  metadata: NoteMetadata;
}

export interface SearchOptions {
  query?: string;
  category?: VaultCategory;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}
