const assert = require('node:assert/strict');
const vscode = require('vscode');

function formatMinuteOfDay(minute) {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minuteOfHour = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}`;
}

function quietWindowThatIncludesNow(now) {
  const date = new Date(now);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const startMinute = minuteOfDay - 1;
  const endMinute = minuteOfDay + 2;
  return `${formatMinuteOfDay(startMinute)}-${formatMinuteOfDay(endMinute)}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Expected extension to be active after activation.');

  const config = vscode.workspace.getConfiguration('tacos');
  const uiSurfaceInspected = config.inspect('uiSurface');
  const originalUiSurfaceGlobal = uiSurfaceInspected?.globalValue;
  const pauseInspected = config.inspect('pauseSummaries');
  const originalPauseGlobal = pauseInspected?.globalValue;
  const enabledInspected = config.inspect('enabled');
  const originalEnabledGlobal = enabledInspected?.globalValue;
  const summaryQuietHoursInspected = config.inspect('summaryQuietHours');
  const originalSummaryQuietHoursGlobal = summaryQuietHoursInspected?.globalValue;
  const percolationPolicyInspected = config.inspect('percolationPolicyEnabled');
  const originalPercolationPolicyGlobal = percolationPolicyInspected?.globalValue;
  const percolationExplainabilityInspected = config.inspect('percolationExplainabilityEnabled');
  const originalPercolationExplainabilityGlobal = percolationExplainabilityInspected?.globalValue;
  const percolationNotificationBrokerInspected = config.inspect(
    'percolationNotificationBrokerEnabled',
  );
  const originalPercolationNotificationBrokerGlobal =
    percolationNotificationBrokerInspected?.globalValue;

  try {
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);
    await config.update('uiSurface', 'statusbar', vscode.ConfigurationTarget.Global);
    await config.update('percolationPolicyEnabled', true, vscode.ConfigurationTarget.Global);
    await config.update(
      'percolationExplainabilityEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationNotificationBrokerEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );

    const activeStatusSnapshot = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.equal(activeStatusSnapshot?.mode, 'active');
    assert.ok(
      typeof activeStatusSnapshot?.text === 'string' &&
        activeStatusSnapshot.text.includes('TaCoS:'),
      'Expected status bar snapshot text to include TaCoS prefix.',
    );
    assert.equal(
      typeof activeStatusSnapshot?.statusClass === 'string' &&
        activeStatusSnapshot.statusClass.startsWith('active-'),
      true,
      'Expected active status bar class marker to be present.',
    );
    assert.equal(
      typeof activeStatusSnapshot?.statusReason === 'string' &&
        activeStatusSnapshot.statusReason.trim().length > 0,
      true,
      'Expected active status bar reason marker to be present.',
    );

    await config.update(
      'summaryQuietHours',
      quietWindowThatIncludesNow(Date.now()),
      vscode.ConfigurationTarget.Global,
    );
    const quietSuppressed = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.equal(
      quietSuppressed?.statusClass,
      'active-suppressed',
      'Expected quiet-hours suppression to surface as active-suppressed status class.',
    );
    assert.equal(
      quietSuppressed?.statusReason,
      'quiet window',
      'Expected quiet-hours suppression reason to use compact quiet-window label.',
    );
    assert.ok(
      typeof quietSuppressed?.text === 'string' && quietSuppressed.text.includes('TaCoS: calm'),
      'Expected suppressed status text to use calm compact label.',
    );
    const quietSuppressedAgain = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.equal(
      quietSuppressedAgain?.text,
      quietSuppressed?.text,
      'Expected compact suppressed status text to remain stable across repeated reads.',
    );
    await config.update('summaryQuietHours', '', vscode.ConfigurationTarget.Global);

    await vscode.commands.executeCommand('tacos.__test.setLastSummaryContextUnchanged', true);
    await vscode.commands.executeCommand('tacos.__test.setSummaryQuietUntil', Date.now() + 60_000);
    const temporaryQuietWithNoChange = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.equal(
      temporaryQuietWithNoChange?.statusClass,
      'active-suppressed',
      'Expected temporary quiet state to remain suppressed even when no-change suppression also applies.',
    );
    assert.equal(
      temporaryQuietWithNoChange?.statusReason,
      'quiet window',
      'Expected temporary quiet state to take precedence over generic no-change suppression reason.',
    );
    await vscode.commands.executeCommand('tacos.__test.setSummaryQuietUntil', 0);
    await vscode.commands.executeCommand('tacos.__test.setLastSummaryContextUnchanged', false);

    await config.update('uiSurface', 'statusbar', vscode.ConfigurationTarget.Global);
    const backgroundMode = await vscode.commands.executeCommand(
      'tacos.__test.getFocusPresentationMode',
    );
    assert.equal(
      backgroundMode,
      'background',
      'Expected focus summaries to refresh in background when uiSurface=statusbar.',
    );

    await config.update('uiSurface', 'notification', vscode.ConfigurationTarget.Global);
    const promptMode = await vscode.commands.executeCommand(
      'tacos.__test.getFocusPresentationMode',
    );
    assert.equal(
      promptMode,
      'prompt',
      'Expected focus summaries to use prompt flow when uiSurface=notification.',
    );

    await config.update('uiSurface', 'silent', vscode.ConfigurationTarget.Global);
    const silentMode = await vscode.commands.executeCommand(
      'tacos.__test.getFocusPresentationMode',
    );
    assert.equal(
      silentMode,
      'silent',
      'Expected focus summaries to use silent flow when uiSurface=silent.',
    );

    await config.update('uiSurface', 'notification', vscode.ConfigurationTarget.Global);
    const notificationDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        primary: {
          kind: 'blocked',
          actionId: 'restoreRerunTask',
          urgency: 0.95,
          confidence: 0.9,
          score: 0.88,
        },
      },
    );
    assert.equal(
      notificationDecision?.surface,
      'notification',
      'Expected notification surface when candidate is high-value and actionable.',
    );
    assert.equal(
      notificationDecision?.reason,
      'notification-high-value-actionable',
      'Expected broker reason enum for high-value notification path.',
    );

    const suppressedDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        suppressionReason: 'quiet-hours',
        primary: {
          kind: 'blocked',
          actionId: 'restoreRerunTask',
          urgency: 0.95,
          confidence: 0.9,
          score: 0.88,
        },
      },
    );
    assert.equal(
      suppressedDecision?.surface,
      'panel',
      'Expected suppression to downgrade notification-capable flow to panel emphasis.',
    );
    assert.equal(
      suppressedDecision?.reason,
      'notification-suppressed',
      'Expected explicit suppressed reason class for downgraded notification path.',
    );
    let invalidSuppressionError;
    try {
      await vscode.commands.executeCommand('tacos.__test.getFocusSurfaceDecision', {
        suppressionReason: 'unexpected-value',
      });
    } catch (error) {
      invalidSuppressionError = error;
    }
    assert.equal(
      Boolean(invalidSuppressionError),
      true,
      'Expected invalid suppression reason override to fail fast in test probe command.',
    );

    await config.update(
      'percolationNotificationBrokerEnabled',
      false,
      vscode.ConfigurationTarget.Global,
    );
    const brokerDisabledDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        suppressionReason: 'quiet-hours',
        primary: {
          kind: 'blocked',
          actionId: 'restoreRerunTask',
          urgency: 0.95,
          confidence: 0.9,
          score: 0.88,
        },
      },
    );
    assert.equal(
      brokerDisabledDecision?.surface,
      'notification',
      'Expected broker-disabled path to fall back to legacy notification prompt behavior.',
    );
    assert.equal(
      brokerDisabledDecision?.reason,
      'ui-surface-notification',
      'Expected broker-disabled fallback to emit legacy prompt reason.',
    );
    await config.update(
      'summaryQuietHours',
      quietWindowThatIncludesNow(Date.now()),
      vscode.ConfigurationTarget.Global,
    );
    const brokerDisabledQuietStatus = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.notEqual(
      brokerDisabledQuietStatus?.statusClass,
      'active-suppressed',
      'Expected broker-disabled status semantics to avoid suppressed class for quiet-hours fallback paths.',
    );
    assert.notEqual(
      brokerDisabledQuietStatus?.statusReason,
      'quiet window',
      'Expected broker-disabled status semantics to avoid quiet-window suppression reason.',
    );
    await config.update('summaryQuietHours', '', vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('tacos.__test.setLastSummaryContextUnchanged', true);
    const brokerDisabledNoChangeStatus = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.notEqual(
      brokerDisabledNoChangeStatus?.statusClass,
      'active-suppressed',
      'Expected broker-disabled status semantics to avoid suppressed class for no-change fallback paths.',
    );
    assert.notEqual(
      brokerDisabledNoChangeStatus?.statusReason,
      'no change',
      'Expected broker-disabled status semantics to avoid no-change suppression reason.',
    );
    await vscode.commands.executeCommand('tacos.__test.setLastSummaryContextUnchanged', false);

    await config.update(
      'percolationNotificationBrokerEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );
    await config.update('percolationPolicyEnabled', false, vscode.ConfigurationTarget.Global);
    const policyDisabledDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        suppressionReason: 'quiet-hours',
        primary: {
          kind: 'blocked',
          actionId: 'restoreRerunTask',
          urgency: 0.95,
          confidence: 0.9,
          score: 0.88,
        },
      },
    );
    assert.equal(
      policyDisabledDecision?.surface,
      'notification',
      'Expected policy-disabled path to ignore suppression and use legacy uiSurface behavior.',
    );
    assert.equal(
      policyDisabledDecision?.reason,
      'ui-surface-notification',
      'Expected policy-disabled fallback to emit legacy prompt reason.',
    );

    await config.update('uiSurface', 'silent', vscode.ConfigurationTarget.Global);
    const policyDisabledSilentDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        primary: {
          kind: 'blocked',
          actionId: 'restoreRerunTask',
          urgency: 0.95,
          confidence: 0.9,
          score: 0.88,
        },
      },
    );
    assert.equal(
      policyDisabledSilentDecision?.surface,
      'none',
      'Expected policy-disabled silent fallback to keep quiet none-surface behavior.',
    );
    assert.equal(
      policyDisabledSilentDecision?.reason,
      'ui-surface-silent',
      'Expected policy-disabled silent fallback to use ui-surface-silent reason.',
    );

    await config.update('percolationPolicyEnabled', true, vscode.ConfigurationTarget.Global);
    await config.update('uiSurface', 'notification', vscode.ConfigurationTarget.Global);

    await config.update('uiSurface', 'statusbar', vscode.ConfigurationTarget.Global);
    const cappedStatusbarDecision = await vscode.commands.executeCommand(
      'tacos.__test.getFocusSurfaceDecision',
      {
        primary: {
          kind: 'blocked',
          actionId: 'restoreRerunTask',
          urgency: 0.95,
          confidence: 0.9,
          score: 0.88,
        },
      },
    );
    assert.equal(
      cappedStatusbarDecision?.surface,
      'statusbar',
      'Expected uiSurface=statusbar to cap surfaced output to statusbar background flow.',
    );
    assert.equal(
      cappedStatusbarDecision?.reason,
      'ui-surface-statusbar-cap',
      'Expected statusbar cap reason enum when notification-capable candidate exists.',
    );

    await config.update('uiSurface', 'statusbar', vscode.ConfigurationTarget.Global);
    await config.update('percolationPolicyEnabled', true, vscode.ConfigurationTarget.Global);
    await config.update(
      'percolationExplainabilityEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );
    await vscode.commands.executeCommand('tacos.showNow');
    await wait(150);
    const explainabilityEnabledSnapshot = await vscode.commands.executeCommand(
      'tacos.__test.getResumeFlowSnapshot',
    );
    assert.equal(
      explainabilityEnabledSnapshot?.hasWhySurfacedAction,
      true,
      'Expected explainability-enabled mode to render Why am I seeing this? action in Companion Home.',
    );
    assert.equal(
      explainabilityEnabledSnapshot?.hasWhySurfacedDetails,
      true,
      'Expected explainability-enabled mode to render Trust Center explainability disclosure.',
    );

    await config.update(
      'percolationExplainabilityEnabled',
      false,
      vscode.ConfigurationTarget.Global,
    );
    await vscode.commands.executeCommand('tacos.showNow');
    await wait(150);
    const explainabilityDisabledSnapshot = await vscode.commands.executeCommand(
      'tacos.__test.getResumeFlowSnapshot',
    );
    assert.equal(
      explainabilityDisabledSnapshot?.hasWhySurfacedAction,
      false,
      'Expected explainability-disabled mode to hide Why am I seeing this? action in Companion Home.',
    );
    assert.equal(
      explainabilityDisabledSnapshot?.hasWhySurfacedDetails,
      false,
      'Expected explainability-disabled mode to hide Trust Center explainability disclosure.',
    );

    await config.update(
      'percolationExplainabilityEnabled',
      true,
      vscode.ConfigurationTarget.Global,
    );

    const now = Date.now();
    const boundaryDeferred = await vscode.commands.executeCommand(
      'tacos.__test.evaluateAutoTriggerDecision',
      {
        now,
        lastBlurAt: now - 30_000,
        lastSummaryAt: now - 10 * 60_000,
        significantChange: true,
        projectSwitched: false,
        lastBoundarySignalAt: 0,
      },
    );
    assert.equal(
      boundaryDeferred?.shouldTrigger,
      false,
      'Expected short-gap focus return to defer when no recent boundary signal exists.',
    );

    const boundaryAllowed = await vscode.commands.executeCommand(
      'tacos.__test.evaluateAutoTriggerDecision',
      {
        now,
        lastBlurAt: now - 30_000,
        lastSummaryAt: now - 10 * 60_000,
        significantChange: true,
        projectSwitched: false,
        lastBoundarySignalAt: now - 15_000,
      },
    );
    assert.equal(
      boundaryAllowed?.shouldTrigger,
      true,
      'Expected short-gap focus return to trigger when recent boundary signal exists.',
    );

    const deferralCapRelease = await vscode.commands.executeCommand(
      'tacos.__test.evaluateAutoTriggerDecision',
      {
        now,
        lastBlurAt: now - 4 * 60_000,
        lastSummaryAt: now - 10 * 60_000,
        significantChange: true,
        projectSwitched: false,
        lastBoundarySignalAt: 0,
      },
    );
    assert.equal(
      deferralCapRelease?.shouldTrigger,
      true,
      'Expected boundary deferral cap to eventually allow trigger after longer gap.',
    );

    const typingDeferral = await vscode.commands.executeCommand(
      'tacos.__test.evaluateFocusPromptDeferral',
      {
        focusGainedAt: now,
        observedAt: now + 2_100,
        lastMeaningfulActivityAt: now + 600,
        graceWindowMs: 2_000,
      },
    );
    assert.equal(
      typingDeferral,
      true,
      'Expected prompt deferral when meaningful activity occurs shortly after focus regain.',
    );

    const passiveReturn = await vscode.commands.executeCommand(
      'tacos.__test.evaluateFocusPromptDeferral',
      {
        focusGainedAt: now,
        observedAt: now + 2_100,
        lastMeaningfulActivityAt: now - 5_000,
        graceWindowMs: 2_000,
      },
    );
    assert.equal(
      passiveReturn,
      false,
      'Expected no prompt deferral when no recent interaction occurred after focus regain.',
    );

    await config.update('pauseSummaries', true, vscode.ConfigurationTarget.Global);
    const pausedStatusSnapshot = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.equal(pausedStatusSnapshot?.mode, 'paused');
    assert.equal(
      pausedStatusSnapshot?.statusReason,
      'settings pause',
      'Expected paused status reason to describe the active pause source.',
    );

    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);
    await config.update('enabled', false, vscode.ConfigurationTarget.Global);
    const disabledStatusSnapshot = await vscode.commands.executeCommand(
      'tacos.__test.getStatusBarSnapshot',
    );
    assert.equal(disabledStatusSnapshot?.mode, 'disabled');
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
      'summaryQuietHours',
      typeof originalSummaryQuietHoursGlobal === 'undefined'
        ? undefined
        : originalSummaryQuietHoursGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationPolicyEnabled',
      typeof originalPercolationPolicyGlobal === 'undefined'
        ? undefined
        : originalPercolationPolicyGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationExplainabilityEnabled',
      typeof originalPercolationExplainabilityGlobal === 'undefined'
        ? undefined
        : originalPercolationExplainabilityGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await config.update(
      'percolationNotificationBrokerEnabled',
      typeof originalPercolationNotificationBrokerGlobal === 'undefined'
        ? undefined
        : originalPercolationNotificationBrokerGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await vscode.commands.executeCommand('tacos.__test.setSummaryQuietUntil', 0);
    await vscode.commands.executeCommand('tacos.__test.setLastSummaryContextUnchanged', false);
  }
}

module.exports = {
  run,
};
