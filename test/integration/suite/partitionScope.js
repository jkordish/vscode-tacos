const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Expected extension to be active after activation.');

  await vscode.commands.executeCommand('tacos.__test.setPersistedBranch', 'feature/ABC-123-scope');
  await vscode.commands.executeCommand('tacos.__test.setTaskPartition', '');

  const inferred = await vscode.commands.executeCommand('tacos.__test.getPartitionScopeSnapshot');
  assert.equal(inferred?.scopeBranch, 'feature/ABC-123-scope');
  assert.equal(inferred?.manualTaskPartition, '');
  assert.equal(inferred?.resolvedTaskPartition, 'ABC-123');
  assert.ok(
    typeof inferred?.scope === 'string' && inferred.scope.includes('::feature/ABC-123-scope::ABC-123'),
    'Expected inferred scope to contain branch and inferred partition.',
  );

  await vscode.commands.executeCommand('tacos.__test.setTaskPartition', 'HOTFIX-1');
  const manual = await vscode.commands.executeCommand('tacos.__test.getPartitionScopeSnapshot');
  assert.equal(manual?.manualTaskPartition, 'HOTFIX-1');
  assert.equal(manual?.resolvedTaskPartition, 'HOTFIX-1');
  assert.notEqual(manual?.scope, inferred?.scope, 'Expected manual partition to change scope.');

  await vscode.commands.executeCommand('tacos.__test.setTaskPartition', '');
  await vscode.commands.executeCommand('tacos.__test.setPersistedBranch', 'feature/no-ticket');
  const fallback = await vscode.commands.executeCommand('tacos.__test.getPartitionScopeSnapshot');
  assert.equal(fallback?.resolvedTaskPartition, 'default');
}

module.exports = {
  run,
};
