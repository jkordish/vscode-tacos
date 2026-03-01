const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();

  await vscode.commands.executeCommand('tacos.showDemoResumeCard');
  await wait(200);

  const runtime = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(runtime?.panelOpen, true, 'Expected panel to open for demo resume card command.');
  assert.equal(
    runtime?.panelTitle,
    'TaCoS Resume Brief (Sample)',
    'Expected sample title marker for demo resume card.',
  );
  assert.equal(
    runtime?.panelWorkspaceRoot,
    undefined,
    'Expected demo resume panel to avoid binding workspace scope state.',
  );

  const resumeFlow = await vscode.commands.executeCommand('tacos.__test.getResumeFlowSnapshot');
  assert.ok(resumeFlow, 'Expected resume flow snapshot payload for demo mode.');
  assert.equal(resumeFlow?.isDemoSummary, true, 'Expected demo summary marker.');
  assert.equal(resumeFlow?.hasDemoResumeCard, true, 'Expected demo notice card in panel HTML.');
  assert.equal(
    resumeFlow?.hasDismissDemoResumeAction,
    true,
    'Expected dismiss action for sample card.',
  );
  assert.equal(
    resumeFlow?.hasDemoIntentEditorReadOnly,
    true,
    'Expected intent editor to render in read-only mode for demo card.',
  );
  assert.equal(
    resumeFlow?.hasDemoResumePathReadOnly,
    true,
    'Expected Resume Path card to render in read-only mode for demo card.',
  );
  assert.equal(
    resumeFlow?.disabledResumePathToggleCount,
    resumeFlow?.resumePathStepCount,
    'Expected all Resume Path toggles to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledRestoreWorkingSet,
    true,
    'Expected restore actions to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledRestoreRerunTask,
    true,
    'Expected rerun task action to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledRestoreRerunDebug,
    true,
    'Expected rerun debug action to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledAddNoteAction,
    true,
    'Expected Add note quick action to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledListNotesAction,
    true,
    'Expected List notes quick action to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledRateHelpfulnessAction,
    true,
    'Expected Rate helpfulness quick action to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledFixSummaryAction,
    true,
    'Expected Fix summary quick action to be disabled in demo mode.',
  );
  assert.equal(
    resumeFlow?.hasDisabledToggleAutoSummariesAction,
    true,
    'Expected auto-summary toggle controls to be disabled in demo mode.',
  );
}

module.exports = {
  run,
};
