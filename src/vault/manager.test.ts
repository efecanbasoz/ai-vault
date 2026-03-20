import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getNote, createNote, deleteNote, listNotes } from './manager';

const TEST_VAULT = path.resolve('./vault');

test('getNote rejects path traversal attempts', async () => {
  assert.equal(await getNote('cli_local', '../../../etc/passwd'), null);
  assert.equal(await getNote('cli_local', 'brainstorm/../../etc/passwd'), null);
  assert.equal(await getNote('cli_local', 'brainstorm/../../../secret.md'), null);
  assert.equal(await getNote('cli_local', '..%2F..%2Fetc/passwd'), null);
});

test('getNote rejects invalid categories', async () => {
  assert.equal(await getNote('cli_local', 'malicious/test.md'), null);
  assert.equal(await getNote('cli_local', '../brainstorm/test.md'), null);
});

test('getNote rejects non-.md files', async () => {
  assert.equal(await getNote('cli_local', 'brainstorm/test.txt'), null);
  assert.equal(await getNote('cli_local', 'brainstorm/test.js'), null);
  assert.equal(await getNote('cli_local', 'brainstorm/test'), null);
});

test('getNote rejects paths with too many segments', async () => {
  assert.equal(await getNote('cli_local', 'brainstorm/sub/dir/test.md'), null);
  assert.equal(await getNote('cli_local', 'a/b/c/d.md'), null);
});

test('getNote rejects filenames containing ..', async () => {
  assert.equal(await getNote('cli_local', 'brainstorm/..test.md'), null);
  assert.equal(await getNote('cli_local', 'brainstorm/test..md'), null);
});

test('createNote and deleteNote round-trip works', async () => {
  const filepath = await createNote('cli_local', 'brainstorm', 'test-roundtrip', 'Test body');
  assert.match(filepath, /^brainstorm\/.+\.md$/);

  const note = await getNote('cli_local', filepath);
  assert.ok(note);
  assert.equal(note.metadata.title, 'test-roundtrip');
  assert.equal(note.metadata.category, 'brainstorm');

  const deleted = await deleteNote('cli_local', filepath);
  assert.equal(deleted, true);

  const afterDelete = await getNote('cli_local', filepath);
  assert.equal(afterDelete, null);
});

test('listNotes filters by category', async () => {
  const filepath = await createNote('cli_local', 'archive', 'list-test', 'Body');
  try {
    const archiveNotes = await listNotes('cli_local', 'archive');
    assert.ok(archiveNotes.some((n) => n.filepath === filepath));

    const brainstormNotes = await listNotes('cli_local', 'brainstorm');
    assert.ok(!brainstormNotes.some((n) => n.filepath === filepath));
  } finally {
    await deleteNote('cli_local', filepath);
  }
});
