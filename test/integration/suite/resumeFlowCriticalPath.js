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
    resumeFlow?.isCompanionHomeFirstCard,
    true,
    'Expected Companion Home to be the first panel card for 5-second scanning.',
  );
  assert.deepEqual(
    resumeFlow?.companionSectionOrder,
    ['now', 'next', 'blocked', 'restore'],
    'Expected Companion Home section order to stay fixed as Now/Next/Blocked/Restore.',
  );
  assert.equal(
    resumeFlow?.companionSlotSourceCount,
    4,
    'Expected each Companion Home section to expose one slot source marker.',
  );
  assert.equal(
    typeof resumeFlow?.nextSlotSourceClass === 'string' &&
      resumeFlow.nextSlotSourceClass.length > 0,
    true,
    'Expected Next slot to expose a source-class marker.',
  );
  assert.equal(
    resumeFlow?.blockedSlotSourceClass?.startsWith('blocker:'),
    true,
    'Expected Blocked slot source-class marker to be blocker-derived.',
  );
  assert.equal(
    resumeFlow?.restoreSlotSourceClass,
    'restore:availability-and-trust',
    'Expected Restore slot to expose a stable restore source marker.',
  );
  assert.equal(
    (resumeFlow?.emphasisTokenCount ?? 0) >= 2,
    true,
    'Expected Companion Home to render explicit emphasis tokens for Next and Blocked slots.',
  );
  assert.equal(
    ['primary', 'advisory', 'suppressed'].includes(resumeFlow?.nextEmphasisToken ?? ''),
    true,
    'Expected Next slot emphasis token to use supported token states.',
  );
  assert.equal(
    ['primary', 'advisory', 'suppressed'].includes(resumeFlow?.blockedEmphasisToken ?? ''),
    true,
    'Expected Blocked slot emphasis token to use supported token states.',
  );
  assert.equal(
    resumeFlow?.hasLegacyNextStepsCard,
    false,
    'Expected legacy Next Steps card to be removed from panel composition.',
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
  assert.equal(
    (resumeFlow?.totalPrimaryCtaCount ?? 0) <= 1,
    true,
    'Expected at most one primary CTA marker across Next and Blocked sections.',
  );
  if (resumeFlow?.hasPrimaryBlockerAction) {
    assert.equal(
      resumeFlow?.primaryBlockerActionCount,
      1,
      'Expected blocker-primary mode to expose exactly one primary blocker action marker.',
    );
    assert.equal(
      resumeFlow?.primaryNextActionCtaCount,
      0,
      'Expected blocker-primary mode to suppress primary next-action marker.',
    );
  }
  assert.equal(
    resumeFlow?.hasRestoreWorkingSetAction,
    true,
    'Expected Restore working set action marker in panel render output.',
  );
  assert.equal(
    resumeFlow?.hasAnchorOpenLinkAction,
    false,
    'Expected link actions to avoid anchor-only controls for keyboard flow consistency.',
  );
  assert.equal(
    resumeFlow?.hasAnchorOpenTopFileAction,
    false,
    'Expected top file actions to avoid anchor-only controls for keyboard flow consistency.',
  );
  assert.equal(
    resumeFlow?.hasAnchorOpenEvidenceAction,
    false,
    'Expected evidence actions to avoid anchor-only controls for keyboard flow consistency.',
  );
  if ((resumeFlow?.linkCount ?? 0) > 0) {
    assert.equal(
      resumeFlow?.hasButtonOpenLinkAction,
      true,
      'Expected link actions to be rendered as semantic buttons.',
    );
  } else {
    assert.equal(
      resumeFlow?.hasButtonOpenLinkAction,
      false,
      'Expected no link button markers when no links are present.',
    );
  }
  if ((resumeFlow?.topFilesCount ?? 0) > 0) {
    assert.equal(
      resumeFlow?.hasButtonOpenTopFileAction,
      true,
      'Expected top file actions to be rendered as semantic buttons.',
    );
  } else {
    assert.equal(
      resumeFlow?.hasButtonOpenTopFileAction,
      false,
      'Expected no top file button markers when no top files are present.',
    );
  }
  if ((resumeFlow?.clickableEvidenceCount ?? 0) > 0) {
    assert.equal(
      resumeFlow?.hasButtonOpenEvidenceAction,
      true,
      'Expected evidence actions to be rendered as semantic buttons.',
    );
    assert.ok(
      (resumeFlow?.evidenceOpenAffordanceCount ?? 0) > 0,
      'Expected at least one explicit Open affordance in evidence rows.',
    );
    if (resumeFlow?.hasTimelineSection) {
      assert.ok(
        (resumeFlow?.timelineOpenAffordanceCount ?? 0) > 0,
        'Expected timeline rows with clickable evidence to include Open affordance chips.',
      );
    }
  } else {
    assert.equal(
      resumeFlow?.hasButtonOpenEvidenceAction,
      false,
      'Expected no evidence button markers when no clickable evidence is present.',
    );
    assert.equal(
      resumeFlow?.evidenceOpenAffordanceCount,
      0,
      'Expected no Open affordance chips when clickable evidence is absent.',
    );
  }
  if ((resumeFlow?.nonClickableEvidenceCount ?? 0) > 0) {
    assert.ok(
      (resumeFlow?.evidenceStaticAffordanceCount ?? 0) > 0,
      'Expected non-clickable evidence rows to include Not clickable affordance chips.',
    );
    if (resumeFlow?.hasTimelineSection) {
      assert.ok(
        (resumeFlow?.timelineStaticAffordanceCount ?? 0) > 0,
        'Expected non-clickable timeline rows to include Not clickable affordance chips.',
      );
    }
  } else {
    assert.equal(
      resumeFlow?.evidenceStaticAffordanceCount,
      0,
      'Expected no static affordance chips when all evidence is clickable.',
    );
  }
  if ((resumeFlow?.hiddenEvidenceCount ?? 0) > 0) {
    assert.equal(
      resumeFlow?.evidenceShowMoreLabel,
      `Show ${resumeFlow.hiddenEvidenceCount} more`,
      'Expected evidence Show more label to include the hidden item count.',
    );
  }
  assert.equal(
    resumeFlow?.restoreWorkingSetActionCount,
    1,
    'Expected Restore working set to be presented as a single canonical action.',
  );
  assert.equal(
    resumeFlow?.hasTrustCenterCard,
    true,
    'Expected Trust Center card marker in panel render output.',
  );
  assert.equal(
    resumeFlow?.hasTrustCenterSection,
    true,
    'Expected Trust Center to render as a collapsible panel section.',
  );
  assert.equal(
    resumeFlow?.trustCenterExpanded,
    false,
    'Expected Trust Center to default collapsed for progressive disclosure.',
  );
  if (resumeFlow?.hasTimelineSection) {
    assert.equal(
      resumeFlow?.timelineExpanded,
      false,
      'Expected Timeline to default collapsed for progressive disclosure.',
    );
  }
  if (resumeFlow?.hasEvidenceSection) {
    assert.equal(
      resumeFlow?.evidenceExpanded,
      false,
      'Expected Evidence to default collapsed for progressive disclosure.',
    );
  }
  if (resumeFlow?.hasDetailsSection) {
    assert.equal(
      resumeFlow?.detailsExpanded,
      false,
      'Expected Details to default collapsed for progressive disclosure.',
    );
  }
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
        resumeFlow?.nextSafeStatus,
        'safe',
        'Expected Next status marker to be safe when a primary action exists.',
      );
      assert.equal(
        resumeFlow?.hasHomePrimaryNextAction,
        true,
        'Expected primary next action CTA marker in Companion Home.',
      );
      assert.equal(
        resumeFlow?.primaryNextActionCtaCount,
        1,
        'Expected exactly one canonical primary next action CTA in the panel.',
      );
      assert.equal(
        resumeFlow?.primaryBlockerActionCount,
        0,
        'Expected next-primary mode to suppress primary blocker action markers.',
      );
      assert.equal(
        resumeFlow?.hasPrimaryNextActionRationale,
        true,
        'Expected primary next action rationale marker in Companion Home.',
      );
    } else {
      assert.equal(
        resumeFlow?.nextSafeStatus,
        'advisory',
        'Expected Next status marker to be advisory when no primary action exists.',
      );
      if (!resumeFlow?.hasNextActionCandidate) {
        assert.ok(
          (resumeFlow?.advisoryOnlyRowCount ?? 0) > 0,
          'Expected advisory-only copy when no safe one-click action is available.',
        );
      }
    }
  }
}

module.exports = {
  run,
};
