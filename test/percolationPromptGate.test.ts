import { shouldRequirePromptPrimary } from '../src/percolation/promptGate';

describe('percolation prompt primary gate', () => {
  it('requires a ranked primary when broker-driven prompt mode is active', () => {
    expect(
      shouldRequirePromptPrimary({
        notificationBrokerEnabled: true,
        presentationMode: 'prompt',
      }),
    ).toBe(true);
  });

  it('does not require a ranked primary when broker is disabled', () => {
    expect(
      shouldRequirePromptPrimary({
        notificationBrokerEnabled: false,
        presentationMode: 'prompt',
      }),
    ).toBe(false);
  });

  it('does not require a ranked primary for non-prompt modes', () => {
    expect(
      shouldRequirePromptPrimary({
        notificationBrokerEnabled: true,
        presentationMode: 'background',
      }),
    ).toBe(false);

    expect(
      shouldRequirePromptPrimary({
        notificationBrokerEnabled: true,
        presentationMode: 'silent',
      }),
    ).toBe(false);
  });
});
