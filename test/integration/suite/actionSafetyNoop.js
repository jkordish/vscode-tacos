const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  const results = await vscode.commands.executeCommand('tacos.__test.runActionSafetyNoopChecks');
  assert.ok(results, 'Expected action safety noop results payload.');
  assert.equal(
    results.restoreWithoutSummaryNoThrow,
    true,
    'Expected restore action to no-op safely when summary context is missing.',
  );
  assert.equal(
    results.rerunTaskWithoutTaskNoThrow,
    true,
    'Expected rerun-task action to no-op safely when no last task is available.',
  );
  assert.equal(
    results.rerunDebugWithoutSessionNoThrow,
    true,
    'Expected rerun-debug action to no-op safely when no last debug session is available.',
  );
  assert.equal(
    results.checkoutWithoutPreviousBranchNoThrow,
    true,
    'Expected checkout action to no-op safely when previous branch is unavailable.',
  );
  assert.equal(
    results.invalidNextStepActionNoThrow,
    true,
    'Expected invalid next-step action index to be blocked without throwing.',
  );
}

module.exports = {
  run,
};
