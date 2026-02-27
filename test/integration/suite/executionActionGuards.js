const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  const results = await vscode.commands.executeCommand(
    'tacos.__test.getExecutionActionGuardSnapshot',
  );
  assert.ok(results, 'Expected execution action guard payload.');

  assert.equal(
    results.restrictedTaskExecuted,
    false,
    'Expected rerun task to be blocked when trust override is restricted.',
  );
  assert.equal(
    results.restrictedDebugExecuted,
    false,
    'Expected rerun debug to be blocked when trust override is restricted.',
  );
  assert.equal(
    results.restrictedCheckoutExecuted,
    false,
    'Expected checkout previous branch to be blocked when trust override is restricted.',
  );

  assert.equal(
    results.trustedTaskWithoutPrereqExecuted,
    false,
    'Expected rerun task to no-op when no task prerequisite exists.',
  );
  assert.equal(
    results.trustedDebugWithoutPrereqExecuted,
    false,
    'Expected rerun debug to no-op when no debug prerequisite exists.',
  );
  assert.equal(
    results.trustedCheckoutWithoutPrereqExecuted,
    false,
    'Expected checkout to no-op when branch prerequisite is missing.',
  );
}

module.exports = {
  run,
};
