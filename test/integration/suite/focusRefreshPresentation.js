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

  try {
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);
    await config.update('uiSurface', 'statusbar', vscode.ConfigurationTarget.Global);

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
    await vscode.commands.executeCommand('tacos.__test.setSummaryQuietUntil', 0);
    await vscode.commands.executeCommand('tacos.__test.setLastSummaryContextUnchanged', false);
  }
}

module.exports = {
  run,
};
