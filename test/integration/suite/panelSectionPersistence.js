const assert = require('node:assert/strict');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  assert.ok(extension, 'Expected extension jkordish.vscode-tacos to be installed in test host.');
  await extension.activate();
  const config = vscode.workspace.getConfiguration('tacos');
  const showTimelineInspected = config.inspect('showTimeline');
  const originalShowTimelineGlobal = showTimelineInspected?.globalValue;

  try {
    await vscode.commands.executeCommand('tacos.showNow');
    await wait(150);

    const baseline = await vscode.commands.executeCommand('tacos.__test.getResumeFlowSnapshot');
    assert.ok(baseline, 'Expected resume flow snapshot payload.');
    assert.ok(
      Array.isArray(baseline?.panelSectionOrder),
      'Expected panel section order list in resume flow snapshot.',
    );
    const sectionOrder = baseline?.panelSectionOrder ?? [];
    const invalidSectionIds = sectionOrder.filter(
      (sectionId) =>
        !['moreContext', 'trustCenter', 'timeline', 'evidence', 'details'].includes(sectionId),
    );
    assert.deepEqual(
      invalidSectionIds,
      [],
      'Expected panel section order to only include rendered disclosure section ids.',
    );
    const moreContextIndex = sectionOrder.indexOf('moreContext');
    const trustCenterIndex = sectionOrder.indexOf('trustCenter');
    const evidenceIndex = sectionOrder.indexOf('evidence');
    const detailsIndex = sectionOrder.indexOf('details');
    assert.ok(
      moreContextIndex >= 0 && trustCenterIndex > moreContextIndex,
      'Expected More Context section wrapper to stay ahead of nested policy sections.',
    );
    assert.ok(
      evidenceIndex > trustCenterIndex,
      'Expected Evidence section to stay after Trust Center in stable order.',
    );
    assert.ok(
      detailsIndex > evidenceIndex,
      'Expected Details section to stay after Evidence in stable order.',
    );
    assert.ok(
      (baseline?.panelEmphasisBadgeCount ?? 0) > 0,
      'Expected policy-driven section emphasis badges without reordering sections.',
    );
    assert.equal(
      baseline?.hasMoreContextEmphasis,
      true,
      'Expected More Context disclosure to carry policy emphasis metadata.',
    );
    assert.equal(
      baseline?.moreContextExpanded,
      false,
      'Expected More Context to remain collapsed by default even when policy emphasis is present.',
    );

    if (baseline?.hasTimelineSection) {
      assert.equal(
        baseline?.timelineExpanded,
        false,
        'Expected Timeline to start collapsed before persistence checks.',
      );
    }
    if (baseline?.hasDetailsSection) {
      assert.equal(
        baseline?.detailsExpanded,
        false,
        'Expected Details to start collapsed before persistence checks.',
      );
    }

    const setTimeline = await vscode.commands.executeCommand(
      'tacos.__test.setPanelSectionExpanded',
      'timeline',
      true,
    );
    const setDetails = await vscode.commands.executeCommand(
      'tacos.__test.setPanelSectionExpanded',
      'details',
      true,
    );
    assert.equal(setTimeline, true, 'Expected timeline section toggle test command to succeed.');
    assert.equal(setDetails, true, 'Expected details section toggle test command to succeed.');

    const stored = await vscode.commands.executeCommand(
      'tacos.__test.getPanelSectionStateSnapshot',
    );
    assert.ok(stored, 'Expected persisted panel section state snapshot.');
    assert.equal(
      Array.isArray(stored?.expandedSectionIds),
      true,
      'Expected expanded section state list in persisted snapshot.',
    );
    assert.equal(
      stored?.expandedSectionIds.includes('timeline'),
      true,
      'Expected persisted section state to include timeline.',
    );
    assert.equal(
      stored?.expandedSectionIds.includes('details'),
      true,
      'Expected persisted section state to include details.',
    );

    await vscode.commands.executeCommand('tacos.showNow');
    await wait(150);

    const afterRerender = await vscode.commands.executeCommand(
      'tacos.__test.getResumeFlowSnapshot',
    );
    assert.equal(
      afterRerender?.moreContextExpanded,
      false,
      'Expected policy emphasis to avoid auto-expanding More Context after rerender.',
    );
    if (afterRerender?.hasTimelineSection) {
      assert.equal(
        afterRerender?.timelineExpanded,
        true,
        'Expected timeline expansion state to persist across rerender.',
      );
    }
    if (afterRerender?.hasDetailsSection) {
      assert.equal(
        afterRerender?.detailsExpanded,
        true,
        'Expected details expansion state to persist across rerender.',
      );
    }

    await vscode.commands.executeCommand('tacos.__test.disposePanel');
    await wait(100);
    await vscode.commands.executeCommand('tacos.showNow');
    await wait(150);

    const afterReopen = await vscode.commands.executeCommand('tacos.__test.getResumeFlowSnapshot');
    assert.equal(
      afterReopen?.moreContextExpanded,
      false,
      'Expected policy emphasis to avoid auto-expanding More Context after panel reopen.',
    );
    if (afterReopen?.hasTimelineSection) {
      assert.equal(
        afterReopen?.timelineExpanded,
        true,
        'Expected timeline expansion state to persist across panel reopen.',
      );
    }
    if (afterReopen?.hasDetailsSection) {
      assert.equal(
        afterReopen?.detailsExpanded,
        true,
        'Expected details expansion state to persist across panel reopen.',
      );
    }

    await config.update('showTimeline', false, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('tacos.showNow');
    await wait(150);

    const timelineDisabled = await vscode.commands.executeCommand(
      'tacos.__test.getResumeFlowSnapshot',
    );
    assert.equal(
      timelineDisabled?.hasTimelineSection,
      false,
      'Expected Timeline section to be absent when tacos.showTimeline is disabled.',
    );
    assert.equal(
      (timelineDisabled?.panelSectionOrder ?? []).includes('timeline'),
      false,
      'Expected panel section order to exclude timeline when hidden.',
    );
    assert.equal(
      (timelineDisabled?.emphasizedPanelSections ?? []).includes('timeline'),
      false,
      'Expected emphasis metadata to exclude timeline when section is hidden.',
    );
    assert.notEqual(
      timelineDisabled?.moreContextEmphasisSource,
      'policy-focus:timeline',
      'Expected More Context emphasis source to avoid timeline focus when timeline is hidden.',
    );
  } finally {
    await config.update(
      'showTimeline',
      typeof originalShowTimelineGlobal === 'undefined' ? undefined : originalShowTimelineGlobal,
      vscode.ConfigurationTarget.Global,
    );
    await vscode.commands.executeCommand(
      'tacos.__test.setPanelSectionExpanded',
      'trustCenter',
      false,
    );
    await vscode.commands.executeCommand('tacos.__test.setPanelSectionExpanded', 'timeline', false);
    await vscode.commands.executeCommand('tacos.__test.setPanelSectionExpanded', 'evidence', false);
    await vscode.commands.executeCommand('tacos.__test.setPanelSectionExpanded', 'details', false);
    await vscode.commands.executeCommand(
      'tacos.__test.setPanelSectionExpanded',
      'moreContext',
      false,
    );
  }
}

module.exports = {
  run,
};
