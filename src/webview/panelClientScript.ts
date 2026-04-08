export function renderPanelClientScript(
  maxIntentOverrideChars: number,
  panelSectionScopeToken: string,
): string {
  return `
      const vscode = acquireVsCodeApi();
      const panelSectionIds = new Set(['trustCenter', 'timeline', 'evidence', 'details', 'moreContext']);
      const panelSectionScope = ${JSON.stringify(panelSectionScopeToken)};
      const hostActions = new Set([
        'fixSummary',
        'checkpointPinToggle',
        'checkpointMarkDone',
        'checkpointDismiss',
        'checkpointOpenList',
        'taskStateResolve',
        'openScratchpad',
        'appendScratchpad',
        'setScratchpadScope',
        'sessionAddCheckpoint',
        'captureStructuredCheckpoint',
        'confirmTaskSwitch',
        'showCognitiveDebrief',
        'setIntentOverride',
        'clearIntentOverride',
        'copyNextSteps',
        'copySummary',
        'copyPromptAndOpenCodex',
        'refreshSummary',
        'toggleAutoSummaries',
        'acknowledgeNudge',
        'dismissNudge',
        'openPrivacySafety',
        'openAiPayloadPreview',
        'revokeAiPayloadConsent',
        'rateHelpfulness',
        'dismissDemoResume',
        'runNextStepAction',
        'restoreWorkingSet',
        'restoreJumpToLastEdit',
        'restoreReopenFiles',
        'restoreOpenChangedFiles',
        'restoreRerunTask',
        'restoreRerunDebug',
        'restoreOpenProblems',
        'restoreOpenDiagnosticFile',
        'restoreCheckoutPreviousBranch',
        'restoreCopyFailingCommand'
      ]);
      const viewState = Object.assign(
        { evidenceListExpanded: false, sectionExpanded: {}, sectionScope: '', scrollY: 0, focusToken: '', activeTabId: '' },
        vscode.getState() || {},
      );

      if (viewState.sectionScope !== panelSectionScope) {
        viewState.sectionExpanded = {};
        viewState.evidenceListExpanded = false;
        viewState.scrollY = 0;
        viewState.focusToken = '';
        viewState.activeTabId = '';
        viewState.sectionScope = panelSectionScope;
        vscode.setState(viewState);
      }

      function persistViewState() {
        vscode.setState(viewState);
      }

      function encodeFocusTokenValue(rawValue) {
        return encodeURIComponent(rawValue);
      }

      function decodeFocusTokenValue(rawValue) {
        try {
          return decodeURIComponent(rawValue);
        } catch {
          return rawValue;
        }
      }

      function createActionFocusCriteria(actionElement) {
        const criteria = {};
        if (typeof actionElement.dataset.stepIndex === 'string') {
          criteria.step = actionElement.dataset.stepIndex;
        }
        if (typeof actionElement.dataset.evidenceId === 'string') {
          criteria.evidence = actionElement.dataset.evidenceId;
        }
        if (typeof actionElement.dataset.linkIndex === 'string') {
          criteria.link = actionElement.dataset.linkIndex;
        }
        if (typeof actionElement.dataset.topFileIndex === 'string') {
          criteria.file = actionElement.dataset.topFileIndex;
        }
        return criteria;
      }

      function actionElementMatchesFocusCriteria(actionElement, criteria) {
        if (typeof criteria.step === 'string' && actionElement.dataset.stepIndex !== criteria.step) {
          return false;
        }
        if (
          typeof criteria.evidence === 'string' &&
          actionElement.dataset.evidenceId !== criteria.evidence
        ) {
          return false;
        }
        if (typeof criteria.link === 'string' && actionElement.dataset.linkIndex !== criteria.link) {
          return false;
        }
        if (typeof criteria.file === 'string' && actionElement.dataset.topFileIndex !== criteria.file) {
          return false;
        }
        return true;
      }

      function buildFocusToken(target) {
        if (!(target instanceof HTMLElement)) {
          return '';
        }

        if (target.id) {
          return 'id:' + target.id;
        }

        const resumePathStepId = target.getAttribute('data-resume-path-step-id');
        if (resumePathStepId) {
          return 'resumePath:' + resumePathStepId;
        }

        const actionElement = target.closest('[data-action]');
        if (!(actionElement instanceof HTMLElement)) {
          return '';
        }

        const action = actionElement.dataset.action;
        if (!action) {
          return '';
        }

        const criteria = createActionFocusCriteria(actionElement);
        const payloadParts = [action];
        if (typeof criteria.step === 'string') {
          payloadParts.push('step=' + encodeFocusTokenValue(criteria.step));
        }
        if (typeof criteria.evidence === 'string') {
          payloadParts.push('evidence=' + encodeFocusTokenValue(criteria.evidence));
        }
        if (typeof criteria.link === 'string') {
          payloadParts.push('link=' + encodeFocusTokenValue(criteria.link));
        }
        if (typeof criteria.file === 'string') {
          payloadParts.push('file=' + encodeFocusTokenValue(criteria.file));
        }

        const candidates = document.querySelectorAll('[data-action="' + action + '"]');
        let ordinal = 0;
        for (const candidate of candidates) {
          if (!(candidate instanceof HTMLElement)) {
            continue;
          }
          if (!actionElementMatchesFocusCriteria(candidate, criteria)) {
            continue;
          }
          if (candidate === actionElement) {
            payloadParts.push('ord=' + ordinal);
            break;
          }
          ordinal += 1;
        }

        return 'action:' + payloadParts.join('|');
      }

      function resolveFocusToken(token) {
        if (typeof token !== 'string' || !token) {
          return undefined;
        }

        if (token.startsWith('id:')) {
          const id = token.slice(3);
          const candidate = document.getElementById(id);
          return candidate instanceof HTMLElement ? candidate : undefined;
        }

        if (token.startsWith('resumePath:')) {
          const stepId = token.slice('resumePath:'.length);
          const candidate = document.querySelector(
            '[data-resume-path-step-id="' + stepId + '"]',
          );
          return candidate instanceof HTMLElement ? candidate : undefined;
        }

        if (!token.startsWith('action:')) {
          return undefined;
        }

        const payload = token.slice('action:'.length);
        const [actionPart, ...rest] = payload.split('|');
        const candidates = document.querySelectorAll('[data-action="' + actionPart + '"]');
        if (candidates.length === 0) {
          return undefined;
        }

        if (rest.length === 0) {
          const first = candidates[0];
          return first instanceof HTMLElement ? first : undefined;
        }

        const criteria = {};
        let expectedOrdinal;
        for (const clause of rest) {
          const delimiterIndex = clause.indexOf('=');
          const rawKey = delimiterIndex === -1 ? clause : clause.slice(0, delimiterIndex);
          const rawValue = delimiterIndex === -1 ? '' : clause.slice(delimiterIndex + 1);
          const key = rawKey.trim();
          const value = (rawValue || '').trim();
          if (!value) {
            continue;
          }
          if (key === 'ord') {
            const parsedOrdinal = Number(value);
            if (Number.isInteger(parsedOrdinal) && parsedOrdinal >= 0) {
              expectedOrdinal = parsedOrdinal;
            }
            continue;
          }
          if (key === 'step' || key === 'evidence' || key === 'link' || key === 'file') {
            criteria[key] = decodeFocusTokenValue(value);
          }
        }

        let matchedOrdinal = 0;
        let firstMatch;
        for (const candidate of candidates) {
          if (!(candidate instanceof HTMLElement)) {
            continue;
          }
          if (!actionElementMatchesFocusCriteria(candidate, criteria)) {
            continue;
          }
          if (!(firstMatch instanceof HTMLElement)) {
            firstMatch = candidate;
          }
          if (expectedOrdinal === undefined || expectedOrdinal === matchedOrdinal) {
            return candidate;
          }
          matchedOrdinal += 1;
        }

        return firstMatch instanceof HTMLElement ? firstMatch : undefined;
      }

      let scrollPersistTimeout;
      function persistScrollPositionSoon() {
        if (typeof scrollPersistTimeout !== 'undefined') {
          window.clearTimeout(scrollPersistTimeout);
        }
        scrollPersistTimeout = window.setTimeout(() => {
          viewState.scrollY = Math.max(0, Math.round(window.scrollY || 0));
          persistViewState();
        }, 80);
      }

      function restoreViewPosition() {
        const hasSavedScroll = Number.isFinite(viewState.scrollY) && viewState.scrollY > 0;
        const savedScrollY = hasSavedScroll ? viewState.scrollY : 0;
        if (hasSavedScroll) {
          window.scrollTo(0, savedScrollY);
        }

        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body) {
          return;
        }
        const restored = resolveFocusToken(viewState.focusToken);
        if (restored instanceof HTMLElement) {
          // If the focus target lives inside a hidden tab panel, switch to that
          // tab first so focus lands on a visible element.
          const containingPanel = restored.closest('.tab-panel[hidden]');
          if (containingPanel instanceof HTMLElement) {
            const panelId = containingPanel.id;
            // panelId is "tab-panel-<tabId>"
            const tabId = panelId.startsWith('tab-panel-') ? panelId.slice('tab-panel-'.length) : '';
            if (tabId) {
              switchToTab(tabId);
            }
          }
          try {
            restored.focus({ preventScroll: true });
          } catch {
            restored.focus();
            if (hasSavedScroll) {
              window.scrollTo(0, savedScrollY);
            }
          }
        }
      }

      let announceStatusTimeout;
      function announceStatus(rawMessage) {
        if (typeof rawMessage !== 'string') {
          return;
        }
        const liveRegion = document.getElementById('panel-status-live');
        if (!(liveRegion instanceof HTMLElement)) {
          return;
        }
        const message = rawMessage.trim();
        if (!message) {
          return;
        }
        if (typeof announceStatusTimeout !== 'undefined') {
          window.clearTimeout(announceStatusTimeout);
        }
        liveRegion.textContent = '';
        // Force a text change so repeated messages still announce.
        announceStatusTimeout = window.setTimeout(() => {
          liveRegion.textContent = message;
        }, 15);
      }

      function setEvidenceListExpanded(expanded, announceChange = false) {
        const list = document.getElementById('evidence-list');
        const toggle = document.querySelector('[data-action="toggleEvidenceMore"]');
        if (!(list instanceof HTMLElement) || !(toggle instanceof HTMLElement)) {
          viewState.evidenceListExpanded = false;
          persistViewState();
          return;
        }

        list.classList.toggle('show-more', expanded);
        const rawHiddenCount = toggle.dataset.hiddenCount;
        const parsedHiddenCount =
          rawHiddenCount && rawHiddenCount.trim() !== '' ? Number(rawHiddenCount) : NaN;
        const collapsedLabel =
          Number.isInteger(parsedHiddenCount) && parsedHiddenCount > 0
            ? 'Show ' + parsedHiddenCount + ' more'
            : 'Show more';
        toggle.textContent = expanded ? 'Show less' : collapsedLabel;
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        viewState.evidenceListExpanded = expanded;
        persistViewState();
        if (announceChange) {
          announceStatus(expanded ? 'Evidence list expanded.' : 'Evidence list collapsed.');
        }
      }

      function persistPanelSectionExpanded(sectionId, expanded) {
        const sectionExpanded = Object.assign({}, viewState.sectionExpanded || {});
        sectionExpanded[sectionId] = expanded;
        viewState.sectionExpanded = sectionExpanded;
        viewState.sectionScope = panelSectionScope;
        persistViewState();
        vscode.postMessage({ type: 'setPanelSectionExpanded', sectionId, expanded });
      }

      function restorePanelSectionExpansion() {
        const sectionExpanded = viewState.sectionExpanded || {};
        for (const [sectionId, expanded] of Object.entries(sectionExpanded)) {
          if (!panelSectionIds.has(sectionId)) {
            continue;
          }

          const details = document.querySelector('details[data-panel-section="' + sectionId + '"]');
          if (!(details instanceof HTMLDetailsElement)) {
            continue;
          }

          details.open = Boolean(expanded);
        }
      }

      function switchToTab(tabId) {
        if (typeof tabId !== 'string' || !tabId) {
          return;
        }
        const tabButtons = Array.from(document.querySelectorAll('.page-tab[data-tab-id]'));
        const tabPanels = document.querySelectorAll('.tab-panel');
        let matched = false;
        for (const btn of tabButtons) {
          if (!(btn instanceof HTMLElement)) {
            continue;
          }
          const isTarget = btn.dataset.tabId === tabId;
          btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
          // Roving tabindex: active tab is reachable via Tab key, others are skipped
          btn.setAttribute('tabindex', isTarget ? '0' : '-1');
          if (isTarget) {
            matched = true;
          }
        }
        // If tabId not found, fall back to the first tab
        if (!matched && tabButtons.length > 0) {
          const first = tabButtons[0];
          if (first instanceof HTMLElement) {
            first.setAttribute('aria-selected', 'true');
            first.setAttribute('tabindex', '0');
            tabId = first.dataset.tabId || tabId;
          }
        }
        for (const panel of tabPanels) {
          if (!(panel instanceof HTMLElement)) {
            continue;
          }
          const panelId = panel.id;
          const expectedId = 'tab-panel-' + tabId;
          if (panelId === expectedId) {
            panel.removeAttribute('hidden');
          } else {
            panel.setAttribute('hidden', '');
          }
        }
        viewState.activeTabId = tabId;
        persistViewState();
      }

      function restoreActiveTab() {
        const tabs = document.querySelectorAll('.page-tab[data-tab-id]');
        if (tabs.length === 0) {
          return;
        }
        const saved = typeof viewState.activeTabId === 'string' ? viewState.activeTabId : '';
        if (saved) {
          switchToTab(saved);
          return;
        }
        // No saved tab: activate whichever tab has aria-selected="true" in the HTML, or first
        for (const btn of tabs) {
          if (btn instanceof HTMLElement && btn.getAttribute('aria-selected') === 'true') {
            switchToTab(btn.dataset.tabId || '');
            return;
          }
        }
        const first = tabs[0];
        if (first instanceof HTMLElement) {
          switchToTab(first.dataset.tabId || '');
        }
      }

      setEvidenceListExpanded(Boolean(viewState.evidenceListExpanded), false);
      restorePanelSectionExpansion();
      restoreActiveTab();

      // Measure the sticky page header and expose its height as a CSS custom
      // property so the tab bar can offset itself correctly via
      // \`top: var(--page-header-height, 0px)\`.
      function updatePageHeaderHeight() {
        const header = document.querySelector('.page-header');
        const height = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
        document.documentElement.style.setProperty('--page-header-height', height + 'px');
      }
      updatePageHeaderHeight();
      if (typeof ResizeObserver !== 'undefined') {
        const header = document.querySelector('.page-header');
        if (header instanceof HTMLElement) {
          new ResizeObserver(updatePageHeaderHeight).observe(header);
        }
      }

      window.addEventListener(
        'scroll',
        () => {
          persistScrollPositionSoon();
        },
        { passive: true },
      );
      document.addEventListener('focusin', (event) => {
        const target = event.target;
        const nextToken = buildFocusToken(target);
        if (!nextToken || viewState.focusToken === nextToken) {
          return;
        }
        viewState.focusToken = nextToken;
        persistViewState();
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          restoreViewPosition();
        });
      });

      window.addEventListener('message', (event) => {
        const payload = event.data;
        if (!payload || typeof payload !== 'object') {
          return;
        }
        if (payload.type !== 'panelStatus' || typeof payload.message !== 'string') {
          return;
        }
        announceStatus(payload.message);
      });

      function parseDatasetInteger(rawValue) {
        if (typeof rawValue !== 'string') {
          return undefined;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed) || parsed < 0) {
          return undefined;
        }
        return parsed;
      }

      const maxIntentOverrideChars = ${maxIntentOverrideChars};
      function normalizeIntentOverrideInput(rawValue) {
        if (typeof rawValue !== 'string') {
          return undefined;
        }

        const normalized = rawValue
          .replace(/\\r?\\n/g, ' ')
          .replace(/\\s+/g, ' ')
          .trim()
          .slice(0, maxIntentOverrideChars);
        return normalized || undefined;
      }

      // ── Cockpit inline-edit autosave ────────────────────────────────
      const COCKPIT_DEBOUNCE_MS = 600;
      const cockpitTimers = {};
      let cockpitSaveStateTimer = undefined;

      function normalizeCockpitValue(rawValue) {
        if (typeof rawValue !== 'string') {
          return '';
        }
        return rawValue.replace(/\\r?\\n/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 280);
      }

      function setCockpitSaveState(message) {
        const saveState = document.getElementById('cockpit-save-state');
        if (saveState instanceof HTMLElement) {
          saveState.textContent = '';
          if (cockpitSaveStateTimer !== undefined) {
            window.clearTimeout(cockpitSaveStateTimer);
          }
          cockpitSaveStateTimer = window.setTimeout(() => {
            cockpitSaveStateTimer = undefined;
            saveState.textContent = typeof message === 'string' ? message : '';
          }, 15);
        }
      }

      function sendCockpitUpdate(field, rawValue) {
        const value = normalizeCockpitValue(rawValue);
        vscode.postMessage({ type: 'updateProspective', field, value });
        setCockpitSaveState('Saved.');
      }

      function scheduleCockpitUpdate(field, rawValue) {
        if (cockpitTimers[field] !== undefined) {
          window.clearTimeout(cockpitTimers[field]);
        }
        setCockpitSaveState('Saving…');
        cockpitTimers[field] = window.setTimeout(() => {
          delete cockpitTimers[field];
          sendCockpitUpdate(field, rawValue);
        }, COCKPIT_DEBOUNCE_MS);
      }

      document.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        if (target.id === 'cockpit-verify-first') {
          scheduleCockpitUpdate('verifyFirst', target.value);
          return;
        }
        if (target.id === 'cockpit-next-step') {
          scheduleCockpitUpdate('nextStep', target.value);
          return;
        }
      });

      // Flush pending cockpit timers on blur so edits survive panel rerenders
      // that tear down the document before the debounce fires.
      document.addEventListener('focusout', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        if (target.id === 'cockpit-verify-first' && cockpitTimers['verifyFirst'] !== undefined) {
          window.clearTimeout(cockpitTimers['verifyFirst']);
          delete cockpitTimers['verifyFirst'];
          sendCockpitUpdate('verifyFirst', target.value);
          return;
        }
        if (target.id === 'cockpit-next-step' && cockpitTimers['nextStep'] !== undefined) {
          window.clearTimeout(cockpitTimers['nextStep']);
          delete cockpitTimers['nextStep'];
          sendCockpitUpdate('nextStep', target.value);
          return;
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
          return;
        }
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        if (target.id === 'cockpit-verify-first') {
          event.preventDefault();
          if (cockpitTimers['verifyFirst'] !== undefined) {
            window.clearTimeout(cockpitTimers['verifyFirst']);
            delete cockpitTimers['verifyFirst'];
          }
          sendCockpitUpdate('verifyFirst', target.value);
          // Move focus to next-step input for efficient keyboard flow
          const nextInput = document.getElementById('cockpit-next-step');
          if (nextInput instanceof HTMLInputElement) {
            nextInput.focus();
            nextInput.select();
          }
          return;
        }
        if (target.id === 'cockpit-next-step') {
          event.preventDefault();
          if (cockpitTimers['nextStep'] !== undefined) {
            window.clearTimeout(cockpitTimers['nextStep']);
            delete cockpitTimers['nextStep'];
          }
          sendCockpitUpdate('nextStep', target.value);
          return;
        }
      });

      document.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const toggle = target.closest('[data-resume-path-toggle="true"]');
        if (!(toggle instanceof HTMLInputElement)) {
          return;
        }

        const stepId = toggle.dataset.resumePathStepId;
        if (
          stepId !== 'confirmIntent' &&
          stepId !== 'runNextSafeAction' &&
          stepId !== 'clearBlocker'
        ) {
          return;
        }

        vscode.postMessage({
          type: 'resumePathToggle',
          stepId,
          completed: toggle.checked,
        });
      });

      document.addEventListener('toggle', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLDetailsElement)) {
          return;
        }

        if (target.dataset.whySurfacedDetails === 'true' && target.open) {
          vscode.postMessage({ type: 'whySurfacedOpened' });
        }

        const sectionId = target.dataset.panelSection;
        if (typeof sectionId !== 'string' || !panelSectionIds.has(sectionId)) {
          return;
        }

        persistPanelSectionExpanded(sectionId, target.open);
      });

      document.addEventListener('keydown', (event) => {
        if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey) {
          return;
        }

        const target = event.target;
        const targetIsTextInput =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable);
        const key = event.key.toLowerCase();
        if (!['r', 'n', 'i'].includes(key)) {
          return;
        }
        if (targetIsTextInput && key !== 'i') {
          return;
        }

        event.preventDefault();
        if (key === 'r') {
          announceStatus('Shortcut: refreshing summary.');
          vscode.postMessage({ type: 'refreshSummary' });
          return;
        }
        if (key === 'n') {
          announceStatus('Shortcut: copying next steps.');
          vscode.postMessage({ type: 'copyNextSteps' });
          return;
        }
        switchToTab('overview');
        const intentInput = document.getElementById('intent-override-input');
        if (intentInput instanceof HTMLInputElement) {
          intentInput.focus();
          intentInput.select();
          announceStatus('Shortcut: focused intent editor.');
        }
      });

      document.addEventListener('keydown', (event) => {
        if (!(event.target instanceof HTMLInputElement)) {
          return;
        }

        if (event.target.id !== 'intent-override-input') {
          return;
        }

        if (event.key !== 'Enter') {
          return;
        }

        event.preventDefault();
        const intent = normalizeIntentOverrideInput(event.target.value);
        if (!intent) {
          return;
        }

        vscode.postMessage({
          type: 'setIntentOverride',
          intent,
        });
      });

      // Tab keyboard navigation per ARIA Tabs pattern (ArrowLeft/ArrowRight/Home/End)
      document.addEventListener('keydown', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const tabList = target.closest('[role="tablist"]');
        if (!(tabList instanceof HTMLElement)) {
          return;
        }
        const tabButtons = Array.from(tabList.querySelectorAll('.page-tab[data-tab-id]')).filter(
          (b) => b instanceof HTMLElement,
        );
        if (tabButtons.length === 0) {
          return;
        }
        const currentIndex = tabButtons.indexOf(target);
        if (currentIndex === -1) {
          return;
        }
        let nextIndex = -1;
        if (event.key === 'ArrowRight') {
          nextIndex = (currentIndex + 1) % tabButtons.length;
        } else if (event.key === 'ArrowLeft') {
          nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = tabButtons.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        const nextBtn = tabButtons[nextIndex];
        if (nextBtn instanceof HTMLElement) {
          const nextTabId = nextBtn.dataset.tabId;
          if (nextTabId) {
            switchToTab(nextTabId);
          }
          nextBtn.focus();
        }
      });

      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        // Tab bar click handling
        const tabBtn = target.closest('.page-tab[data-tab-id]');
        if (tabBtn instanceof HTMLElement) {
          const tabId = tabBtn.dataset.tabId;
          if (tabId) {
            switchToTab(tabId);
          }
          return;
        }

        const actionElement = target.closest('[data-action]');
        if (actionElement instanceof HTMLElement) {
          event.preventDefault();
          const action = actionElement.dataset.action;
          if (typeof action !== 'string' || !action) {
            vscode.postMessage({ type: 'blockedLink' });
            return;
          }

          if (action === 'toggleEvidenceMore') {
            setEvidenceListExpanded(!Boolean(viewState.evidenceListExpanded), true);
            return;
          }

          if (action === 'openEvidence') {
            const evidenceId = actionElement.dataset.evidenceId?.trim();
            if (!evidenceId) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            vscode.postMessage({ type: 'openEvidence', evidenceId });
            return;
          }

          if (action === 'openLink') {
            const index = parseDatasetInteger(actionElement.dataset.linkIndex);
            if (index === undefined) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            vscode.postMessage({ type: 'openLink', index });
            return;
          }

          if (action === 'openWhySurfaced') {
            // Switch to Debrief tab if the tab panel layout is present
            switchToTab('debrief');

            const moreContext = document.querySelector(
              'details[data-panel-section="moreContext"]',
            );
            if (moreContext instanceof HTMLDetailsElement) {
              moreContext.open = true;
            }

            const trustCenter = document.querySelector(
              'details[data-panel-section="trustCenter"]',
            );
            if (trustCenter instanceof HTMLDetailsElement) {
              trustCenter.open = true;
            }

            const whySurfaced = document.querySelector('details[data-why-surfaced-details="true"]');
            if (whySurfaced instanceof HTMLDetailsElement) {
              whySurfaced.open = true;

              const whySurfacedSummary = whySurfaced.querySelector('summary');
              if (whySurfacedSummary instanceof HTMLElement) {
                whySurfacedSummary.focus();
                if (typeof whySurfacedSummary.scrollIntoView === 'function') {
                  whySurfacedSummary.scrollIntoView({ block: 'start' });
                }
              }
            }

            announceStatus('Opened Why am I seeing this? details.');
            return;
          }

          if (action === 'openEvidenceTray') {
            // Switch to Evidence tab if the tab panel layout is present
            switchToTab('evidence');

            const moreContext = document.querySelector(
              'details[data-panel-section="moreContext"]',
            );
            if (moreContext instanceof HTMLDetailsElement) {
              moreContext.open = true;
            }

            const evidenceDetails = document.querySelector(
              'details[data-panel-section="evidence"]',
            );
            if (evidenceDetails instanceof HTMLDetailsElement) {
              evidenceDetails.open = true;
              const evidenceSummary = evidenceDetails.querySelector('summary');
              if (evidenceSummary instanceof HTMLElement) {
                evidenceSummary.focus();
                if (typeof evidenceSummary.scrollIntoView === 'function') {
                  evidenceSummary.scrollIntoView({ block: 'start' });
                }
              }
            }

            announceStatus('Opened evidence tray.');
            return;
          }

          if (action === 'openTopFile') {
            const index = parseDatasetInteger(actionElement.dataset.topFileIndex);
            if (index === undefined) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            vscode.postMessage({ type: 'openTopFile', index });
            return;
          }

          if (action === 'runNextStepAction') {
            const stepIndex = parseDatasetInteger(actionElement.dataset.stepIndex);
            if (stepIndex === undefined) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            const primarySurface = actionElement.dataset.primaryNextSafeAction;
            if (primarySurface === 'home') {
              vscode.postMessage({ type: 'runNextStepAction', stepIndex, primarySurface });
              return;
            }
            vscode.postMessage({ type: 'runNextStepAction', stepIndex });
            return;
          }

          if (action === 'setIntentOverride') {
            const input = document.getElementById('intent-override-input');
            if (!(input instanceof HTMLInputElement)) {
              return;
            }

            const intent = normalizeIntentOverrideInput(input.value);
            if (!intent) {
              input.focus();
              return;
            }
            vscode.postMessage({ type: 'setIntentOverride', intent });
            return;
          }

          if (action === 'openAiPayloadPreview') {
            const entrypoint = actionElement.dataset.aiPayloadEntrypoint;
            if (
              entrypoint === 'trust-center' ||
              entrypoint === 'why-surfaced' ||
              entrypoint === 'companion-home' ||
              entrypoint === 'provenance-badge'
            ) {
              vscode.postMessage({ type: 'openAiPayloadPreview', entrypoint });
              return;
            }
            vscode.postMessage({ type: 'openAiPayloadPreview' });
            return;
          }

          if (action === 'setPanelSectionExpanded') {
            const sectionId = actionElement.dataset.sectionId;
            if (typeof sectionId !== 'string' || !panelSectionIds.has(sectionId)) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            const expanded = actionElement.dataset.sectionExpanded !== 'false';
            const details = document.querySelector(
              'details[data-panel-section="' + sectionId + '"]',
            );
            if (details instanceof HTMLDetailsElement) {
              details.open = expanded;
              const summary = details.querySelector('summary');
              if (summary instanceof HTMLElement) {
                summary.focus();
                if (typeof summary.scrollIntoView === 'function') {
                  summary.scrollIntoView({ block: 'start' });
                }
              }
            }
            persistPanelSectionExpanded(sectionId, expanded);
            announceStatus(
              (expanded ? 'Expanded ' : 'Collapsed ') + sectionId + ' section.',
            );
            return;
          }

          if (action === 'setEvidenceGroupMode') {
            const mode = actionElement.dataset.evidenceMode;
            if (
              mode === 'recent' ||
              mode === 'by-file' ||
              mode === 'by-time' ||
              mode === 'by-action'
            ) {
              vscode.postMessage({ type: 'setEvidenceGroupMode', mode });
            } else {
              vscode.postMessage({ type: 'blockedLink' });
            }
            return;
          }

          if (hostActions.has(action)) {
            if (actionElement.dataset.blockerPrimaryAction === 'true') {
              vscode.postMessage({ type: action, primarySurface: 'blocked' });
              return;
            }
            vscode.postMessage({ type: action });
            return;
          }

          vscode.postMessage({ type: 'blockedLink' });
          return;
        }

        const anchor = target.closest('a');
        if (anchor) {
          const href = anchor.getAttribute('href');
          if (typeof href === 'string' && href.startsWith('#')) {
            const targetId = href.slice(1);
            if (targetId) {
              const hashTarget = document.getElementById(targetId);
              if (hashTarget instanceof HTMLElement) {
                event.preventDefault();
                hashTarget.focus();
                if (typeof hashTarget.scrollIntoView === 'function') {
                  hashTarget.scrollIntoView({ block: 'start' });
                }
                return;
              }
            }
          }
          event.preventDefault();
          vscode.postMessage({ type: 'blockedLink' });
        }
      });
`;
}
