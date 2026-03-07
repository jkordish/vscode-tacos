const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  const config = vscode.workspace.getConfiguration('tacos');
  const resumeSafetyEnabledInspect = config.inspect('resumeSafety.enabled');
  const originalResumeSafetyEnabledGlobal = resumeSafetyEnabledInspect?.globalValue;

  try {
    await config.update('resumeSafety.enabled', true, vscode.ConfigurationTarget.Global);

    await vscode.commands.executeCommand('tacos.showNow');
    await wait(200);

    const autoSnapshot = await vscode.commands.executeCommand('tacos.__test.getResumeSafetySnapshot');
    assert.equal(autoSnapshot?.visible, true, 'Expected Resume Safety Check to be visible after tacos.showNow.');
    assert.ok(
      typeof autoSnapshot?.text === 'string' &&
        autoSnapshot.text.includes('State:') &&
        autoSnapshot.text.includes('Risk:') &&
        autoSnapshot.text.includes('Verify:'),
      'Expected the status-bar annunciator to expose State / Risk / Verify text.',
    );
    assert.equal(
      autoSnapshot?.persisted?.trigger,
      'manual',
      'Expected manual resume safety trigger metadata after tacos.showNow.',
    );

    await vscode.commands.executeCommand('tacos.resumeSafetyRunVerifyAction');
    await wait(100);
    const afterVerify = await vscode.commands.executeCommand('tacos.__test.getResumeSafetySnapshot');
    assert.equal(afterVerify?.visible, false, 'Expected Resume Safety Check to hide after running its verification action.');

    await config.update('resumeSafety.enabled', false, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('tacos.showResumeSafetyCheck');
    await wait(100);
    const manualSnapshot = await vscode.commands.executeCommand('tacos.__test.getResumeSafetySnapshot');
    assert.equal(
      manualSnapshot?.visible,
      true,
      'Expected the manual Resume Safety Check command to force-show even when auto safety checks are disabled.',
    );
  } finally {
    await config.update(
      'resumeSafety.enabled',
      originalResumeSafetyEnabledGlobal,
      vscode.ConfigurationTarget.Global,
    );
  }
}

module.exports = {
  run,
};
