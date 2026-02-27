export interface EditActivityDecisionInput {
  documentScheme: string;
  hasMeaningfulChange: boolean;
  hasMetricSession: boolean;
  hasCapturedFirstMeaningfulEdit: boolean;
}

export interface EditActivityDecision {
  shouldMarkMeaningfulActivity: boolean;
  shouldCaptureMetricLag: boolean;
}

export interface EditLocation {
  path: string;
  line: number;
  character: number;
  timestamp: number;
}

export interface CaptureEditLocationInput {
  documentScheme: string;
  hasMeaningfulChange: boolean;
  relativePath: string;
  now: number;
  fallbackLine: number;
  fallbackCharacter: number;
  selectionLine?: number;
  selectionCharacter?: number;
}

export function decideEditActivity(input: EditActivityDecisionInput): EditActivityDecision {
  if (input.documentScheme !== 'file' || !input.hasMeaningfulChange) {
    return {
      shouldMarkMeaningfulActivity: false,
      shouldCaptureMetricLag: false,
    };
  }

  return {
    shouldMarkMeaningfulActivity: true,
    shouldCaptureMetricLag: input.hasMetricSession && !input.hasCapturedFirstMeaningfulEdit,
  };
}

export function captureEditLocation(input: CaptureEditLocationInput): EditLocation | undefined {
  if (input.documentScheme !== 'file' || !input.hasMeaningfulChange || !input.relativePath.trim()) {
    return undefined;
  }

  const line =
    typeof input.selectionLine === 'number' && input.selectionLine >= 0
      ? input.selectionLine
      : input.fallbackLine;
  const character =
    typeof input.selectionCharacter === 'number' && input.selectionCharacter >= 0
      ? input.selectionCharacter
      : input.fallbackCharacter;
  if (!Number.isInteger(line) || line < 0 || !Number.isInteger(character) || character < 0) {
    return undefined;
  }

  return {
    path: input.relativePath.trim(),
    line,
    character,
    timestamp: input.now,
  };
}

export function pushRecentEditLocation(
  existing: EditLocation[],
  next: EditLocation,
  limit: number,
): EditLocation[] {
  const seen = new Set<string>();
  const merged: EditLocation[] = [];

  for (const entry of [next, ...existing]) {
    const key = `${entry.path}:${entry.line}:${entry.character}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(entry);
  }

  return merged.slice(0, Math.max(1, limit));
}
