import { config } from '../config.js';
import { logger } from '../logger.js';
import { execute } from '../core/engine.js';
import { getAllNoteContents, createNote } from '../vault/manager.js';
import { analyzeVault } from './analyzer.js';
import type { UserId } from '../types.js';

export async function runSynthesis(userId: UserId): Promise<string> {
  logger.info({ userId }, 'Starting vault synthesis');

  const notes = await getAllNoteContents(userId);
  if (notes.length === 0) {
    logger.info('No notes to synthesize');
    return '';
  }

  const analysis = analyzeVault(notes);

  // Build synthesis prompt
  const prompt = buildSynthesisPrompt(analysis, notes.length);

  // Run through configured synthesis provider
  const result = await execute({
    userId,
    message: prompt,
    sessionId: null,
    providerId: config.SYNTHESIS_PROVIDER,
  });

  if (result.isError) {
    logger.error({ error: result.text }, 'Synthesis failed');
    throw new Error(result.text);
  }

  // Save digest as an active note
  const date = new Date().toISOString().slice(0, 10);
  const filepath = await createNote(
    userId,
    'active',
    `weekly-digest-${date}`,
    result.text,
    ['synthesis', 'digest'],
  );

  logger.info({ filepath, userId }, 'Synthesis complete');
  return filepath;
}

function buildSynthesisPrompt(
  analysis: ReturnType<typeof analyzeVault>,
  totalNotes: number,
): string {
  let prompt = `You are analyzing a knowledge vault with ${totalNotes} notes. Generate a concise weekly digest.\n\n`;

  if (analysis.clusters.length > 0) {
    prompt += `## Emerging Themes\n`;
    for (const cluster of analysis.clusters) {
      prompt += `- **${cluster.theme}**: found in ${cluster.notes.length} notes (${cluster.notes.join(', ')})\n`;
    }
    prompt += '\n';
  }

  if (analysis.forgottenIdeas.length > 0) {
    prompt += `## Forgotten Ideas (untouched 30+ days)\n`;
    for (const filepath of analysis.forgottenIdeas) {
      prompt += `- ${filepath}\n`;
    }
    prompt += '\n';
  }

  prompt += `## Task\n`;
  prompt += `1. Summarize the key themes and connections you see\n`;
  prompt += `2. Suggest which forgotten ideas might be worth revisiting\n`;
  prompt += `3. Identify potential connections between different themes\n`;
  prompt += `4. Recommend 2-3 actionable next steps\n\n`;
  prompt += `Format as a clean markdown document suitable for a weekly digest note.`;

  return prompt;
}
