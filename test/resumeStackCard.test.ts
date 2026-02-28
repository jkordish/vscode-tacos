import { renderResumeStackCard } from '../src/resumeStackCard';

describe('renderResumeStackCard', () => {
  it('renders fallback next-step copy and core companion sections', () => {
    const html = renderResumeStackCard({
      intent: 'Implement gating tests',
      mode: 'coding',
      nowCheckpointLineTrustedHtml: '',
      lastActionLabel: 'Edited src/extension.ts:42',
      lastActionContext: 'retrieval cue: last edit',
      lastActionActionTrustedHtml:
        '<button type="button" class="secondary" data-action="openEvidence" data-evidence-id="file:src/extension.ts">Open last action</button>',
      nextSafeActionSummary: 'Open src/extension.ts and run verify',
      primaryNextActionTrustedHtml:
        '<button type="button" data-primary-next-safe-action="home" data-action="runNextStepAction" data-step-index="0">Open file</button>',
      nextStepRationaleTrustedHtml:
        '<details><summary><strong>Why this next step?</strong></summary><p class="muted" data-next-step-rationale="true">Based on file evidence: src/extension.ts.</p></details>',
      nextStepsListTrustedHtml: '',
      blockerTitle: 'No active blocker',
      blockerDetail: 'Continue with the first suggested next step.',
      blockerActionTrustedHtml: '',
      restoreSectionsTrustedHtml:
        '<section class="action-group compact-action-group"><h5>Open</h5></section>',
    });

    expect(html).toMatchInlineSnapshot(`
     "<div class="card">
           <h3>Companion Home</h3>
           <div class="companion-grid">
             <section class="companion-block">
               <h4>Now</h4>
               <p class="companion-kicker">Current focus</p>
               <p class="companion-primary">Implement gating tests</p>
               <p class="companion-meta">Mode: coding</p>
               
               <p class="companion-kicker">Last action</p>
               <p class="companion-primary" data-last-action-cue="true">Edited src/extension.ts:42</p>
               <p class="companion-meta">retrieval cue: last edit</p>
               <div class="status-actions"><button type="button" class="secondary" data-action="openEvidence" data-evidence-id="file:src/extension.ts">Open last action</button></div>
             </section>
             <section class="companion-block">
               <h4>Next</h4>
               <p class="companion-kicker">Next safe action</p>
               <p class="companion-primary">Open src/extension.ts and run verify</p>
               <details><summary><strong>Why this next step?</strong></summary><p class="muted" data-next-step-rationale="true">Based on file evidence: src/extension.ts.</p></details>
               <ul class="compact-list"><li>No next steps captured yet.</li></ul>
               <div class="status-actions">
                 <button type="button" data-primary-next-safe-action="home" data-action="runNextStepAction" data-step-index="0">Open file</button>
                 <button type="button" class="secondary" data-action="copyNextSteps">Copy next steps</button>
                 <button type="button" class="secondary" data-action="copyPromptAndOpenCodex">Copy prompt + open Codex</button>
               </div>
             </section>
             <section class="companion-block">
               <h4>Blocked</h4>
               <p class="companion-primary">No active blocker</p>
               <p class="muted">Continue with the first suggested next step.</p>
               
             </section>
             <section class="companion-block">
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
      mode: 'review & tune',
      nowCheckpointLineTrustedHtml:
        '<p class="companion-meta"><strong>Checkpoint:</strong> Verify blocker copy.</p>',
      lastActionLabel: 'No last action captured yet.',
      lastActionContext: 'retrieval cue unavailable',
      lastActionActionTrustedHtml: '',
      nextSafeActionSummary: 'Open diagnostics and fix top error',
      primaryNextActionTrustedHtml:
        '<button type="button" data-primary-next-safe-action="home" data-action="runNextStepAction" data-step-index="0">Open Problems</button>',
      nextStepRationaleTrustedHtml: '',
      nextStepsListTrustedHtml: '<li>Run focused verify pass</li>',
      blockerTitle: 'Diagnostics <error>',
      blockerDetail: 'Fix warning "line 10".',
      blockerActionTrustedHtml:
        '<button type="button" class="secondary" data-action="restoreOpenProblems">Open Problems</button>',
      restoreSectionsTrustedHtml:
        '<section class="action-group compact-action-group"><h5>Run</h5><div class="companion-restore-grid"><button type="button">Rerun task</button></div></section>',
    });

    expect(html).toContain('Ship &lt;v0.6&gt; safely');
    expect(html).toContain('Mode: review &amp; tune');
    expect(html).toContain('No last action captured yet.');
    expect(html).toContain('Open diagnostics and fix top error');
    expect(html).toContain('Diagnostics &lt;error&gt;');
    expect(html).toContain('data-action="restoreOpenProblems"');
    expect(html).toContain('data-primary-next-safe-action="home"');
    expect(html).toContain('<li>Run focused verify pass</li>');
  });
});
