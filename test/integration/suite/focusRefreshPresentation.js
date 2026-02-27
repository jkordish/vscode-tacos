const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Expected extension to be active after activation.');

  const config = vscode.workspace.getConfiguration('tacos');
  const inspected = config.inspect('autoRefreshInBackground');
  const originalGlobal = inspected?.globalValue;

  try {
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
  } finally {
    await config.update(
      'autoRefreshInBackground',
      typeof originalGlobal === 'undefined' ? undefined : originalGlobal,
      vscode.ConfigurationTarget.Global,
    );
  }
}

module.exports = {
  run,
};
