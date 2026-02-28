const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openPanel() {
  await vscode.commands.executeCommand('tacos.showNow');
  await wait(200);
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  await vscode.commands.executeCommand('tacos.__test.setPersistedBranch', 'feature/ABC-137-resume');
  await vscode.commands.executeCommand('tacos.__test.switchTaskPartition', 'TASK-137-A');
  await wait(200);
  await openPanel();

  const initialA = await vscode.commands.executeCommand('tacos.__test.getResumePathSnapshot');
  assert.ok(initialA, 'Expected resume path snapshot payload in first partition.');
  assert.ok(
    typeof initialA?.scope === 'string' && initialA.scope.includes('TASK-137-A'),
    'Expected resume path scope to include first partition key.',
  );
  assert.equal(
    Array.isArray(initialA?.completedStepIds) ? initialA.completedStepIds.length : -1,
    0,
    'Expected first partition to start with empty completion state.',
  );

  const toggleOk = await vscode.commands.executeCommand(
    'tacos.__test.toggleResumePathStep',
    'confirmIntent',
    true,
  );
  assert.equal(toggleOk, true, 'Expected resume path step toggle to succeed.');

  const completedA = await vscode.commands.executeCommand('tacos.__test.getResumePathSnapshot');
  assert.ok(
    completedA?.completedStepIds?.includes('confirmIntent'),
    'Expected first partition completion state to include confirmIntent.',
  );

  await vscode.commands.executeCommand('tacos.__test.switchTaskPartition', 'TASK-137-B');
  await wait(200);
  await openPanel();

  const snapshotB = await vscode.commands.executeCommand('tacos.__test.getResumePathSnapshot');
  assert.ok(snapshotB, 'Expected resume path snapshot payload in second partition.');
  assert.ok(
    typeof snapshotB?.scope === 'string' && snapshotB.scope.includes('TASK-137-B'),
    'Expected resume path scope to include second partition key.',
  );
  assert.notEqual(
    snapshotB?.storageKey,
    initialA?.storageKey,
    'Expected storage keys to differ between partition scopes.',
  );
  assert.equal(
    Array.isArray(snapshotB?.completedStepIds) ? snapshotB.completedStepIds.length : -1,
    0,
    'Expected second partition to remain isolated with no leaked completion state.',
  );
}

module.exports = {
  run,
};
