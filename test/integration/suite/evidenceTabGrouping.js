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

  // Open the panel so panelEvidenceGroupMode is initialized and panel HTML is available.
  await vscode.commands.executeCommand('tacos.showNow');
  await wait(150);

  // --- Initial state: group mode defaults to 'recent' ---
  const initialSnapshot = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(
    initialSnapshot?.evidenceGroupMode,
    'recent',
    'Expected panelEvidenceGroupMode to default to "recent" on panel open.',
  );
  assert.equal(
    initialSnapshot?.hasEvidenceGroupModeBar,
    true,
    'Expected evidence-group-mode-bar to be rendered in the panel.',
  );
  assert.equal(
    typeof initialSnapshot?.evidenceGroupModeBtnCount,
    'number',
    'Expected evidenceGroupModeBtnCount to be a number.',
  );
  assert.ok(
    (initialSnapshot?.evidenceGroupModeBtnCount ?? 0) >= 4,
    'Expected at least 4 evidence group mode toggle buttons (recent, by-file, by-time, by-action).',
  );
  assert.equal(
    initialSnapshot?.evidenceGroupModeBarActiveMode,
    'recent',
    'Expected the active aria-pressed button to reflect "recent" mode.',
  );

  // --- Switch to by-file mode ---
  await vscode.commands.executeCommand('tacos.__test.setEvidenceGroupMode', 'by-file');
  // Re-render the panel so the new mode is reflected.
  await vscode.commands.executeCommand('tacos.showNow');
  await wait(150);

  const byFileSnapshot = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(
    byFileSnapshot?.evidenceGroupMode,
    'by-file',
    'Expected panelEvidenceGroupMode to be "by-file" after setEvidenceGroupMode.',
  );

  // --- Switch to by-time mode ---
  await vscode.commands.executeCommand('tacos.__test.setEvidenceGroupMode', 'by-time');
  await vscode.commands.executeCommand('tacos.showNow');
  await wait(150);

  const byTimeSnapshot = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(
    byTimeSnapshot?.evidenceGroupMode,
    'by-time',
    'Expected panelEvidenceGroupMode to be "by-time" after setEvidenceGroupMode.',
  );

  // --- Switch to by-action mode ---
  await vscode.commands.executeCommand('tacos.__test.setEvidenceGroupMode', 'by-action');
  await vscode.commands.executeCommand('tacos.showNow');
  await wait(150);

  const byActionSnapshot = await vscode.commands.executeCommand(
    'tacos.__test.getResumeFlowSnapshot',
  );
  assert.equal(
    byActionSnapshot?.evidenceGroupMode,
    'by-action',
    'Expected panelEvidenceGroupMode to be "by-action" after setEvidenceGroupMode.',
  );

  // --- setEvidenceGroupMode rejects invalid modes ---
  let invalidModeError;
  try {
    await vscode.commands.executeCommand('tacos.__test.setEvidenceGroupMode', 'invalid-mode');
  } catch (error) {
    invalidModeError = error;
  }
  assert.ok(
    Boolean(invalidModeError),
    'Expected setEvidenceGroupMode to throw on an invalid mode string.',
  );

  let emptyModeError;
  try {
    await vscode.commands.executeCommand('tacos.__test.setEvidenceGroupMode', '');
  } catch (error) {
    emptyModeError = error;
  }
  assert.ok(
    Boolean(emptyModeError),
    'Expected setEvidenceGroupMode to throw when called with an empty string.',
  );

  // --- panel open resets mode to 'recent' ---
  // Dispose the panel to simulate a re-open.
  await vscode.commands.executeCommand('tacos.__test.disposePanel');
  await wait(50);
  await vscode.commands.executeCommand('tacos.showNow');
  await wait(150);

  const resetSnapshot = await vscode.commands.executeCommand('tacos.__test.getResumeFlowSnapshot');
  assert.equal(
    resetSnapshot?.evidenceGroupMode,
    'recent',
    'Expected panelEvidenceGroupMode to reset to "recent" after panel re-open.',
  );
  assert.equal(
    resetSnapshot?.hasEvidenceSection,
    true,
    'Expected evidence panel section to be rendered after panel re-open.',
  );
}

module.exports = {
  run,
};
