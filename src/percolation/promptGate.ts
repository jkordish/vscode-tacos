import type { SummaryPresentationMode } from './surfaceBroker';

export interface PromptPrimaryGateInput {
  notificationBrokerEnabled: boolean;
  presentationMode: SummaryPresentationMode;
}

/**
 * Broker-driven prompt mode requires a ranked primary candidate.
 * Legacy prompt fallback mode does not.
 */
export function shouldRequirePromptPrimary(input: PromptPrimaryGateInput): boolean {
  return input.notificationBrokerEnabled && input.presentationMode === 'prompt';
}
