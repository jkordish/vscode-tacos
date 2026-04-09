/**
 * @jest-environment jsdom
 */

import { renderPanelClientScript } from '../src/webview/panelClientScript';

type VsCodeApiMock = {
  getState: () => Record<string, unknown>;
  postMessage: jest.Mock;
  setState: jest.Mock;
};

describe('panelClientScript state behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis as unknown as { acquireVsCodeApi?: unknown }).acquireVsCodeApi;
  });

  function bootstrap(
    initialState: Record<string, unknown> = {},
    sectionScope = 'scope-token',
    bodyHtml?: string,
  ): {
    postMessage: jest.Mock;
    setState: jest.Mock;
  } {
    const setState = jest.fn();
    const postMessage = jest.fn();
    const api: VsCodeApiMock = {
      getState: () => initialState,
      postMessage,
      setState,
    };

    (globalThis as unknown as { acquireVsCodeApi: () => VsCodeApiMock }).acquireVsCodeApi = () =>
      api;

    document.body.innerHTML =
      bodyHtml ??
      `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"><li class="extra-evidence">more evidence</li></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="1">Show 1 more</button>
      <button type="button" data-action="openWhySurfaced">Why am I seeing this?</button>
      <button type="button" data-action="openAiPayloadPreview" data-ai-payload-entrypoint="companion-home">Review AI payload preview</button>
      <button type="button" data-action="openAiPayloadPreview" data-ai-payload-entrypoint="trust-center">Review AI payload preview</button>
      <button type="button" data-action="openAiPayloadPreview">Review AI payload preview</button>
      <button type="button" data-action="openEvidenceTray">Open evidence tray</button>
      <button type="button" data-test-slot="primary" data-action="openEvidence" data-evidence-id="url:https://example.test/search?q=a=b&mode=full">Open evidence</button>
      <button type="button" data-test-slot="duplicate" data-action="openEvidence" data-evidence-id="url:https://example.test/search?q=a=b&mode=full">Open evidence duplicate</button>
      <button type="button" data-test-slot="pipe" data-action="openEvidence" data-evidence-id="file:src/foo|bar.ts">Open pipe evidence</button>
      <details data-panel-section="moreContext">
        <summary>More Context</summary>
        <details data-panel-section="evidence">
          <summary>Evidence</summary>
          <ul><li>Evidence row</li></ul>
        </details>
        <details data-panel-section="trustCenter">
          <summary>Trust Center</summary>
          <details data-why-surfaced-details="true">
            <summary>Why am I seeing this?</summary>
          </details>
        </details>
      </details>
      <details data-panel-section="timeline"></details>
      <input id="intent-override-input" type="text" value="intent" />
    `;

    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
      writable: true,
    });

    const script = renderPanelClientScript(280, sectionScope);
    // Execute generated webview script in the current jsdom context.
    const execute = new Function(script);
    execute();

    return { postMessage, setState };
  }

  it('persists evidence expansion state and announces expansion changes', () => {
    const { setState } = bootstrap();
    const toggle = document.querySelector(
      '[data-action="toggleEvidenceMore"]',
    ) as HTMLButtonElement;
    const list = document.getElementById('evidence-list') as HTMLElement;
    const live = document.getElementById('panel-status-live') as HTMLElement;

    toggle.click();
    expect(list.classList.contains('show-more')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(setState).toHaveBeenCalledWith(expect.objectContaining({ evidenceListExpanded: true }));

    jest.advanceTimersByTime(20);
    expect(live.textContent).toBe('Evidence list expanded.');
  });

  it('posts panel section expansion messages and stores section state', () => {
    const { postMessage, setState } = bootstrap();
    const details = document.querySelector(
      'details[data-panel-section="timeline"]',
    ) as HTMLDetailsElement;

    details.open = true;
    details.dispatchEvent(new Event('toggle', { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: 'setPanelSectionExpanded',
      sectionId: 'timeline',
      expanded: true,
    });
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionExpanded: expect.objectContaining({ timeline: true }),
      }),
    );
  });

  it('opens the Why Surfaced drill-down from Companion Home in one click', () => {
    bootstrap();
    const openWhySurfacedButton = document.querySelector(
      '[data-action="openWhySurfaced"]',
    ) as HTMLButtonElement;
    const moreContext = document.querySelector(
      'details[data-panel-section="moreContext"]',
    ) as HTMLDetailsElement;
    const trustCenter = document.querySelector(
      'details[data-panel-section="trustCenter"]',
    ) as HTMLDetailsElement;
    const whySurfaced = document.querySelector(
      'details[data-why-surfaced-details="true"]',
    ) as HTMLDetailsElement;
    const live = document.getElementById('panel-status-live') as HTMLElement;

    openWhySurfacedButton.click();
    jest.advanceTimersByTime(20);

    expect(moreContext.open).toBe(true);
    expect(trustCenter.open).toBe(true);
    expect(whySurfaced.open).toBe(true);
    expect(live.textContent).toBe('Opened Why am I seeing this? details.');
  });

  it('opens the Evidence tray from Companion Home in one click', () => {
    bootstrap();
    const openEvidenceTrayButton = document.querySelector(
      '[data-action="openEvidenceTray"]',
    ) as HTMLButtonElement;
    const moreContext = document.querySelector(
      'details[data-panel-section="moreContext"]',
    ) as HTMLDetailsElement;
    const evidence = document.querySelector(
      'details[data-panel-section="evidence"]',
    ) as HTMLDetailsElement;
    const live = document.getElementById('panel-status-live') as HTMLElement;

    openEvidenceTrayButton.click();
    jest.advanceTimersByTime(20);

    expect(moreContext.open).toBe(true);
    expect(evidence.open).toBe(true);
    expect(live.textContent).toBe('Opened evidence tray.');
  });

  it('posts AI payload preview messages with entrypoint metadata when available', () => {
    const { postMessage } = bootstrap();
    const companionPreviewButton = document.querySelector(
      '[data-ai-payload-entrypoint="companion-home"]',
    ) as HTMLButtonElement;
    const trustCenterPreviewButton = document.querySelector(
      '[data-ai-payload-entrypoint="trust-center"]',
    ) as HTMLButtonElement;
    const fallbackPreviewButton = document.querySelector(
      '[data-action="openAiPayloadPreview"]:not([data-ai-payload-entrypoint])',
    ) as HTMLButtonElement;

    companionPreviewButton.click();
    trustCenterPreviewButton.click();
    fallbackPreviewButton.click();

    expect(postMessage).toHaveBeenCalledWith({
      type: 'openAiPayloadPreview',
      entrypoint: 'companion-home',
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: 'openAiPayloadPreview',
      entrypoint: 'trust-center',
    });
    expect(postMessage).toHaveBeenCalledWith({ type: 'openAiPayloadPreview' });
  });

  it('persists focus and scroll state for rerender restoration', () => {
    const { setState } = bootstrap();
    const input = document.getElementById('intent-override-input') as HTMLInputElement;

    input.focus();
    input.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        focusToken: 'id:intent-override-input',
      }),
    );

    (window as unknown as { scrollY: number }).scrollY = 77;
    window.dispatchEvent(new Event('scroll'));
    jest.advanceTimersByTime(120);

    expect(setState).toHaveBeenCalledWith(expect.objectContaining({ scrollY: 77 }));
  });

  it('restores focus for openEvidence tokens that include equals characters', () => {
    const encodedEvidence = encodeURIComponent('url:https://example.test/search?q=a=b&mode=full');
    const focusToken = 'action:openEvidence|evidence=' + encodedEvidence + '|ord=0';
    bootstrap({ sectionScope: 'scope-token', focusToken });
    jest.advanceTimersByTime(50);

    const evidenceButton = document.querySelector('[data-test-slot="primary"]');
    expect(document.activeElement).toBe(evidenceButton);
  });

  it('restores focus to the exact duplicate action target using ordinal metadata', () => {
    const { setState } = bootstrap();
    const duplicateButton = document.querySelector(
      '[data-test-slot="duplicate"]',
    ) as HTMLButtonElement;

    duplicateButton.focus();
    duplicateButton.dispatchEvent(new Event('focusin', { bubbles: true }));

    let focusToken: string | undefined;
    for (let index = setState.mock.calls.length - 1; index >= 0; index -= 1) {
      const [state] = setState.mock.calls[index] as [Record<string, unknown>];
      if (typeof state?.focusToken === 'string') {
        focusToken = state.focusToken;
        break;
      }
    }

    expect(focusToken).toBe(
      'action:openEvidence|evidence=' +
        encodeURIComponent('url:https://example.test/search?q=a=b&mode=full') +
        '|ord=1',
    );

    bootstrap({ sectionScope: 'scope-token', focusToken: focusToken || '' });
    jest.advanceTimersByTime(50);

    const restoredButton = document.querySelector('[data-test-slot="duplicate"]');
    expect(document.activeElement).toBe(restoredButton);
  });

  it('restores focus when evidence token values include pipe characters', () => {
    const encodedEvidence = encodeURIComponent('file:src/foo|bar.ts');
    const focusToken = 'action:openEvidence|evidence=' + encodedEvidence + '|ord=0';
    bootstrap({ sectionScope: 'scope-token', focusToken });
    jest.advanceTimersByTime(50);

    const pipeButton = document.querySelector('[data-test-slot="pipe"]');
    expect(document.activeElement).toBe(pipeButton);
  });

  it('keeps saved scroll position when focus restore falls back without preventScroll support', () => {
    const encodedEvidence = encodeURIComponent('url:https://example.test/search?q=a=b&mode=full');
    const focusToken = 'action:openEvidence|evidence=' + encodedEvidence + '|ord=0';

    bootstrap({ sectionScope: 'scope-token', focusToken, scrollY: 160 });
    const primaryButton = document.querySelector('[data-test-slot="primary"]') as HTMLElement;
    const focusMock = jest.fn((options?: FocusOptions) => {
      if (options && options.preventScroll) {
        throw new TypeError('focus options are unsupported');
      }
    });
    Object.defineProperty(primaryButton, 'focus', {
      configurable: true,
      value: focusMock,
    });

    jest.advanceTimersByTime(50);

    expect(focusMock).toHaveBeenNthCalledWith(1, { preventScroll: true });
    expect(focusMock).toHaveBeenNthCalledWith(2);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 160);
    expect((window.scrollTo as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps only the latest queued status announcement text', () => {
    bootstrap();
    const live = document.getElementById('panel-status-live') as HTMLElement;

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'panelStatus', message: 'First status.' } }),
    );
    jest.advanceTimersByTime(10);
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'panelStatus', message: 'Second status.' } }),
    );

    jest.advanceTimersByTime(6);
    expect(live.textContent).toBe('');

    jest.advanceTimersByTime(10);
    expect(live.textContent).toBe('Second status.');
  });

  it('allows skip-link hash navigation to main content without blocked-link warning', () => {
    const { postMessage } = bootstrap();
    const skipLink = document.querySelector('.skip-link') as HTMLAnchorElement;
    const main = document.getElementById('main') as HTMLElement;

    skipLink.click();

    expect(document.activeElement).toBe(main);
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'blockedLink' });
  });

  it('switches tab panels on tab button click and persists activeTabId', () => {
    const tabBodyHtml = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="0">Show more</button>
      <nav class="page-tabs">
        <button type="button" class="page-tab" data-tab-id="overview" aria-selected="true" id="tab-btn-overview">Overview</button>
        <button type="button" class="page-tab" data-tab-id="resume" aria-selected="false" id="tab-btn-resume">Resume</button>
      </nav>
      <div class="tab-panels">
        <section class="tab-panel" id="tab-panel-overview" role="tabpanel"></section>
        <section class="tab-panel" id="tab-panel-resume" role="tabpanel" hidden></section>
      </div>
    `;

    const { setState } = bootstrap({}, 'scope-token', tabBodyHtml);

    const resumeTabBtn = document.getElementById('tab-btn-resume') as HTMLButtonElement;
    const overviewTabBtn = document.getElementById('tab-btn-overview') as HTMLButtonElement;
    const overviewPanel = document.getElementById('tab-panel-overview') as HTMLElement;
    const resumePanel = document.getElementById('tab-panel-resume') as HTMLElement;

    resumeTabBtn.click();

    expect(resumeTabBtn.getAttribute('aria-selected')).toBe('true');
    expect(overviewTabBtn.getAttribute('aria-selected')).toBe('false');
    expect(resumePanel.hasAttribute('hidden')).toBe(false);
    expect(overviewPanel.hasAttribute('hidden')).toBe(true);
    expect(setState).toHaveBeenCalledWith(expect.objectContaining({ activeTabId: 'resume' }));
  });

  it('restores active tab from saved viewState on bootstrap', () => {
    const tabBodyHtml = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="0">Show more</button>
      <nav class="page-tabs">
        <button type="button" class="page-tab" data-tab-id="overview" aria-selected="true" id="tab-btn-overview">Overview</button>
        <button type="button" class="page-tab" data-tab-id="evidence" aria-selected="false" id="tab-btn-evidence">Evidence</button>
      </nav>
      <div class="tab-panels">
        <section class="tab-panel" id="tab-panel-overview" role="tabpanel"></section>
        <section class="tab-panel" id="tab-panel-evidence" role="tabpanel" hidden></section>
      </div>
    `;

    bootstrap({ sectionScope: 'scope-token', activeTabId: 'evidence' }, 'scope-token', tabBodyHtml);

    const overviewBtn = document.getElementById('tab-btn-overview') as HTMLButtonElement;
    const evidenceBtn = document.getElementById('tab-btn-evidence') as HTMLButtonElement;
    const overviewPanel = document.getElementById('tab-panel-overview') as HTMLElement;
    const evidencePanel = document.getElementById('tab-panel-evidence') as HTMLElement;

    expect(evidenceBtn.getAttribute('aria-selected')).toBe('true');
    expect(overviewBtn.getAttribute('aria-selected')).toBe('false');
    expect(evidencePanel.hasAttribute('hidden')).toBe(false);
    expect(overviewPanel.hasAttribute('hidden')).toBe(true);
  });

  it('switches to the requested tab when deep-link actions are clicked in the tab layout', () => {
    const tabBodyHtml = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="0">Show more</button>
      <button type="button" data-action="openEvidenceTray" id="open-evidence-tray">Open evidence</button>
      <button type="button" data-action="openWhySurfaced" id="open-why-surfaced">Open why surfaced</button>
      <nav class="page-tabs" role="tablist">
        <button type="button" class="page-tab" data-tab-id="overview" aria-selected="true" id="tab-btn-overview">Overview</button>
        <button type="button" class="page-tab" data-tab-id="evidence" aria-selected="false" id="tab-btn-evidence">Evidence</button>
        <button type="button" class="page-tab" data-tab-id="debrief" aria-selected="false" id="tab-btn-debrief">Debrief</button>
      </nav>
      <div class="tab-panels">
        <section class="tab-panel" id="tab-panel-overview" role="tabpanel"></section>
        <section class="tab-panel" id="tab-panel-evidence" role="tabpanel" hidden></section>
        <section class="tab-panel" id="tab-panel-debrief" role="tabpanel" hidden></section>
      </div>
    `;

    bootstrap({ sectionScope: 'scope-token' }, 'scope-token', tabBodyHtml);

    const overviewBtn = document.getElementById('tab-btn-overview') as HTMLButtonElement;
    const evidenceBtn = document.getElementById('tab-btn-evidence') as HTMLButtonElement;
    const debriefBtn = document.getElementById('tab-btn-debrief') as HTMLButtonElement;
    const overviewPanel = document.getElementById('tab-panel-overview') as HTMLElement;
    const evidencePanel = document.getElementById('tab-panel-evidence') as HTMLElement;
    const debriefPanel = document.getElementById('tab-panel-debrief') as HTMLElement;
    const openEvidenceTrayBtn = document.getElementById('open-evidence-tray') as HTMLButtonElement;
    const openWhySurfacedBtn = document.getElementById('open-why-surfaced') as HTMLButtonElement;

    openEvidenceTrayBtn.click();

    expect(evidenceBtn.getAttribute('aria-selected')).toBe('true');
    expect(overviewBtn.getAttribute('aria-selected')).toBe('false');
    expect(debriefBtn.getAttribute('aria-selected')).toBe('false');
    expect(evidencePanel.hasAttribute('hidden')).toBe(false);
    expect(overviewPanel.hasAttribute('hidden')).toBe(true);
    expect(debriefPanel.hasAttribute('hidden')).toBe(true);

    openWhySurfacedBtn.click();

    expect(debriefBtn.getAttribute('aria-selected')).toBe('true');
    expect(overviewBtn.getAttribute('aria-selected')).toBe('false');
    expect(evidenceBtn.getAttribute('aria-selected')).toBe('false');
    expect(debriefPanel.hasAttribute('hidden')).toBe(false);
    expect(overviewPanel.hasAttribute('hidden')).toBe(true);
    expect(evidencePanel.hasAttribute('hidden')).toBe(true);
  });

  it('posts updateProspective and updates cockpit save-state indicator on debounced input', () => {
    const cockpitBodyHtml = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="0">Show more</button>
      <div id="toast-region"></div>
      <div id="cockpit-save-state" aria-live="polite"></div>
      <input id="cockpit-verify-first" type="text" value="" />
      <input id="cockpit-next-step" type="text" value="" />
    `;
    const { postMessage } = bootstrap({}, 'scope-token', cockpitBodyHtml);

    const verifyInput = document.getElementById('cockpit-verify-first') as HTMLInputElement;
    const saveState = document.getElementById('cockpit-save-state') as HTMLElement;

    verifyInput.value = 'Check auth tests pass';
    verifyInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Saving… appears after the 15ms announce-timer fires
    jest.advanceTimersByTime(20);
    expect(saveState.textContent).toMatch(/Saving/);

    // After debounce flush (600ms), updateProspective should be posted
    jest.advanceTimersByTime(600);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateProspective', field: 'verifyFirst' }),
    );
    expect(saveState.textContent).toMatch(/Saved/);
  });

  it('shows checkpointDismiss undo toast and posts undoDeleteNote on undo click', () => {
    const cockpitBodyHtml = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="0">Show more</button>
      <div id="toast-region"></div>
      <button type="button" data-action="checkpointDismiss" data-note-id="note-abc-123">Dismiss</button>
    `;
    const { postMessage } = bootstrap({}, 'scope-token', cockpitBodyHtml);

    const dismissBtn = document.querySelector(
      '[data-action="checkpointDismiss"]',
    ) as HTMLButtonElement;
    dismissBtn.click();

    expect(postMessage).toHaveBeenCalledWith({
      type: 'checkpointDismiss',
    });

    // Toast is deferred — the extension posts showUndoToast after the dismiss write completes.
    const toastRegion = document.getElementById('toast-region') as HTMLElement;
    expect(toastRegion.textContent).toBe('');

    // Simulate the host confirmation message
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'showUndoToast', noteId: 'note-abc-123', timeoutMs: 30000 },
      }),
    );
    jest.advanceTimersByTime(1);

    expect(toastRegion.textContent).toContain('Note dismissed');

    // Click the Undo action button
    const undoBtn = toastRegion.querySelector('.toast-action') as HTMLButtonElement | null;
    expect(undoBtn).not.toBeNull();
    undoBtn!.click();

    expect(postMessage).toHaveBeenCalledWith({ type: 'undoDeleteNote', noteId: 'note-abc-123' });
  });

  it('auto-dismisses the undo toast after its timeout expires', () => {
    const cockpitBodyHtml = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="0">Show more</button>
      <div id="toast-region"></div>
      <button type="button" data-action="checkpointDismiss" data-note-id="note-xyz">Dismiss</button>
    `;
    bootstrap({}, 'scope-token', cockpitBodyHtml);

    // Toast is deferred — trigger via the host confirmation message.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'showUndoToast', noteId: 'note-xyz', timeoutMs: 30000 },
      }),
    );
    jest.advanceTimersByTime(1);

    const toastRegion = document.getElementById('toast-region') as HTMLElement;
    expect(toastRegion.children.length).toBeGreaterThan(0);

    jest.advanceTimersByTime(31000);
    expect(toastRegion.children.length).toBe(0);
  });

  it('shows taskStateResolve toast on resolve click', () => {
    const cockpitBodyHtml = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="0">Show more</button>
      <div id="toast-region"></div>
      <button type="button" data-action="taskStateResolve">Mark resolved</button>
    `;
    const { postMessage } = bootstrap({}, 'scope-token', cockpitBodyHtml);

    const resolveBtn = document.querySelector(
      '[data-action="taskStateResolve"]',
    ) as HTMLButtonElement;
    resolveBtn.click();

    expect(postMessage).toHaveBeenCalledWith({ type: 'taskStateResolve' });

    const toastRegion = document.getElementById('toast-region') as HTMLElement;
    expect(toastRegion.textContent).toContain('Task state marked resolved');
  });

  it('clears scope-bound scroll, focus, and tab state when section scope changes', () => {
    const { setState } = bootstrap(
      {
        sectionScope: 'old-scope',
        sectionExpanded: { timeline: true },
        evidenceListExpanded: true,
        scrollY: 120,
        focusToken: 'id:intent-override-input',
        activeTabId: 'evidence',
      },
      'scope-token',
    );

    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionScope: 'scope-token',
        sectionExpanded: {},
        evidenceListExpanded: false,
        scrollY: 0,
        focusToken: '',
        activeTabId: '',
      }),
    );
  });
});
