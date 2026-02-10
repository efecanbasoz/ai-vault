import type { Note } from '../vault/types.js';

export interface ThemeCluster {
  theme: string;
  notes: string[];       // filepaths
  keywords: string[];
}

export interface AnalysisResult {
  clusters: ThemeCluster[];
  forgottenIdeas: string[];  // filepaths of notes not referenced in 30+ days
  totalNotes: number;
  newSinceLastDigest: number;
}

export function analyzeVault(notes: Note[], lastDigestDate?: string): AnalysisResult {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Find forgotten ideas
  const forgottenIdeas = notes
    .filter((n) => {
      const updated = new Date(n.metadata.updated || n.metadata.created);
      return updated < thirtyDaysAgo && n.metadata.category === 'brainstorm';
    })
    .map((n) => n.filepath);

  // Count new notes since last digest
  const newSinceLastDigest = lastDigestDate
    ? notes.filter((n) => n.metadata.created > lastDigestDate).length
    : notes.length;

  // Simple keyword-based clustering
  const keywordMap = new Map<string, string[]>();

  for (const note of notes) {
    const words = extractKeywords(note.content + ' ' + note.metadata.title);
    for (const word of words) {
      const existing = keywordMap.get(word) ?? [];
      existing.push(note.filepath);
      keywordMap.set(word, existing);
    }
  }

  // Build clusters from keywords that appear in multiple notes
  const clusters: ThemeCluster[] = [];
  const usedNotes = new Set<string>();

  const sortedKeywords = Array.from(keywordMap.entries())
    .filter(([, files]) => files.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [keyword, files] of sortedKeywords) {
    const uniqueFiles = files.filter((f) => !usedNotes.has(f));
    if (uniqueFiles.length < 2) continue;

    clusters.push({
      theme: keyword,
      notes: uniqueFiles,
      keywords: [keyword],
    });
    uniqueFiles.forEach((f) => usedNotes.add(f));

    if (clusters.length >= 5) break; // Max 5 themes per digest
  }

  return {
    clusters,
    forgottenIdeas: forgottenIdeas.slice(0, 10),
    totalNotes: notes.length,
    newSinceLastDigest,
  };
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'this', 'that', 'these',
    'those', 'and', 'but', 'or', 'not', 'no', 'nor', 'for', 'with',
    'from', 'into', 'about', 'between', 'through', 'during', 'before',
    'after', 'above', 'below', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
    'than', 'too', 'very', 'just', 'because', 'also', 'which', 'who',
    'what', 'when', 'where', 'how', 'why', 'user', 'assistant',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}
