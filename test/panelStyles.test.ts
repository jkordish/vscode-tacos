import { PANEL_WEBVIEW_STYLE } from '../src/webview/panelStyles';

describe('panelStyles', () => {
  it('includes emphasis token styling and reduced-motion safeguards', () => {
    expect(PANEL_WEBVIEW_STYLE).toContain('.slot-token');
    expect(PANEL_WEBVIEW_STYLE).toContain('.slot-token-primary');
    expect(PANEL_WEBVIEW_STYLE).toContain('.slot-token-advisory');
    expect(PANEL_WEBVIEW_STYLE).toContain('.slot-token-suppressed');
    expect(PANEL_WEBVIEW_STYLE).toContain('@media (prefers-reduced-motion: reduce)');
    expect(PANEL_WEBVIEW_STYLE).toContain(
      '.card > details[data-panel-section] > summary::before,\n        .slot-token {\n          transition: none;',
    );
  });
});
