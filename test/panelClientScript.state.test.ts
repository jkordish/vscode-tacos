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

    document.body.innerHTML = `
      <a class="skip-link" href="#main">Skip to main content</a>
      <div id="panel-status-live"></div>
      <main id="main" tabindex="-1"></main>
      <ul id="evidence-list"><li class="extra-evidence">more evidence</li></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="1">Show 1 more</button>
      <button type="button" data-action="openWhySurfaced">Why am I seeing this?</button>
      <button type="button" data-test-slot="primary" data-action="openEvidence" data-evidence-id="url:https://example.test/search?q=a=b&mode=full">Open evidence</button>
      <button type="button" data-test-slot="duplicate" data-action="openEvidence" data-evidence-id="url:https://example.test/search?q=a=b&mode=full">Open evidence duplicate</button>
      <button type="button" data-test-slot="pipe" data-action="openEvidence" data-evidence-id="file:src/foo|bar.ts">Open pipe evidence</button>
      <details data-panel-section="moreContext">
        <summary>More Context</summary>
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
    // eslint-disable-next-line no-new-func
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

  it('clears scope-bound scroll and focus state when section scope changes', () => {
    const { setState } = bootstrap(
      {
        sectionScope: 'old-scope',
        sectionExpanded: { timeline: true },
        evidenceListExpanded: true,
        scrollY: 120,
        focusToken: 'id:intent-override-input',
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
      }),
    );
  });
});
