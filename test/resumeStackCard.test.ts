import { renderResumeStackCard } from '../src/resumeStackCard';

describe('renderResumeStackCard', () => {
  it('renders fallback next-step copy and core companion sections', () => {
    const html = renderResumeStackCard({
      intent: 'Implement gating tests',
      intentOverridden: false,
      mode: 'coding',
      nowCheckpointLineTrustedHtml: '',
      lastActionLabel: 'Edited src/extension.ts:42',
      lastActionContext: 'retrieval cue: last edit',
      lastActionActionTrustedHtml:
        '<button type="button" class="secondary" data-action="openEvidence" data-evidence-id="file:src/extension.ts">Open last action</button>',
      nextSafeActionSummary: 'Open src/extension.ts and run verify',
      hasPrimaryNextAction: true,
      primaryNextActionTrustedHtml:
        '<button type="button" data-primary-next-safe-action="home" data-action="runNextStepAction" data-step-index="0">Open file</button>',
      whySurfacedActionTrustedHtml:
        '<button type="button" class="secondary" data-action="openWhySurfaced">Why am I seeing this?</button>',
      nextStepRationaleTrustedHtml:
        '<details><summary><strong>Why this next step?</strong></summary><p class="muted" data-next-step-rationale="true">Based on file evidence: src/extension.ts.</p></details>',
      nextStepsListTrustedHtml: '',
      hasBlocker: false,
      blockerTitle: 'No active blocker',
      blockerDetail: 'Continue with the first suggested next step.',
      blockerMetaTrustedHtml: '',
      blockerDisabledReasonTrustedHtml: '',
      blockerActionTrustedHtml: '',
      restoreSectionsTrustedHtml:
        '<section class="action-group compact-action-group"><h5>Open</h5></section>',
      restoreUnavailableHintsTrustedHtml: '',
    });

    expect(html).toMatchInlineSnapshot(`
     "<div class="card">
           <h3>Companion Home</h3>
           <div class="companion-grid">
             <section class="companion-block" data-companion-section="now" data-companion-slot-source="summary:intent-and-retrieval-cues">
               <h4>Now</h4>
               <p class="companion-kicker">Current focus</p>
               <p class="companion-primary">Implement gating tests</p>
               <p class="companion-meta">Intent source: inferred</p>
               <p class="companion-meta">Mode: coding</p>
               
               <p class="companion-kicker">Last action</p>
               <p class="companion-primary" data-last-action-cue="true">Edited src/extension.ts:42</p>
               <p class="companion-meta">retrieval cue: last edit</p>
               <div class="status-actions"><button type="button" class="secondary" data-action="openEvidence" data-evidence-id="file:src/extension.ts">Open last action</button></div>
             </section>
             <section class="companion-block" data-companion-section="next" data-companion-slot-source="summary:none">
               <h4>Next</h4>
               <p class="companion-kicker">Next safe action</p>
               <p class="companion-primary">Open src/extension.ts and run verify</p>
               <p class="state-caption state-safe" data-next-safe-status="safe" data-next-emphasis-token="advisory"><span class="slot-token slot-token-advisory" data-emphasis-token="advisory">ADVISORY</span> Status: Safe action available</p>
               <details><summary><strong>Why this next step?</strong></summary><p class="muted" data-next-step-rationale="true">Based on file evidence: src/extension.ts.</p></details>
               <ul class="compact-list"><li>No next steps captured yet.</li></ul>
               <div class="status-actions">
                 <button type="button" data-primary-next-safe-action="home" data-action="runNextStepAction" data-step-index="0">Open file</button>
                 <button type="button" class="secondary" data-action="openWhySurfaced">Why am I seeing this?</button>
                 <button type="button" class="secondary" data-action="copyNextSteps">Copy next steps</button>
                 <button type="button" class="secondary" data-action="copyPromptAndOpenCodex">Copy prompt + open Codex</button>
               </div>
             </section>
             <section class="companion-block" data-companion-section="blocked" data-companion-slot-source="blocker:none" data-blocked-card="none">
               <h4>Blocked</h4>
               <p class="state-caption state-clear" data-blocked-status="clear" data-blocked-emphasis-token="advisory"><span class="slot-token slot-token-advisory" data-emphasis-token="advisory">ADVISORY</span> Status: No blocker</p>
               <p class="companion-primary">No active blocker</p>
               <p class="muted">Continue with the first suggested next step.</p>
               
               
               
             </section>
             <section class="companion-block" data-companion-section="restore" data-companion-slot-source="restore:availability-and-trust">
               <h4>Restore</h4>
               <section class="action-group compact-action-group"><h5>Open</h5></section>
               
             </section>
           </div>
         </div>"
    `);
  });

  it('escapes dynamic text and preserves injected section HTML', () => {
    const html = renderResumeStackCard({
      intent: 'Ship <v0.6> safely',
      intentOverridden: true,
      intentEditorTrustedHtml: '<div class="intent-editor">editor</div>',
      mode: 'review & tune',
      nowCheckpointLineTrustedHtml:
        '<p class="companion-meta"><strong>Checkpoint:</strong> Verify blocker copy.</p>',
      lastActionLabel: 'No last action captured yet.',
      lastActionContext: 'retrieval cue unavailable',
      lastActionActionTrustedHtml: '',
      nextSafeActionSummary: 'Open diagnostics and fix top error',
      hasPrimaryNextAction: true,
      primaryNextActionTrustedHtml:
        '<button type="button" data-primary-next-safe-action="home" data-action="runNextStepAction" data-step-index="0">Open Problems</button>',
      whySurfacedActionTrustedHtml:
        '<button type="button" class="secondary" data-action="openWhySurfaced">Why am I seeing this?</button>',
      nextStepRationaleTrustedHtml: '',
      nextStepsListTrustedHtml: '<li>Run focused verify pass</li>',
      hasBlocker: true,
      blockerTitle: 'Diagnostics <error>',
      blockerDetail: 'Fix warning "line 10".',
      blockerMetaTrustedHtml:
        '<div class="step-evidence"><span class="badge">Evidence: workspace diagnostics</span><span class="badge">Confidence: high</span></div>',
      blockerDisabledReasonTrustedHtml: '',
      blockerActionTrustedHtml:
        '<button type="button" class="secondary" data-blocker-primary-action="true" data-action="restoreOpenProblems">Open Problems</button>',
      restoreSectionsTrustedHtml:
        '<section class="action-group compact-action-group"><h5>Run</h5><div class="companion-restore-grid"><button type="button">Rerun task</button></div></section>',
      restoreUnavailableHintsTrustedHtml: '',
    });

    expect(html).toContain('Ship &lt;v0.6&gt; safely');
    expect(html).toContain('Intent source: user-edited');
    expect(html).toContain('<div class="intent-editor">editor</div>');
    expect(html).toContain('Mode: review &amp; tune');
    expect(html).toContain('No last action captured yet.');
    expect(html).toContain('Open diagnostics and fix top error');
    expect(html).toContain('Diagnostics &lt;error&gt;');
    expect(html).toContain('data-blocked-card="active"');
    expect(html).toContain('Evidence: workspace diagnostics');
    expect(html).toContain('data-action="restoreOpenProblems"');
    expect(html).toContain('data-blocker-primary-action="true"');
    expect(html).toContain('data-primary-next-safe-action="home"');
    expect(html).toContain('data-action="openWhySurfaced"');
    expect(html).toContain('<li>Run focused verify pass</li>');
  });
});
