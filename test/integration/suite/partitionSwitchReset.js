const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  await vscode.commands.executeCommand('tacos.showNow');
  const before = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(before?.panelOpen, true, 'Expected details panel to be open after tacos.showNow.');
  assert.equal(
    before?.hasScratchSummary,
    true,
    'Expected scratch summary to be populated before partition switch.',
  );

  await vscode.commands.executeCommand('tacos.__test.switchTaskPartition', 'HOTFIX-2');
  await wait(200);

  const after = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(after?.panelOpen, false, 'Expected panel to close after partition switch.');
  assert.equal(
    after?.hasScratchSummary,
    false,
    'Expected scratch summary to reset after partition switch.',
  );
  assert.equal(
    after?.panelWorkspaceRoot,
    undefined,
    'Expected panel workspace root to clear when panel is disposed.',
  );

  const scopeAfter = await vscode.commands.executeCommand('tacos.__test.getPartitionScopeSnapshot');
  assert.equal(
    scopeAfter?.resolvedTaskPartition,
    'HOTFIX-2',
    'Expected partition snapshot to reflect switched partition key.',
  );

  await vscode.commands.executeCommand('tacos.showNow');
  const afterResume = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(
    afterResume?.panelOpen,
    true,
    'Expected panel to open again after summary is re-triggered.',
  );
}

module.exports = {
  run,
};
