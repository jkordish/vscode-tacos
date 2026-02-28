const assert = require('node:assert/strict');
const vscode = require('vscode');

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

  try {
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);
    await config.update('uiSurface', 'statusbar', vscode.ConfigurationTarget.Global);

    const activeStatusSnapshot = await vscode.commands.executeCommand('tacos.__test.getStatusBarSnapshot');
    assert.equal(activeStatusSnapshot?.mode, 'active');
    assert.ok(
      typeof activeStatusSnapshot?.text === 'string' && activeStatusSnapshot.text.includes('TaCoS:'),
      'Expected status bar snapshot text to include TaCoS prefix.',
    );

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
    const promptMode = await vscode.commands.executeCommand('tacos.__test.getFocusPresentationMode');
    assert.equal(
      promptMode,
      'prompt',
      'Expected focus summaries to use prompt flow when uiSurface=notification.',
    );

    await config.update('uiSurface', 'silent', vscode.ConfigurationTarget.Global);
    const silentMode = await vscode.commands.executeCommand('tacos.__test.getFocusPresentationMode');
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

    await config.update('pauseSummaries', true, vscode.ConfigurationTarget.Global);
    const pausedStatusSnapshot = await vscode.commands.executeCommand('tacos.__test.getStatusBarSnapshot');
    assert.equal(pausedStatusSnapshot?.mode, 'paused');

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
  }
}

module.exports = {
  run,
};
