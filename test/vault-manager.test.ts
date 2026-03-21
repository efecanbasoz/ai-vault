import { test, expect } from 'vitest';
import { getNote, createNote, deleteNote, listNotes } from '../src/vault/manager';

test('getNote rejects path traversal attempts', async () => {
  expect(await getNote('cli_local', '../../../etc/passwd')).toBe(null);
  expect(await getNote('cli_local', 'brainstorm/../../etc/passwd')).toBe(null);
  expect(await getNote('cli_local', 'brainstorm/../../../secret.md')).toBe(null);
  expect(await getNote('cli_local', '..%2F..%2Fetc/passwd')).toBe(null);
});

test('getNote rejects invalid categories', async () => {
  expect(await getNote('cli_local', 'malicious/test.md')).toBe(null);
  expect(await getNote('cli_local', '../brainstorm/test.md')).toBe(null);
});

test('getNote rejects non-.md files', async () => {
  expect(await getNote('cli_local', 'brainstorm/test.txt')).toBe(null);
  expect(await getNote('cli_local', 'brainstorm/test.js')).toBe(null);
  expect(await getNote('cli_local', 'brainstorm/test')).toBe(null);
});

test('getNote rejects paths with too many segments', async () => {
  expect(await getNote('cli_local', 'brainstorm/sub/dir/test.md')).toBe(null);
  expect(await getNote('cli_local', 'a/b/c/d.md')).toBe(null);
});

test('getNote rejects filenames containing ..', async () => {
  expect(await getNote('cli_local', 'brainstorm/..test.md')).toBe(null);
  expect(await getNote('cli_local', 'brainstorm/test..md')).toBe(null);
});

test('createNote and deleteNote round-trip works', async () => {
  const filepath = await createNote('cli_local', 'brainstorm', 'test-roundtrip', 'Test body');
  expect(filepath).toMatch(/^brainstorm\/.+\.md$/);

  const note = await getNote('cli_local', filepath);
  expect(note).toBeTruthy();
  expect(note!.metadata.title).toBe('test-roundtrip');
  expect(note!.metadata.category).toBe('brainstorm');

  const deleted = await deleteNote('cli_local', filepath);
  expect(deleted).toBe(true);

  const afterDelete = await getNote('cli_local', filepath);
  expect(afterDelete).toBe(null);
});

test('listNotes filters by category', async () => {
  const filepath = await createNote('cli_local', 'archive', 'list-test', 'Body');
  try {
    const archiveNotes = await listNotes('cli_local', 'archive');
    expect(archiveNotes.some((n) => n.filepath === filepath)).toBeTruthy();

    const brainstormNotes = await listNotes('cli_local', 'brainstorm');
    expect(brainstormNotes.some((n) => n.filepath === filepath)).toBe(false);
  } finally {
    await deleteNote('cli_local', filepath);
  }
});
