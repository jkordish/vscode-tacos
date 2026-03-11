const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');

  await extension.activate();
  assert.equal(extension.isActive, true, 'Expected extension to be active after activation.');

  const now = Date.now();

  await vscode.commands.executeCommand('tacos.__test.setTaskPartition', 'INC-420');
  const scopeA = await vscode.commands.executeCommand('tacos.__test.getPartitionScopeSnapshot');
  const currentBranch = scopeA?.scopeBranch ?? 'main';
  await vscode.commands.executeCommand('tacos.__test.seedStructuredTaskState', {
    taskId: 'task-inc-420',
    branch: currentBranch,
    objective: 'Stabilize the incident rollback flow',
    nextAction: 'Reopen the failing rollback check and verify the canary diff',
    blockers: ['Need one more failing canary log sample'],
    assumptions: ['Rollback branch still reflects the active prod fix'],
    breakpointFile: 'src/extension.ts',
    breakpointLine: 120,
    switchCount: 1,
    now,
  });

  await vscode.commands.executeCommand('tacos.__test.setTaskPartition', 'INC-421');
  await vscode.commands.executeCommand('tacos.__test.seedStructuredTaskState', {
    taskId: 'task-inc-421',
    branch: currentBranch,
    objective: 'Trace stale deploy context',
    nextAction: 'Compare the last two deploy manifests',
    blockers: ['Need fresh deploy metadata'],
    assumptions: ['Current workspace still matches the captured rollback state'],
    breakpointFile: 'src/summary.ts',
    breakpointLine: 212,
    switchCount: 3,
    staleAfter: now - 60_000,
    now: now - 5 * 60_000,
  });

  await vscode.commands.executeCommand('tacos.__test.setTaskPartition', 'INC-420');
  await vscode.commands.executeCommand('tacos.markTaskResolved');

  const afterResolve = await vscode.commands.executeCommand(
    'tacos.__test.getStructuredTaskStateSnapshot',
  );
  assert.equal(
    afterResolve?.tasks.some(
      (task) => task.taskId === 'task-inc-420' && task.resolutionState === 'resolved',
    ),
    true,
    'Expected markTaskResolved command to resolve the current structured task.',
  );

  await vscode.commands.executeCommand('tacos.showNow');
  await wait(200);

  const beforeResolve = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(
    beforeResolve?.hasPanelSummary,
    true,
    'Expected a live resume summary after tacos.showNow.',
  );

  const taskSnapshot = await vscode.commands.executeCommand(
    'tacos.__test.getStructuredTaskStateSnapshot',
  );
  const runtimeSnapshot = await vscode.commands.executeCommand(
    'tacos.__test.getRuntimeStateSnapshot',
  );
  assert.equal(taskSnapshot?.totalTasks >= 2, true, 'Expected seeded structured task states.');
  assert.equal(
    runtimeSnapshot?.activeStructuredTaskCount,
    1,
    'Expected only the unresolved structured task to remain active.',
  );
  assert.equal(
    taskSnapshot?.tasks.some(
      (task) => task.taskId === 'task-inc-421' && task.resolutionState === 'active',
    ),
    true,
    'Expected the unresolved task in the other partition to remain active.',
  );
}

module.exports = {
  run,
};
