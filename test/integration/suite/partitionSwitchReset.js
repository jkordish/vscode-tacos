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
  await vscode.commands.executeCommand('tacos.__test.setLastSummaryContextUnchanged', true);
  await vscode.commands.executeCommand('tacos.__test.seedScopeSuppressionState', {
    autoTriggerFingerprint: 'seeded-fingerprint',
    nudgeShownAt: Date.now(),
    noiseBudgetEvents: [
      {
        kind: 'summary-prompt',
        at: Date.now(),
      },
    ],
  });
  const before = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(before?.panelOpen, true, 'Expected details panel to be open after tacos.showNow.');
  assert.equal(
    before?.hasScratchSummary,
    true,
    'Expected scratch summary to be populated before partition switch.',
  );
  assert.equal(
    before?.lastSummaryContextUnchanged,
    true,
    'Expected no-change runtime flag to be set before partition switch reset.',
  );
  assert.equal(
    typeof before?.scopedAutoTriggerFingerprint === 'string' &&
      before.scopedAutoTriggerFingerprint.length > 0,
    true,
    'Expected scoped auto-trigger fingerprint to be seeded before partition switch.',
  );
  assert.equal(
    typeof before?.scopedNudgeShownAt === 'number' && before.scopedNudgeShownAt > 0,
    true,
    'Expected scoped nudge cooldown memory to be seeded before partition switch.',
  );
  assert.equal(
    before?.scopedNoiseBudgetEventCount,
    1,
    'Expected scoped noise-budget memory to be seeded before partition switch.',
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
  assert.equal(
    after?.lastSummaryContextUnchanged,
    false,
    'Expected no-change runtime flag to reset on partition switch.',
  );
  assert.equal(
    after?.activeNudgeContextHash,
    undefined,
    'Expected active nudge state to reset on partition switch.',
  );
  assert.equal(
    after?.scopedAutoTriggerFingerprint,
    '',
    'Expected scoped auto-trigger fingerprint to reset for destination partition.',
  );
  assert.equal(
    after?.scopedNudgeShownAt,
    0,
    'Expected scoped nudge cooldown memory to reset for destination partition.',
  );
  assert.equal(
    after?.scopedNoiseBudgetEventCount,
    0,
    'Expected scoped noise-budget memory to reset for destination partition.',
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
