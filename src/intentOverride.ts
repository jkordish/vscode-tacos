export const INTENT_OVERRIDE_STORAGE_KEY_PREFIX = 'tacos.intentOverride';
export const MAX_INTENT_OVERRIDE_CHARS = 280;

export interface IntentOverrideState {
  contextHash: string;
  intent: string;
  updatedAt: number;
}

export function buildIntentOverrideStorageKey(scope: string): string {
  return `${INTENT_OVERRIDE_STORAGE_KEY_PREFIX}.${Buffer.from(
    scope.trim() || '__no_scope__',
  ).toString('base64url')}`;
}

export function normalizeIntentOverrideText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  const normalized = raw
    .replace(/\r?\n/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MAX_INTENT_OVERRIDE_CHARS);
  return normalized || undefined;
}

export function createIntentOverrideState(
  contextHash: string,
  intent: string,
  updatedAt = Date.now(),
): IntentOverrideState {
  return {
    contextHash,
    intent,
    updatedAt,
  };
}

export function normalizeIntentOverrideState(
  raw: unknown,
  contextHash: string,
): IntentOverrideState | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  const storedContextHash =
    typeof record.contextHash === 'string' ? record.contextHash.trim() : undefined;
  if (!storedContextHash || storedContextHash !== contextHash) {
    return undefined;
  }

  const intent = normalizeIntentOverrideText(record.intent);
  if (!intent) {
    return undefined;
  }

  const updatedAt =
    typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : Date.now();
  return createIntentOverrideState(contextHash, intent, updatedAt);
}
