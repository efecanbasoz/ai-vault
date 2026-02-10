import type { Context } from 'hono';
import { config } from '../../config.js';
import { execute } from '../../core/engine.js';
import { getSession, resetSession, setProvider } from '../../core/session.js';
import { cancelCurrent } from '../../core/queue.js';
import { listProviders, getProvider } from '../../providers/registry.js';
import * as vault from '../../vault/manager.js';
import { search } from '../../vault/search.js';
import type { VaultCategory } from '../../types.js';

function getUserId(c: Context): string {
  return c.get('userId') ?? 'api_anonymous';
}

// POST /api/v1/chat
export async function chatHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const body = await c.req.json<{ message: string; provider?: string }>();

  if (!body.message) {
    return c.json({ error: 'message is required' }, 400);
  }

  const result = await execute({
    userId,
    message: body.message,
    sessionId: getSession(userId, config.DEFAULT_PROVIDER).sessionId,
    providerId: body.provider,
  });

  return c.json(result);
}

// DELETE /api/v1/session
export async function sessionResetHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  cancelCurrent(userId, config.DEFAULT_PROVIDER);
  resetSession(userId);
  return c.json({ ok: true });
}

// GET /api/v1/vault/notes
export async function listNotesHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const category = c.req.query('category') as VaultCategory | undefined;
  const notes = await vault.listNotes(userId, category);
  return c.json({ notes });
}

// GET /api/v1/vault/notes/:filepath
export async function getNoteHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const filepath = c.req.param('filepath');
  if (!filepath) return c.json({ error: 'filepath is required' }, 400);

  const note = await vault.getNote(userId, decodeURIComponent(filepath));
  if (!note) return c.json({ error: 'Note not found' }, 404);
  return c.json({ note });
}

// POST /api/v1/vault/notes
export async function createNoteHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const body = await c.req.json<{
    category: VaultCategory;
    title: string;
    body: string;
    tags?: string[];
  }>();

  if (!body.category || !body.title || !body.body) {
    return c.json({ error: 'category, title, and body are required' }, 400);
  }

  const filepath = await vault.createNote(userId, body.category, body.title, body.body, body.tags);
  return c.json({ filepath }, 201);
}

// PUT /api/v1/vault/notes/:filepath
export async function updateNoteHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const filepath = c.req.param('filepath');
  if (!filepath) return c.json({ error: 'filepath is required' }, 400);

  const body = await c.req.json<{ body: string }>();
  if (!body.body) return c.json({ error: 'body is required' }, 400);

  const updated = await vault.updateNote(userId, decodeURIComponent(filepath), body.body);
  if (!updated) return c.json({ error: 'Note not found' }, 404);
  return c.json({ ok: true });
}

// DELETE /api/v1/vault/notes/:filepath
export async function deleteNoteHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const filepath = c.req.param('filepath');
  if (!filepath) return c.json({ error: 'filepath is required' }, 400);

  const deleted = await vault.deleteNote(userId, decodeURIComponent(filepath));
  if (!deleted) return c.json({ error: 'Note not found' }, 404);
  return c.json({ ok: true });
}

// POST /api/v1/vault/search
export async function searchHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const body = await c.req.json<{
    query: string;
    category?: VaultCategory;
    tags?: string[];
    limit?: number;
  }>();

  if (!body.query) return c.json({ error: 'query is required' }, 400);

  const results = await search(userId, body.query, {
    category: body.category,
    tags: body.tags,
    limit: body.limit,
  });
  return c.json({ results });
}

// POST /api/v1/vault/save
export async function saveFromChatHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const body = await c.req.json<{
    category?: VaultCategory;
    title?: string;
  }>();

  const session = getSession(userId, config.DEFAULT_PROVIDER);
  const lastMessages = session.messageHistory.slice(-2);

  if (lastMessages.length === 0) {
    return c.json({ error: 'No conversation to save' }, 400);
  }

  const content = lastMessages.map((m) => `**${m.role}:** ${m.content}`).join('\n\n---\n\n');
  const category = body.category ?? 'brainstorm';
  const filepath = await vault.saveFromChat(userId, category, content, body.title);
  return c.json({ filepath }, 201);
}

// POST /api/v1/synthesize
export async function synthesizeHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  try {
    const { runSynthesis } = await import('../../synthesis/digest.js');
    const result = await runSynthesis(userId);
    return c.json({ filepath: result });
  } catch {
    return c.json({ error: 'Synthesis not available' }, 501);
  }
}

// GET /api/v1/providers
export async function providersHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const session = getSession(userId, config.DEFAULT_PROVIDER);
  const providers = listProviders().map((p) => ({
    id: p.id,
    name: p.name,
    mode: p.mode,
    active: p.id === session.providerId,
  }));
  return c.json({ providers });
}

// PUT /api/v1/provider
export async function setProviderHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const body = await c.req.json<{ provider: string }>();

  if (!body.provider) return c.json({ error: 'provider is required' }, 400);

  const provider = getProvider(body.provider);
  if (!provider) return c.json({ error: 'Unknown provider' }, 404);

  setProvider(userId, body.provider, config.DEFAULT_PROVIDER);
  return c.json({ ok: true, provider: { id: provider.id, name: provider.name } });
}

// GET /api/v1/status
export async function statusHandler(c: Context): Promise<Response> {
  const userId = getUserId(c);
  const session = getSession(userId, config.DEFAULT_PROVIDER);
  return c.json({
    userId,
    provider: session.providerId,
    sessionId: session.sessionId ? session.sessionId.slice(0, 12) + '...' : null,
    busy: session.busy,
    messageCount: session.messageHistory.length,
    providers: listProviders().map((p) => p.id),
  });
}
