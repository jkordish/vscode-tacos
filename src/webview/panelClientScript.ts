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
        'openScratchpad',
        'appendScratchpad',
        'setScratchpadScope',
        'sessionAddCheckpoint',
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
        { evidenceListExpanded: false, sectionExpanded: {}, sectionScope: '', scrollY: 0, focusToken: '' },
        vscode.getState() || {},
      );

      if (viewState.sectionScope !== panelSectionScope) {
        viewState.sectionExpanded = {};
        viewState.evidenceListExpanded = false;
        viewState.scrollY = 0;
        viewState.focusToken = '';
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

      setEvidenceListExpanded(Boolean(viewState.evidenceListExpanded), false);
      restorePanelSectionExpansion();
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

      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
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
