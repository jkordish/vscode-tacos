const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Expected extension to be active after activation.');

  const config = vscode.workspace.getConfiguration('tacos');
  const autoRefreshInspected = config.inspect('autoRefreshInBackground');
  const originalAutoRefreshGlobal = autoRefreshInspected?.globalValue;
  const pauseInspected = config.inspect('pauseSummaries');
  const originalPauseGlobal = pauseInspected?.globalValue;
  const enabledInspected = config.inspect('enabled');
  const originalEnabledGlobal = enabledInspected?.globalValue;

  try {
    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
    await config.update('pauseSummaries', false, vscode.ConfigurationTarget.Global);

    const activeStatusSnapshot = await vscode.commands.executeCommand('tacos.__test.getStatusBarSnapshot');
    assert.equal(activeStatusSnapshot?.mode, 'active');
    assert.ok(
      typeof activeStatusSnapshot?.text === 'string' && activeStatusSnapshot.text.includes('TaCoS:'),
      'Expected status bar snapshot text to include TaCoS prefix.',
    );

    await config.update('autoRefreshInBackground', true, vscode.ConfigurationTarget.Global);
    const backgroundMode = await vscode.commands.executeCommand(
      'tacos.__test.getFocusPresentationMode',
    );
    assert.equal(
      backgroundMode,
      'background',
      'Expected focus summaries to refresh in background when autoRefreshInBackground=true.',
    );

    await config.update('autoRefreshInBackground', false, vscode.ConfigurationTarget.Global);
    const promptMode = await vscode.commands.executeCommand('tacos.__test.getFocusPresentationMode');
    assert.equal(
      promptMode,
      'prompt',
      'Expected focus summaries to use prompt flow when autoRefreshInBackground=false.',
    );

    await config.update('pauseSummaries', true, vscode.ConfigurationTarget.Global);
    const pausedStatusSnapshot = await vscode.commands.executeCommand('tacos.__test.getStatusBarSnapshot');
    assert.equal(pausedStatusSnapshot?.mode, 'paused');
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
      'autoRefreshInBackground',
      typeof originalAutoRefreshGlobal === 'undefined' ? undefined : originalAutoRefreshGlobal,
      vscode.ConfigurationTarget.Global,
    );
  }
}

module.exports = {
  run,
};
