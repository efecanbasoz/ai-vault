import type { VaultCategory } from '../types.js';
import type { NoteMetadata } from './types.js';

function yamlEscape(value: string): string {
  if (/[\\":\n\r\t\x00-\x1f]/.test(value)) {
    return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
  }
  return '"' + value + '"';
}

export function generateFrontmatter(metadata: NoteMetadata): string {
  const lines = [
    '---',
    `title: ${yamlEscape(metadata.title)}`,
    `category: ${metadata.category}`,
    `tags: [${metadata.tags.map((t) => yamlEscape(t)).join(', ')}]`,
    `created: ${metadata.created}`,
    `updated: ${metadata.updated}`,
    '---',
  ];
  return lines.join('\n');
}

export function generateFilename(title: string, date: Date): string {
  const dateStr = date.toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return `${dateStr}-${slug}.md`;
}

export function generateNoteContent(category: VaultCategory, title: string, body: string): string {
  const now = new Date().toISOString();
  const metadata: NoteMetadata = {
    title,
    category,
    tags: [],
    created: now,
    updated: now,
  };

  const template = getCategoryTemplate(category);
  return `${generateFrontmatter(metadata)}\n\n# ${title}\n\n${template}\n\n${body}`;
}

function getCategoryTemplate(category: VaultCategory): string {
  switch (category) {
    case 'brainstorm':
      return '<!-- Raw idea, quick thought, or unstructured note -->';
    case 'active':
      return '<!-- Work in progress, active project, or ongoing task -->';
    case 'archive':
      return '<!-- Completed, paused, or historical item -->';
  }
}
