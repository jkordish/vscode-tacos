import { renderPanelClientScript } from '../src/webview/panelClientScript';

describe('renderPanelClientScript', () => {
  it('includes expected host action allowlist and intent max-length binding', () => {
    const script = renderPanelClientScript(280, 'scope-token');

    expect(script).toContain("'restoreWorkingSet'");
    expect(script).toContain("'setIntentOverride'");
    expect(script).toContain("'clearIntentOverride'");
    expect(script).toContain("'dismissDemoResume'");
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
    expect(script).toContain(
      'if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey)',
    );
    expect(script).toContain("if (!['r', 'n', 'i'].includes(key))");
    expect(script).toContain("vscode.postMessage({ type: 'refreshSummary' });");
    expect(script).toContain("vscode.postMessage({ type: 'copyNextSteps' });");
  });
});
