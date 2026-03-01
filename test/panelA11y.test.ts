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

describe('panel webview accessibility', () => {
  it('has no serious or critical axe violations for primary panel surfaces', async () => {
    const html = renderPanelHtml();
    const results = await runAxe(html);
    const severe = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(severe).toEqual([]);
  });
});
