export function renderPanelClientScript(
  maxIntentOverrideChars: number,
  panelSectionScopeToken: string,
): string {
  return `
      const vscode = acquireVsCodeApi();
      const panelSectionIds = new Set(['trustCenter', 'timeline', 'evidence', 'details']);
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
        { evidenceListExpanded: false, sectionExpanded: {}, sectionScope: '' },
        vscode.getState() || {},
      );

      if (viewState.sectionScope !== panelSectionScope) {
        viewState.sectionExpanded = {};
        viewState.sectionScope = panelSectionScope;
        vscode.setState(viewState);
      }

      function persistViewState() {
        vscode.setState(viewState);
      }

      function setEvidenceListExpanded(expanded) {
        const list = document.getElementById('evidence-list');
        const toggle = document.querySelector('[data-action="toggleEvidenceMore"]');
        if (!(list instanceof HTMLElement) || !(toggle instanceof HTMLElement)) {
          viewState.evidenceListExpanded = false;
          persistViewState();
          return;
        }

        list.classList.toggle('show-more', expanded);
        const hiddenCount = Number.parseInt(toggle.dataset.hiddenCount || '', 10);
        const collapsedLabel =
          Number.isFinite(hiddenCount) && hiddenCount > 0 ? 'Show ' + hiddenCount + ' more' : 'Show more';
        toggle.textContent = expanded ? 'Show less' : collapsedLabel;
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        viewState.evidenceListExpanded = expanded;
        persistViewState();
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

      setEvidenceListExpanded(Boolean(viewState.evidenceListExpanded));
      restorePanelSectionExpansion();

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

        const sectionId = target.dataset.panelSection;
        if (typeof sectionId !== 'string' || !panelSectionIds.has(sectionId)) {
          return;
        }

        persistPanelSectionExpanded(sectionId, target.open);
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
            setEvidenceListExpanded(!Boolean(viewState.evidenceListExpanded));
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
            vscode.postMessage({ type: action });
            return;
          }

          vscode.postMessage({ type: 'blockedLink' });
          return;
        }

        const anchor = target.closest('a');
        if (anchor) {
          event.preventDefault();
          vscode.postMessage({ type: 'blockedLink' });
        }
      });
`;
}
