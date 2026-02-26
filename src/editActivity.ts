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
