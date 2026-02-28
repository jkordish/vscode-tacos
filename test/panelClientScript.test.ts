import { renderPanelClientScript } from '../src/webview/panelClientScript';

describe('renderPanelClientScript', () => {
  it('includes expected host action allowlist and intent max-length binding', () => {
    const script = renderPanelClientScript(280);

    expect(script).toContain("'restoreWorkingSet'");
    expect(script).toContain("'setIntentOverride'");
    expect(script).toContain("'clearIntentOverride'");
    expect(script).toContain('const maxIntentOverrideChars = 280;');
    expect(script).toContain("type: 'blockedLink'");
  });
});
