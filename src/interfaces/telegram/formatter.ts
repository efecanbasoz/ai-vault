const SAFE_MAX = 4076; // Leave room for page indicators under Telegram's 4096 limit

export function formatForTelegram(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
        result.push(codeLanguage ? `<pre><code class="language-${escapeHtml(codeLanguage)}">` : '<pre><code>');
      } else {
        inCodeBlock = false;
        codeLanguage = '';
        result.push('</code></pre>');
      }
      continue;
    }

    if (inCodeBlock) {
      result.push(escapeHtml(line));
      continue;
    }

    let processed = escapeHtml(line);
    // Inline code (before bold/italic to avoid conflicts)
    processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // Italic (avoid matching bold markers)
    processed = processed.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');

    result.push(processed);
  }

  // Close unclosed code block
  if (inCodeBlock) {
    result.push('</code></pre>');
  }

  return result.join('\n');
}

export function splitMessage(text: string): string[] {
  if (text.length <= SAFE_MAX) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= SAFE_MAX) {
      parts.push(remaining);
      break;
    }

    const splitPoint = findSplitPoint(remaining, SAFE_MAX);
    let chunk = remaining.slice(0, splitPoint);
    remaining = remaining.slice(splitPoint).trimStart();

    // Handle unclosed <pre> tags
    const openPre = (chunk.match(/<pre>/g) || []).length;
    const closePre = (chunk.match(/<\/pre>/g) || []).length;
    if (openPre > closePre) {
      chunk += '</code></pre>';
      remaining = '<pre><code>' + remaining;
    }

    parts.push(chunk);
  }

  return parts;
}

function findSplitPoint(text: string, max: number): number {
  const minSplit = Math.floor(max * 0.7);

  // Priority 1: After </pre>
  const preEnd = text.lastIndexOf('</pre>', max);
  if (preEnd > minSplit) return preEnd + 6;

  // Priority 2: Double newline (paragraph boundary)
  const doubleNl = text.lastIndexOf('\n\n', max);
  if (doubleNl > minSplit) return doubleNl + 2;

  // Priority 3: Single newline
  const singleNl = text.lastIndexOf('\n', max);
  if (singleNl > minSplit) return singleNl + 1;

  // Priority 4: Space
  const space = text.lastIndexOf(' ', max);
  if (space > minSplit) return space + 1;

  // Hard cut
  return max;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
