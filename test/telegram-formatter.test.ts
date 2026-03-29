import { expect, test } from 'vitest';
import { formatForTelegram } from '../src/interfaces/telegram/formatter';

test('formatForTelegram escapes quotes in fenced code language attributes', () => {
  const formatted = formatForTelegram('```ts" onclick="alert(1)\nconst x = 1;\n```');

  expect(formatted).toContain('<pre><code class="language-ts&quot; onclick=&quot;alert(1)">');
  expect(formatted).not.toContain('onclick="alert(1)"');
});

test('formatForTelegram still escapes code block contents as HTML text', () => {
  const formatted = formatForTelegram('```html\n<div class="test">x</div>\n```');

  expect(formatted).toContain('&lt;div class="test"&gt;x&lt;/div&gt;');
});
