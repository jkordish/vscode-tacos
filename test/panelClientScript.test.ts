import { renderPanelClientScript } from '../src/webview/panelClientScript';

describe('renderPanelClientScript', () => {
  it('includes expected host action allowlist and intent max-length binding', () => {
    const script = renderPanelClientScript(280, 'scope-token');

    expect(script).toContain("'restoreWorkingSet'");
    expect(script).toContain("'setIntentOverride'");
    expect(script).toContain("'clearIntentOverride'");
    expect(script).toContain("'dismissDemoResume'");
    expect(script).toContain("'openAiPayloadPreview'");
    expect(script).toContain("'revokeAiPayloadConsent'");
    expect(script).toContain("'trustCenter'");
    expect(script).toContain("'moreContext'");
    expect(script).toContain("type: 'setPanelSectionExpanded'");
    expect(script).toContain('const panelSectionScope = "scope-token";');
    expect(script).toContain('const maxIntentOverrideChars = 280;');
    expect(script).toContain("type: 'blockedLink'");
    expect(script).toContain('toggle.dataset.hiddenCount');
    expect(script).toContain("toggle.textContent = expanded ? 'Show less' : collapsedLabel;");
    expect(script).toContain("toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');");
    expect(script).toContain("document.getElementById('panel-status-live')");
    expect(script).toContain("payload.type !== 'panelStatus'");
    expect(script).toContain(
      "announceStatus(expanded ? 'Evidence list expanded.' : 'Evidence list collapsed.')",
    );
    expect(script).toContain('scrollY: 0');
    expect(script).toContain('focusToken:');
    expect(script).toContain("window.addEventListener(\n        'scroll'");
    expect(script).toContain('restoreViewPosition();');
    expect(script).toContain("if (typeof href === 'string' && href.startsWith('#'))");
    expect(script).toContain('hashTarget.focus();');
    expect(script).toContain("actionElement.dataset.blockerPrimaryAction === 'true'");
    expect(script).toContain("vscode.postMessage({ type: action, primarySurface: 'blocked' });");
    expect(script).toContain("if (action === 'openWhySurfaced')");
    expect(script).toContain("if (action === 'openAiPayloadPreview')");
    expect(script).toContain('actionElement.dataset.aiPayloadEntrypoint');
    expect(script).toContain("entrypoint === 'trust-center'");
    expect(script).toContain("entrypoint === 'why-surfaced'");
    expect(script).toContain("entrypoint === 'companion-home'");
    expect(script).toContain("vscode.postMessage({ type: 'openAiPayloadPreview', entrypoint });");
    expect(script).toContain("if (action === 'openEvidenceTray')");
    expect(script).toContain('details[data-panel-section="moreContext"]');
    expect(script).toContain('details[data-panel-section="trustCenter"]');
    expect(script).toContain('details[data-panel-section="evidence"]');
    expect(script).toContain('details[data-why-surfaced-details="true"]');
    expect(script).toContain("announceStatus('Opened Why am I seeing this? details.')");
    expect(script).toContain("announceStatus('Opened evidence tray.')");
    // Tab switching
    expect(script).toContain('function switchToTab(tabId)');
    expect(script).toContain('function restoreActiveTab()');
    expect(script).toContain("'.page-tab[data-tab-id]'");
    expect(script).toContain("'tab-panel-' + tabId");
    expect(script).toContain('viewState.activeTabId = tabId');
    expect(script).toContain("activeTabId: ''");
    expect(script).toContain("switchToTab('debrief')");
    expect(script).toContain("switchToTab('evidence')");
    expect(script).toContain('restoreActiveTab();');
    expect(script).toContain(
      'if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey)',
    );
    expect(script).toContain("if (!['r', 'n', 'i'].includes(key))");
    expect(script).toContain("vscode.postMessage({ type: 'refreshSummary' });");
    expect(script).toContain("vscode.postMessage({ type: 'copyNextSteps' });");
    // setPanelSectionExpanded click handler
    expect(script).toContain("if (action === 'setPanelSectionExpanded')");
    expect(script).toContain('actionElement.dataset.sectionId');
    expect(script).toContain('panelSectionIds.has(sectionId)');
    expect(script).toContain("actionElement.dataset.sectionExpanded !== 'false'");
    expect(script).toContain('persistPanelSectionExpanded(sectionId, expanded)');
    expect(script).toContain("(expanded ? 'Expanded ' : 'Collapsed ') + sectionId + ' section.'");
    // Cockpit autosave indicator
    expect(script).toContain("document.getElementById('cockpit-save-state')");
    expect(script).toContain("setCockpitSaveState('Saving\u2026')");
    expect(script).toContain("'Saved \u2022 '");
    expect(script).toContain("type: 'updateProspective'");
    expect(script).toContain("'cockpit-verify-first'");
    expect(script).toContain("'cockpit-next-step'");
    // Toast helper
    expect(script).toContain('function showToast(message, opts)');
    expect(script).toContain("document.getElementById('toast-region')");
    expect(script).toContain("'toast-message'");
    expect(script).toContain("'toast-action secondary'");
    // checkpointDismiss undo toast
    expect(script).toContain("if (action === 'checkpointDismiss')");
    expect(script).toContain("type: 'undoDeleteNote'");
    expect(script).toContain('actionElement.dataset.noteId');
    // taskStateResolve toast
    expect(script).toContain("if (action === 'taskStateResolve')");
    expect(script).toContain("'Task state marked resolved.'");
    // Auto-density ResizeObserver
    expect(script).toContain('const COMPACT_DENSITY_BREAKPOINT = 400');
    expect(script).toContain('function updateDensity()');
    expect(script).toContain("document.querySelector('.tacos-root')");
    expect(script).toContain("root.dataset.density = 'compact'");
    expect(script).toContain('delete root.dataset.density');
    expect(script).toContain('new ResizeObserver(updateDensity).observe(root)');
  });
});
