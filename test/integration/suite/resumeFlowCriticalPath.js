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
  await wait(150);

  const runtime = await vscode.commands.executeCommand('tacos.__test.getRuntimeStateSnapshot');
  assert.equal(runtime?.panelOpen, true, 'Expected details panel to open after tacos.showNow.');
  assert.equal(
    runtime?.hasScratchSummary,
    true,
    'Expected scratch summary to be populated in critical resume flow.',
  );

  const resumeFlow = await vscode.commands.executeCommand('tacos.__test.getResumeFlowSnapshot');
  assert.ok(resumeFlow, 'Expected resume flow snapshot payload.');
  assert.equal(
    resumeFlow?.hasPanelSummary,
    true,
    'Expected panel summary to be available for critical resume flow.',
  );
  assert.equal(
    resumeFlow?.hasCompanionHomeCard,
    true,
    'Expected Companion Home card marker in panel render output.',
  );
  assert.equal(
    resumeFlow?.hasIntentEditor,
    true,
    'Expected inline intent editor controls in Companion Home.',
  );
  assert.equal(
    resumeFlow?.hasIntentSourceLabel,
    true,
    'Expected intent source label in Companion Home.',
  );
  assert.equal(
    resumeFlow?.hasLastActionCue,
    true,
    'Expected Last action retrieval cue marker in Companion Home.',
  );
  if (resumeFlow?.hasActiveBlockedCard) {
    assert.equal(
      resumeFlow?.primaryBlockerActionCount,
      1,
      'Expected exactly one primary unblock action marker when a blocker is active.',
    );
  }
  assert.equal(
    resumeFlow?.hasRestoreWorkingSetAction,
    true,
    'Expected Restore working set action marker in panel render output.',
  );
  assert.equal(
    resumeFlow?.hasTrustCenterCard,
    true,
    'Expected Trust Center card marker in panel render output.',
  );
  assert.equal(
    resumeFlow?.hasResumePathCard,
    true,
    'Expected Resume Path checklist card marker in panel render output.',
  );
  assert.equal(
    resumeFlow?.resumePathStepCount,
    3,
    'Expected Resume Path checklist to render exactly three toggle steps.',
  );

  if ((resumeFlow?.nextStepsCount ?? 0) > 0) {
    assert.equal(
      Boolean(resumeFlow?.hasPrimaryNextAction || resumeFlow?.hasRecommendedFirstAction),
      true,
      'Expected either a primary safe action or recommended first action cue when next steps exist.',
    );

    if (resumeFlow?.hasPrimaryNextAction) {
      assert.ok(
        typeof resumeFlow?.primaryNextActionLabel === 'string' &&
          resumeFlow.primaryNextActionLabel.length > 0,
        'Expected primary next action label to be non-empty.',
      );
      assert.equal(
        resumeFlow?.hasHomePrimaryNextAction,
        true,
        'Expected primary next action CTA marker in Companion Home.',
      );
      assert.equal(
        resumeFlow?.hasRecapPrimaryNextAction,
        true,
        'Expected Session Recap to mirror the primary next action target.',
      );
      assert.equal(
        resumeFlow?.hasPrimaryNextActionRationale,
        true,
        'Expected primary next action rationale marker in Companion Home.',
      );
    }
  }
}

module.exports = {
  run,
};
