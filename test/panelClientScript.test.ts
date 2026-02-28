import { renderPanelClientScript } from '../src/webview/panelClientScript';

describe('renderPanelClientScript', () => {
  it('includes expected host action allowlist and intent max-length binding', () => {
    const script = renderPanelClientScript(280, 'scope-token');

    expect(script).toContain("'restoreWorkingSet'");
    expect(script).toContain("'setIntentOverride'");
    expect(script).toContain("'clearIntentOverride'");
    expect(script).toContain("'trustCenter'");
    expect(script).toContain("type: 'setPanelSectionExpanded'");
    expect(script).toContain('const panelSectionScope = "scope-token";');
    expect(script).toContain('const maxIntentOverrideChars = 280;');
    expect(script).toContain("type: 'blockedLink'");
    expect(script).toContain('toggle.dataset.hiddenCount');
    expect(script).toContain("toggle.textContent = expanded ? 'Show less' : collapsedLabel;");
    expect(script).toContain("toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');");
  });
});
