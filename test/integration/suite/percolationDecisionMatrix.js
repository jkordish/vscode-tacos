const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HIGH_VALUE_BLOCKED_PRIMARY = {
  kind: 'blocked',
  actionId: 'restoreRerunTask',
  urgency: 0.95,
  confidence: 0.9,
  score: 0.88,
};

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  const config = vscode.workspace.getConfiguration('tacos');
  const enabledInspected = config.inspect('enabled');
  const pauseInspected = config.inspect('pauseSummaries');
  const uiSurfaceInspected = config.inspect('uiSurface');
  const policyInspected = config.inspect('percolationPolicyEnabled');
  const brokerInspected = config.inspect('percolationNotificationBrokerEnabled');
  const explainabilityInspected = config.inspect('percolationExplainabilityEnabled');
  const originalEnabledGlobal = enabledInspected?.globalValue;
  const originalPauseGlobal = pauseInspected?.globalValue;
  const originalUiSurfaceGlobal = uiSurfaceInspected?.globalValue;
  const originalPolicyGlobal = policyInspected?.globalValue;
  const originalBrokerGlobal = brokerInspected?.globalValue;
  const originalExplainabilityGlobal = explainabilityInspected?.globalValue;

  try {
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);
    await config.update('uiSurface', 'notification', vscode.ConfigurationTarget.Global);
    await config.update('percolationPolicyEnabled', true, vscode.ConfigurationTarget.Global);
    await config.update(
      'percolationNotificationBrokerEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationExplainabilityEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );

    const baselineDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        primary: HIGH_VALUE_BLOCKED_PRIMARY,
      },
    );
    assert.equal(
      baselineDecision?.surface,
      'notification',
      'Expected baseline high-value actionable decision to use notification surface.',
    );
    assert.equal(
      baselineDecision?.reason,
      'notification-high-value-actionable',
      'Expected baseline matrix decision to use high-value notification reason.',
    );

    for (const suppressionReason of ['quiet-hours', 'cooldown', 'no-change']) {
      const decision = await vscode.commands.executeCommand('tacos.__test.getFocusSurfaceDecision', {
        suppressionReason,
        primary: HIGH_VALUE_BLOCKED_PRIMARY,
      });
      assert.equal(
        decision?.surface,
        'panel',
        `Expected suppression=${suppressionReason} to downgrade decision surface to panel.`,
      );
      assert.equal(
        decision?.reason,
        'notification-suppressed',
        `Expected suppression=${suppressionReason} to map to notification-suppressed reason.`,
      );
      assert.equal(
        decision?.suppressionReason,
        suppressionReason,
        `Expected suppression=${suppressionReason} to preserve the suppression reason in decision payload.`,
      );
    }

    await config.update(
      'percolationNotificationBrokerEnabled',
      false,
      vscode.ConfigurationTarget.Global,
    );
    const brokerDisabledSuppressedDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        suppressionReason: 'quiet-hours',
        primary: HIGH_VALUE_BLOCKED_PRIMARY,
      },
    );
    assert.equal(
      brokerDisabledSuppressedDecision?.surface,
      'notification',
      'Expected broker-disabled mode to keep legacy notification surface even when suppression reason is present.',
    );
    assert.equal(
      brokerDisabledSuppressedDecision?.reason,
      'ui-surface-notification',
      'Expected broker-disabled mode to report legacy ui-surface-notification reason.',
    );
    const brokerDisabledNoPrimaryDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        suppressionReason: 'quiet-hours',
      },
    );
    assert.equal(
      brokerDisabledNoPrimaryDecision?.surface,
      'notification',
      'Expected broker-disabled mode to keep legacy notification surface when no ranked primary is present.',
    );
    assert.equal(
      brokerDisabledNoPrimaryDecision?.reason,
      'ui-surface-notification',
      'Expected broker-disabled no-primary path to keep legacy notification reason.',
    );
    await config.update(
      'percolationNotificationBrokerEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );

    const restrictedExecutionGuards = await vscode.commands.executeCommand(
      'tacos.__test.getExecutionActionGuardSnapshot',
    );
    assert.ok(
      restrictedExecutionGuards,
      'Expected execution guard snapshot for restricted path assertions in matrix suite.',
    );
    assert.equal(
      restrictedExecutionGuards?.restrictedTaskExecuted,
      false,
      'Expected rerun task to remain blocked in restricted path guard checks.',
    );
    assert.equal(
      restrictedExecutionGuards?.restrictedDebugExecuted,
      false,
      'Expected rerun debug to remain blocked in restricted path guard checks.',
    );
    assert.equal(
      restrictedExecutionGuards?.restrictedCheckoutExecuted,
      false,
      'Expected checkout previous branch to remain blocked in restricted path guard checks.',
    );

    await vscode.env.clipboard.writeText('percolation decision matrix integration note');
    await vscode.commands.executeCommand('tacos.showNow');
    await wait(150);
    const resumeFlow = await vscode.commands.executeCommand('tacos.__test.getResumeFlowSnapshot');
    assert.ok(resumeFlow, 'Expected resume flow snapshot for CTA uniqueness assertion.');
    assert.equal(
      (resumeFlow?.totalPrimaryCtaCount ?? 0) <= 1,
      true,
      'Expected matrix suite to preserve single-primary CTA invariant across Next and Blocked slots.',
    );
  } finally {
    await config.update(
      'enabled',
      typeof originalEnabledGlobal === 'undefined' ? undefined : originalEnabledGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'pauseSummaries',
      typeof originalPauseGlobal === 'undefined' ? undefined : originalPauseGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'uiSurface',
      typeof originalUiSurfaceGlobal === 'undefined' ? undefined : originalUiSurfaceGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationPolicyEnabled',
      typeof originalPolicyGlobal === 'undefined' ? undefined : originalPolicyGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationNotificationBrokerEnabled',
      typeof originalBrokerGlobal === 'undefined' ? undefined : originalBrokerGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationExplainabilityEnabled',
      typeof originalExplainabilityGlobal === 'undefined'
        ? undefined
        : originalExplainabilityGlobal,
      vscode.ConfigurationTarget.Global,
    );
  }
}

module.exports = {
  run,
};
