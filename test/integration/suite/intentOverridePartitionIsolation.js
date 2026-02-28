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

  await vscode.commands.executeCommand('tacos.__test.setPersistedBranch', 'feature/ABC-138-intent');
  await vscode.commands.executeCommand('tacos.__test.switchTaskPartition', 'TASK-138-A');
  await wait(200);
  await openPanel();

  const overrideIntent = 'Focus on restoring parser state before rerunning tests';
  const savedIntent = await vscode.commands.executeCommand(
    'tacos.__test.setIntentOverride',
    overrideIntent,
  );
  assert.equal(
    savedIntent,
    overrideIntent,
    'Expected intent override to save for first partition.',
  );

  const flowAfterOverride = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(flowAfterOverride?.summaryIntent, overrideIntent);
  assert.equal(flowAfterOverride?.intentOverridden, true);

  const snapshotA = await vscode.commands.executeCommand('tacos.__test.getIntentOverrideSnapshot');
  assert.ok(snapshotA, 'Expected intent override snapshot for first partition.');
  assert.ok(
    typeof snapshotA?.scope === 'string' && snapshotA.scope.includes('TASK-138-A'),
    'Expected first partition scope in intent override snapshot.',
  );
  assert.equal(snapshotA?.intent, overrideIntent);

  await vscode.commands.executeCommand('tacos.__test.switchTaskPartition', 'TASK-138-B');
  await wait(200);
  await openPanel();

  const flowB = await vscode.commands.executeCommand('tacos.__test.getResumeFlowSnapshot');
  assert.equal(
    flowB?.intentOverridden,
    false,
    'Expected second partition to start without override.',
  );
  assert.notEqual(
    flowB?.summaryIntent,
    overrideIntent,
    'Expected second partition summary intent to not inherit first partition override.',
  );
  const inferredIntentB = flowB?.summaryIntent;
  assert.ok(
    typeof inferredIntentB === 'string' && inferredIntentB.length > 0,
    'Expected inferred intent text to be available in second partition.',
  );

  const sameAsInferred = await vscode.commands.executeCommand(
    'tacos.__test.setIntentOverride',
    inferredIntentB,
  );
  assert.equal(
    sameAsInferred,
    null,
    'Expected saving intent equal to inferred value to clear override storage.',
  );

  const flowBAfterSameIntent = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(
    flowBAfterSameIntent?.intentOverridden,
    false,
    'Expected intentOverridden to remain false when override matches inferred intent.',
  );

  const snapshotB = await vscode.commands.executeCommand('tacos.__test.getIntentOverrideSnapshot');
  assert.ok(snapshotB, 'Expected intent override snapshot for second partition.');
  assert.ok(
    typeof snapshotB?.scope === 'string' && snapshotB.scope.includes('TASK-138-B'),
    'Expected second partition scope in intent override snapshot.',
  );
  assert.equal(snapshotB?.intent, undefined);
  assert.notEqual(
    snapshotA?.storageKey,
    snapshotB?.storageKey,
    'Expected different storage keys between partition scopes.',
  );

  await vscode.commands.executeCommand('tacos.__test.switchTaskPartition', 'TASK-138-A');
  await wait(200);
  await openPanel();

  const flowAfterReturn = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(flowAfterReturn?.summaryIntent, overrideIntent);
  assert.equal(flowAfterReturn?.intentOverridden, true);
}

module.exports = {
  run,
};
