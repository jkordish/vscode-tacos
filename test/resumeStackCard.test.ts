import { renderResumeStackCard } from '../src/resumeStackCard';

describe('renderResumeStackCard', () => {
  it('renders fallback next-step copy and core companion sections', () => {
    const html = renderResumeStackCard({
      intent: 'Implement gating tests',
      mode: 'coding',
      nowCheckpointLineHtml: '',
      nextStepsListHtml: '',
      blockerTitle: 'No active blocker',
      blockerDetail: 'Continue with the first suggested next step.',
      blockerActionHtml: '',
      restoreSectionsHtml:
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
               
             </section>
             <section class="companion-block">
               <h4>Next</h4>
               <ul class="compact-list"><li>No next steps captured yet.</li></ul>
               <div class="status-actions">
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
      nowCheckpointLineHtml:
        '<p class="companion-meta"><strong>Checkpoint:</strong> Verify blocker copy.</p>',
      nextStepsListHtml: '<li>Run focused verify pass</li>',
      blockerTitle: 'Diagnostics <error>',
      blockerDetail: 'Fix warning "line 10".',
      blockerActionHtml:
        '<button type="button" class="secondary" data-action="restoreOpenProblems">Open Problems</button>',
      restoreSectionsHtml:
        '<section class="action-group compact-action-group"><h5>Run</h5><div class="companion-restore-grid"><button type="button">Rerun task</button></div></section>',
    });

    expect(html).toContain('Ship &lt;v0.6&gt; safely');
    expect(html).toContain('Mode: review &amp; tune');
    expect(html).toContain('Diagnostics &lt;error&gt;');
    expect(html).toContain('data-action="restoreOpenProblems"');
    expect(html).toContain('<li>Run focused verify pass</li>');
  });
});
