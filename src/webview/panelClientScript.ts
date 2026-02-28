export function renderPanelClientScript(maxIntentOverrideChars: number): string {
  return `
      const vscode = acquireVsCodeApi();
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
        { evidenceExpanded: false, timelineExpanded: false },
        vscode.getState() || {},
      );

      function persistViewState() {
        vscode.setState(viewState);
      }

      function setEvidenceExpanded(expanded) {
        const list = document.getElementById('evidence-list');
        const toggle = document.querySelector('[data-action="toggleEvidenceMore"]');
        if (!(list instanceof HTMLElement) || !(toggle instanceof HTMLElement)) {
          viewState.evidenceExpanded = false;
          persistViewState();
          return;
        }

        list.classList.toggle('show-more', expanded);
        toggle.textContent = expanded ? 'Show less' : 'Show more';
        viewState.evidenceExpanded = expanded;
        persistViewState();
      }

      function setTimelineExpanded(expanded) {
        const timeline = document.getElementById('timeline-content');
        const toggle = document.querySelector('[data-action="toggleTimeline"]');
        if (!(timeline instanceof HTMLElement) || !(toggle instanceof HTMLElement)) {
          viewState.timelineExpanded = false;
          persistViewState();
          return;
        }

        if (expanded) {
          timeline.removeAttribute('hidden');
          toggle.textContent = 'Hide timeline';
          toggle.setAttribute('aria-expanded', 'true');
        } else {
          timeline.setAttribute('hidden', 'true');
          toggle.textContent = 'Show timeline';
          toggle.setAttribute('aria-expanded', 'false');
        }
        viewState.timelineExpanded = expanded;
        persistViewState();
      }

      setEvidenceExpanded(Boolean(viewState.evidenceExpanded));
      setTimelineExpanded(Boolean(viewState.timelineExpanded));

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
            setEvidenceExpanded(!Boolean(viewState.evidenceExpanded));
            return;
          }

          if (action === 'toggleTimeline') {
            setTimelineExpanded(!Boolean(viewState.timelineExpanded));
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
            if (primarySurface === 'home' || primarySurface === 'recap') {
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
