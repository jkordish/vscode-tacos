const CHATGPT_OPEN_COMMAND_CANDIDATES = [
  'chatgpt.newCodexPanel',
  'chatgpt.openSidebar',
  'chatgpt.newChat',
];

const LEGACY_OPEN_COMMAND_CANDIDATES = [
  'openai.codex.open',
  'openai.codex.openPanel',
  'openai.codex.focus',
  'openai.codex.showPanel',
  'codex.open',
  'codex.focus',
  'codex.show',
  'codex.openPanel',
];

function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

export function resolveCodexOpenCommandCandidates(
  configuredCommand: string,
  knownCommands: string[],
): string[] {
  const knownSet = new Set(knownCommands);

  const inferredCandidates = knownCommands
    .filter((id) => /codex/i.test(id))
    .filter((id) => /(open|show|focus|panel|view)/i.test(id))
    .slice(0, 12);

  return uniqueTrimmed([
    ...CHATGPT_OPEN_COMMAND_CANDIDATES,
    configuredCommand,
    ...LEGACY_OPEN_COMMAND_CANDIDATES,
    ...inferredCandidates,
  ]).filter((id) => knownSet.has(id));
}
