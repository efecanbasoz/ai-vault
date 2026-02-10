// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';

export function formatHeader(text: string): string {
  return `${BOLD}${CYAN}${text}${RESET}`;
}

export function formatSuccess(text: string): string {
  return `${GREEN}${text}${RESET}`;
}

export function formatError(text: string): string {
  return `${RED}${text}${RESET}`;
}

export function formatWarning(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}

export function formatDim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

export function formatPrompt(provider: string): string {
  return `${GRAY}[${provider}]${RESET} ${BOLD}>${RESET} `;
}

export function formatResponse(text: string, provider: string, durationMs: number, cost: number | null): string {
  const meta = [
    `${DIM}provider: ${provider}${RESET}`,
    `${DIM}time: ${(durationMs / 1000).toFixed(1)}s${RESET}`,
  ];
  if (cost !== null) {
    meta.push(`${DIM}cost: $${cost.toFixed(4)}${RESET}`);
  }
  return `\n${text}\n\n${meta.join('  ')}`;
}
