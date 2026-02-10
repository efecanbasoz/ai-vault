import { getAllNoteContents } from './manager.js';
import type { SearchResult, SearchOptions } from './types.js';
import type { UserId } from '../types.js';

interface IndexEntry {
  filepath: string;
  term: string;
  score: number;
  line: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function buildIndex(
  docs: Array<{ filepath: string; content: string; title: string; tags: string[] }>,
): Map<string, IndexEntry[]> {
  const index = new Map<string, IndexEntry[]>();
  const docCount = docs.length;

  // Document frequency per term
  const df = new Map<string, number>();
  const docTerms = docs.map((doc) => {
    const allText = `${doc.title} ${doc.tags.join(' ')} ${doc.content}`;
    const tokens = tokenize(allText);
    const unique = new Set(tokens);
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
    return { ...doc, tokens };
  });

  // Build TF-IDF entries
  for (const doc of docTerms) {
    const termFreq = new Map<string, number>();
    for (const t of doc.tokens) {
      termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
    }

    const lines = doc.content.split('\n');
    for (const [term, tf] of termFreq) {
      const idf = Math.log(docCount / (df.get(term) ?? 1));
      const score = tf * idf;

      // Find first matching line for snippet
      const matchLine = lines.find((l) => l.toLowerCase().includes(term)) ?? doc.title;

      const entries = index.get(term) ?? [];
      entries.push({
        filepath: doc.filepath,
        term,
        score,
        line: matchLine.trim().slice(0, 150),
      });
      index.set(term, entries);
    }
  }

  return index;
}

export async function search(userId: UserId, query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const notes = await getAllNoteContents(userId);

  // Filter by category/date if specified
  let filtered = notes;
  if (options?.category) {
    filtered = filtered.filter((n) => n.metadata.category === options.category);
  }
  if (options?.tags && options.tags.length > 0) {
    filtered = filtered.filter((n) =>
      options.tags!.some((t) => n.metadata.tags.includes(t)),
    );
  }
  if (options?.dateFrom) {
    filtered = filtered.filter((n) => n.metadata.created >= options.dateFrom!);
  }
  if (options?.dateTo) {
    filtered = filtered.filter((n) => n.metadata.created <= options.dateTo!);
  }

  const docs = filtered.map((n) => ({
    filepath: n.filepath,
    content: n.content,
    title: n.metadata.title,
    tags: n.metadata.tags,
    metadata: n.metadata,
  }));

  const index = buildIndex(docs);
  const queryTokens = tokenize(query);

  // Aggregate scores per filepath
  const scores = new Map<string, { score: number; snippet: string; metadata: typeof docs[0]['metadata'] }>();

  for (const token of queryTokens) {
    const entries = index.get(token) ?? [];
    for (const entry of entries) {
      const existing = scores.get(entry.filepath);
      if (existing) {
        existing.score += entry.score;
      } else {
        const doc = docs.find((d) => d.filepath === entry.filepath)!;
        scores.set(entry.filepath, {
          score: entry.score,
          snippet: entry.line,
          metadata: doc.metadata,
        });
      }
    }
  }

  // Sort by score descending
  const results: SearchResult[] = Array.from(scores.entries())
    .map(([filepath, data]) => ({
      filepath,
      snippet: data.snippet,
      score: data.score,
      metadata: data.metadata,
    }))
    .sort((a, b) => b.score - a.score);

  const limit = options?.limit ?? 20;
  return results.slice(0, limit);
}
