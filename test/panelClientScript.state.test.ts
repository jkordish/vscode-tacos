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

  function bootstrap(initialState: Record<string, unknown> = {}): {
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

    (globalThis as unknown as { acquireVsCodeApi: () => VsCodeApiMock }).acquireVsCodeApi = () => api;

    document.body.innerHTML = `
      <div id="panel-status-live"></div>
      <ul id="evidence-list"><li class="extra-evidence">more evidence</li></ul>
      <button type="button" data-action="toggleEvidenceMore" data-hidden-count="1">Show 1 more</button>
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

    const script = renderPanelClientScript(280, 'scope-token');
    // Execute generated webview script in the current jsdom context.
    // eslint-disable-next-line no-new-func
    const execute = new Function(script);
    execute();

    return { postMessage, setState };
  }

  it('persists evidence expansion state and announces expansion changes', () => {
    const { setState } = bootstrap();
    const toggle = document.querySelector('[data-action="toggleEvidenceMore"]') as HTMLButtonElement;
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
    const details = document.querySelector('details[data-panel-section="timeline"]') as HTMLDetailsElement;

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
});
