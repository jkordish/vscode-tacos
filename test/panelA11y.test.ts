/**
 * @jest-environment jsdom
 */

import axe from 'axe-core';
import { renderCompanionNextSteps, renderWebviewDocument } from '../src/webview/panelFragments';
import { renderQuickActionsCard, renderStatusCard } from '../src/webview/panelCards';
import { PANEL_WEBVIEW_STYLE } from '../src/webview/panelStyles';
import { renderResumeStackCard } from '../src/resumeStackCard';

async function runAxe(html: string): Promise<axe.AxeResults> {
  document.open();
  document.write(html);
  document.close();
  return axe.run(document, {
    rules: {
      // Contrast is theme-dependent in VS Code webviews; validate this manually in theme QA.
      'color-contrast': { enabled: false },
    },
  });
}

function renderPanelHtml(): string {
  const nextStepsHtml = renderCompanionNextSteps({
    nextSteps: ['Open src/extension.ts and resume TODO review.'],
    nextStepActions: [],
    primaryNextActionStepIndex: -1,
    lowConfidence: true,
    evidenceById: new Map(),
  });

  const resumeCard = renderResumeStackCard({
    intent: 'Stabilize details panel accessibility behavior',
    intentOverridden: false,
    mode: 'coding',
    lastActionLabel: 'Edited src/webview/panelFragments.ts',
    nextSafeActionSummary: 'Refresh summary and validate keyboard-only flow',
    hasPrimaryNextAction: false,
    nextStepsListTrustedHtml: nextStepsHtml,
    hasBlocker: false,
    blockerTitle: 'No active blocker',
    blockerDetail: 'Proceed with the recommended verification steps.',
    restoreSectionsTrustedHtml:
      '<section class="action-group compact-action-group"><h5>Open</h5><div class="companion-restore-grid"><button type="button">Restore working set</button></div></section>',
  });

  const statusCard = renderStatusCard({
    sourceLabel: 'Local summary (instant)',
    generatedAtLabel: '10:12',
    statusHint: 'Running local-only summary.',
    autoSummaryStatusLabel: 'Auto summaries active',
    autoSummaryStatusDetail: 'Runs on focus after idle and cooldown checks.',
    autoSummaryToggleDisabledAttr: '',
    autoSummaryToggleLabel: 'Pause auto summaries',
  });

  const quickActionsCard = renderQuickActionsCard(
    '<section class="action-group"><h4>Copy</h4><div class="quick-actions"><button type="button">Copy summary</button></div></section>',
  );

  return renderWebviewDocument({
    cspMetaTag:
      "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'nonce-123'; script-src 'nonce-123'\" />",
    nonce: 'nonce-123',
    panelStyle: PANEL_WEBVIEW_STYLE,
    bodyCardsTrustedHtml: [resumeCard, statusCard, quickActionsCard].join('\n'),
    clientScript: '',
  });
}

function renderTabPanelHtml(): string {
  return renderWebviewDocument({
    cspMetaTag:
      "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'nonce-123'; script-src 'nonce-123'\" />",
    nonce: 'nonce-123',
    panelStyle: PANEL_WEBVIEW_STYLE,
    tabs: [
      {
        id: 'resume',
        label: 'Resume',
        contentTrustedHtml: '<p>Resume content</p><button type="button">Action</button>',
        default: true,
      },
      {
        id: 'evidence',
        label: 'Evidence',
        contentTrustedHtml: '<p>Evidence content</p>',
      },
      {
        id: 'debrief',
        label: 'Debrief',
        contentTrustedHtml: '<p>Debrief content</p>',
      },
    ],
    clientScript: '',
  });
}

describe('panel webview accessibility', () => {
  it('has no serious or critical axe violations for primary panel surfaces', async () => {
    const html = renderPanelHtml();
    const results = await runAxe(html);
    const severe = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(severe).toEqual([]);
  });

  it('has no serious or critical axe violations for tabbed panel layout', async () => {
    const html = renderTabPanelHtml();
    const results = await runAxe(html);
    const severe = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(severe).toEqual([]);
  });
});

describe('tab strip ARIA attributes', () => {
  function loadTabPanel(): void {
    const html = renderTabPanelHtml();
    document.open();
    document.write(html);
    document.close();
  }

  it('renders a tablist with role="tablist"', () => {
    loadTabPanel();
    const tablist = document.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
  });

  it('gives each tab button role="tab"', () => {
    loadTabPanel();
    const tabs = document.querySelectorAll('.page-tab[data-tab-id]');
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    for (const tab of tabs) {
      expect(tab.getAttribute('role')).toBe('tab');
    }
  });

  it('sets aria-selected="true" on the default (first) tab and "false" on others', () => {
    loadTabPanel();
    const tabs = Array.from(document.querySelectorAll('.page-tab[data-tab-id]'));
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    for (const tab of tabs.slice(1)) {
      expect(tab.getAttribute('aria-selected')).toBe('false');
    }
  });

  it('applies roving tabindex: active tab tabindex="0", inactive tabs tabindex="-1"', () => {
    loadTabPanel();
    const tabs = Array.from(document.querySelectorAll('.page-tab[data-tab-id]'));
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    for (const tab of tabs.slice(1)) {
      expect(tab.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('each tab button has aria-controls pointing to its panel id', () => {
    loadTabPanel();
    const tabs = document.querySelectorAll('.page-tab[data-tab-id]');
    for (const tab of tabs) {
      const tabId = (tab as HTMLElement).dataset.tabId;
      const expectedPanelId = `tab-panel-${tabId}`;
      expect(tab.getAttribute('aria-controls')).toBe(expectedPanelId);
      // The referenced panel must exist in the document
      expect(document.getElementById(expectedPanelId)).not.toBeNull();
    }
  });

  it('each tab button id matches the aria-labelledby of its panel', () => {
    loadTabPanel();
    const tabs = document.querySelectorAll('.page-tab[data-tab-id]');
    for (const tab of tabs) {
      const tabId = (tab as HTMLElement).dataset.tabId;
      const panel = document.getElementById(`tab-panel-${tabId}`);
      expect(panel).not.toBeNull();
      expect(panel!.getAttribute('aria-labelledby')).toBe(`tab-btn-${tabId}`);
      expect(tab.id).toBe(`tab-btn-${tabId}`);
    }
  });
});

describe('tab panel ARIA attributes', () => {
  function loadTabPanel(): void {
    const html = renderTabPanelHtml();
    document.open();
    document.write(html);
    document.close();
  }

  it('gives each tab panel role="tabpanel"', () => {
    loadTabPanel();
    const panels = document.querySelectorAll('.tab-panel');
    expect(panels.length).toBeGreaterThanOrEqual(3);
    for (const panel of panels) {
      expect(panel.getAttribute('role')).toBe('tabpanel');
    }
  });

  it('default panel is visible (no hidden attribute) and others are hidden', () => {
    loadTabPanel();
    const panels = Array.from(document.querySelectorAll('.tab-panel'));
    // The first tab (resume) is default
    expect(panels[0].hasAttribute('hidden')).toBe(false);
    for (const panel of panels.slice(1)) {
      expect(panel.hasAttribute('hidden')).toBe(true);
    }
  });

  it('all tab panel ids follow the tab-panel-<tabId> convention', () => {
    loadTabPanel();
    const tabs = document.querySelectorAll('.page-tab[data-tab-id]');
    for (const tab of tabs) {
      const tabId = (tab as HTMLElement).dataset.tabId;
      const panel = document.getElementById(`tab-panel-${tabId}`);
      expect(panel).not.toBeNull();
    }
  });
});

describe('live regions', () => {
  function loadDoc(html: string): void {
    document.open();
    document.write(html);
    document.close();
  }

  it('renders a polite live region for panel status announcements', () => {
    loadDoc(renderPanelHtml());
    const region = document.getElementById('panel-status-live');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('polite');
    expect(region!.getAttribute('aria-atomic')).toBe('true');
  });

  it('renders an assertive live region for toast announcements', () => {
    loadDoc(renderPanelHtml());
    const region = document.getElementById('toast-region');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('assertive');
    expect(region!.getAttribute('aria-atomic')).toBe('true');
  });

  it('toast-region has role="alert"', () => {
    loadDoc(renderPanelHtml());
    const region = document.getElementById('toast-region');
    expect(region!.getAttribute('role')).toBe('alert');
  });

  it('polite live region is also present in the tabbed panel layout', () => {
    loadDoc(renderTabPanelHtml());
    const region = document.getElementById('panel-status-live');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('polite');
  });

  it('assertive toast region is also present in the tabbed panel layout', () => {
    loadDoc(renderTabPanelHtml());
    const region = document.getElementById('toast-region');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('assertive');
  });
});
