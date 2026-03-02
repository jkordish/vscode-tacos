export const PANEL_WEBVIEW_STYLE = `
      :root {
        --surface-bg: var(--vscode-editorWidget-background);
        --surface-border: var(--vscode-panel-border);
        --surface-muted: var(--vscode-descriptionForeground);
        --surface-strong: var(--vscode-foreground);
        --accent: var(--vscode-focusBorder);
        --space-1: 4px;
        --space-2: 8px;
        --space-3: 12px;
        --space-4: 16px;
        --radius-1: 6px;
        --radius-2: 8px;
        --radius-3: 10px;
        --radius-4: 12px;
        --motion-quick: 120ms;
        --motion-soft: 180ms;
      }
      body {
        color: var(--surface-strong);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        line-height: 1.5;
        margin: 0;
        padding: var(--space-4);
      }
      main {
        display: block;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .skip-link {
        position: absolute;
        left: var(--space-3);
        top: var(--space-2);
        z-index: 999;
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: var(--radius-1);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        padding: 6px var(--space-3);
        text-decoration: none;
        transform: translateY(-140%);
      }
      .skip-link:focus-visible {
        transform: translateY(0);
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      .card {
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-4);
        padding: var(--space-3);
        margin-bottom: var(--space-3);
        background: var(--surface-bg);
      }
      ul {
        padding-left: 20px;
      }
      h3 {
        margin-top: 0;
        margin-bottom: var(--space-2);
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      h3::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--accent);
      }
      h4 {
        margin-bottom: 8px;
      }
      a {
        color: var(--vscode-textLink-foreground);
      }
      a:hover {
        color: var(--vscode-textLink-activeForeground);
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .details-markdown {
        line-height: 1.45;
      }
      .details-markdown > :first-child {
        margin-top: 0;
      }
      .details-markdown > :last-child {
        margin-bottom: 0;
      }
      .details-markdown p,
      .details-markdown li {
        overflow-wrap: anywhere;
      }
      .details-markdown code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      }
      .kind {
        color: var(--vscode-descriptionForeground);
      }
      .mode {
        color: var(--vscode-descriptionForeground);
        font-size: 13px;
      }
      .status-label {
        font-weight: 700;
        font-size: 13px;
      }
      .status-detail {
        margin-top: var(--space-1);
      }
      .status-actions {
        margin-top: var(--space-2);
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .step-evidence {
        margin-top: var(--space-1);
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
      }
      .step-actions {
        margin-top: var(--space-2);
      }
      .step-action {
        min-height: 24px;
        padding: 6px 10px;
        font-size: 12px;
      }
      .step-advisory {
        margin-top: var(--space-1);
        font-size: 12px;
      }
      .badge {
        display: inline-block;
        border: 1px solid var(--vscode-widget-border);
        border-radius: 999px;
        padding: 2px var(--space-2);
        font-size: 12px;
        text-decoration: none;
        color: inherit;
      }
      .badge.clickable {
        cursor: pointer;
      }
      button.badge.clickable {
        background: transparent;
        color: inherit;
        border-width: 1px;
        border-style: solid;
        min-height: 24px;
        min-width: 24px;
        padding: 4px 10px;
        font-size: 12px;
      }
      .badge.kind-url {
        border-color: var(--vscode-textLink-foreground);
      }
      .badge.kind-file {
        border-color: var(--vscode-charts-green);
      }
      .text-link-button {
        border: none;
        background: transparent;
        color: var(--vscode-textLink-foreground);
        min-height: 24px;
        padding: 2px var(--space-1);
        border-radius: var(--radius-1);
        text-align: left;
        text-decoration: underline;
        font: inherit;
        cursor: pointer;
      }
      .text-link-button:hover {
        color: var(--vscode-textLink-activeForeground);
      }
      .text-link-button:focus-visible,
      input:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      .timeline-link-button {
        align-self: flex-start;
      }
      .timeline-row-heading {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1);
      }
      .timeline-row-heading > * {
        min-width: 0;
      }
      .timeline-label {
        font-weight: 600;
      }
      .evidence-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .evidence-group {
        list-style: none;
        margin-bottom: var(--space-2);
      }
      .evidence-group:last-child {
        margin-bottom: 0;
      }
      .evidence-group-heading {
        display: block;
        margin-bottom: var(--space-2);
      }
      .evidence-sublist {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .evidence-item {
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-2);
        padding: var(--space-2);
        margin-bottom: var(--space-2);
        background: var(--vscode-editor-background);
      }
      .evidence-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .evidence-row > * {
        min-width: 0;
      }
      .evidence-link-button,
      .evidence-label {
        font-weight: 600;
      }
      .evidence-meta {
        margin-top: var(--space-1);
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        font-size: 12px;
      }
      .evidence-affordance {
        border: 1px solid var(--vscode-widget-border);
        border-radius: 999px;
        padding: 1px var(--space-2);
        font-size: 11px;
        white-space: nowrap;
      }
      .evidence-affordance-clickable {
        border-color: var(--vscode-textLink-foreground);
        color: var(--vscode-textLink-foreground);
      }
      .evidence-affordance-static {
        color: var(--surface-muted);
      }
      .evidence-kind {
        color: var(--vscode-descriptionForeground);
      }
      .evidence-target {
        color: var(--vscode-descriptionForeground);
        overflow-wrap: anywhere;
      }
      .extra-evidence {
        display: none;
      }
      .evidence-list.show-more .extra-evidence {
        display: block;
      }
      details summary {
        cursor: pointer;
      }
      .card > details[data-panel-section] > summary {
        list-style: none;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 24px;
      }
      .card > details[data-panel-section] > summary::before {
        content: '▸';
        color: var(--surface-muted);
        flex: 0 0 auto;
        font-size: 12px;
        line-height: 1;
        transition: transform var(--motion-quick) ease;
      }
      .card > details[data-panel-section] > summary::-webkit-details-marker {
        display: none;
      }
      .card > details[data-panel-section][open] > summary::before {
        transform: rotate(90deg);
      }
      .panel-disclosure-summary {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .card > details[data-panel-section][data-panel-emphasis-level='elevated'] > summary {
        border-left: 2px solid var(--vscode-textLink-foreground);
        padding-left: var(--space-1);
      }
      .card > details[data-panel-section][data-panel-emphasis-level='critical'] > summary {
        border-left: 2px solid var(--vscode-errorForeground);
        padding-left: var(--space-1);
      }
      .panel-emphasis-badge {
        margin-left: auto;
        font-size: 11px;
        padding: 1px var(--space-2);
      }
      .panel-emphasis-elevated {
        border-color: var(--vscode-textLink-foreground);
      }
      .panel-emphasis-critical {
        border-color: var(--vscode-errorForeground);
        color: var(--vscode-errorForeground);
      }
      .section-heading {
        font-weight: 700;
        font-size: 1.1em;
        line-height: 1.3;
      }
      .section-heading-inline {
        font-weight: 700;
      }
      .panel-section-body {
        margin-top: var(--space-2);
      }
      .more-context-stack > .card {
        margin-bottom: var(--space-2);
      }
      .more-context-stack > .card:last-child {
        margin-bottom: 0;
      }
      .show-more-btn {
        margin-top: var(--space-2);
      }
      .muted {
        color: var(--surface-muted);
      }
      .resume-path-list {
        margin-top: var(--space-2);
      }
      .resume-path-item {
        margin-bottom: var(--space-2);
      }
      .resume-path-toggle {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
        font-weight: 600;
      }
      .resume-path-toggle input[type='checkbox'] {
        width: 14px;
        height: 14px;
      }
      .resume-path-detail {
        margin: 4px 0 0 22px;
        font-size: 12px;
      }
      .blocker-disabled-reason {
        margin-top: var(--space-2);
      }
      .restore-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--space-2);
      }
      button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: var(--radius-2);
        min-height: 24px;
        padding: var(--space-2) var(--space-3);
      }
      button:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      summary:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      button.secondary {
        background: transparent;
        color: var(--vscode-editor-foreground);
        border-color: var(--vscode-widget-border);
      }
      .restore-grid button {
        text-align: left;
        cursor: pointer;
      }
      .restore-grid button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .restore-note {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        margin-top: 8px;
      }
      .note-actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .note-actions button {
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
      }
      .timeline-group ul {
        margin-top: 0;
      }
      .timeline-group li {
        display: grid;
        grid-template-columns: 70px 1fr;
        gap: 8px;
        margin-bottom: 6px;
      }
      .timeline-time {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        padding-top: 2px;
      }
      .timeline-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .timeline-detail {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .quick-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--space-2);
      }
      .quick-actions button {
        min-width: 0;
        width: 100%;
      }
      .shortcut-help {
        margin-top: var(--space-2);
      }
      kbd {
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-1);
        padding: 0 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-size: 11px;
      }
      .action-group + .action-group {
        margin-top: var(--space-2);
      }
      .action-group h4,
      .action-group h5 {
        margin: 0 0 var(--space-2) 0;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--surface-muted);
      }
      .companion-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-areas:
          'now next'
          'blocked restore';
        gap: var(--space-3);
      }
      .companion-block[data-companion-section='now'] {
        grid-area: now;
      }
      .companion-block[data-companion-section='next'] {
        grid-area: next;
      }
      .companion-block[data-companion-section='blocked'] {
        grid-area: blocked;
      }
      .companion-block[data-companion-section='restore'] {
        grid-area: restore;
      }
      .companion-block {
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-3);
        padding: var(--space-3);
        background: var(--vscode-editor-background);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .companion-block h4 {
        margin-top: 0;
        margin-bottom: 6px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--surface-muted);
      }
      .companion-primary {
        margin: 0 0 8px 0;
        font-weight: 700;
        line-height: 1.4;
        max-inline-size: 72ch;
      }
      .state-caption {
        margin: 0 0 var(--space-1) 0;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .state-safe,
      .state-clear {
        color: var(--vscode-testing-iconPassed);
      }
      .state-advisory {
        color: var(--vscode-testing-iconQueued);
      }
      .state-blocked {
        color: var(--vscode-testing-iconFailed);
      }
      .slot-token {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--vscode-widget-border);
        border-radius: 999px;
        min-height: 18px;
        padding: 0 var(--space-1);
        font-size: 10px;
        letter-spacing: 0.05em;
        font-weight: 700;
        text-transform: uppercase;
        transition:
          border-color var(--motion-soft) ease,
          background-color var(--motion-soft) ease,
          color var(--motion-soft) ease;
      }
      .slot-token-primary {
        border-color: var(--vscode-testing-iconPassed);
      }
      .slot-token-advisory {
        border-color: var(--vscode-testing-iconQueued);
      }
      .slot-token-suppressed {
        border-color: var(--surface-muted);
        color: var(--surface-muted);
      }
      .companion-kicker {
        margin: 0;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--surface-muted);
      }
      .companion-meta {
        margin: 0;
        color: var(--surface-muted);
        max-inline-size: 72ch;
      }
      .intent-editor {
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-2);
        padding: var(--space-2);
      }
      .intent-editor-row {
        margin-top: 6px;
      }
      .intent-editor input[type='text'] {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
      }
      .intent-editor-actions {
        display: flex;
        gap: var(--space-2);
        margin-top: var(--space-2);
        flex-wrap: wrap;
      }
      .compact-list {
        margin: 0 0 10px 0;
        padding-left: 18px;
      }
      .companion-restore-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--space-1);
      }
      .companion-restore-grid button {
        text-align: left;
      }
      .trust-row {
        margin-bottom: var(--space-2);
      }
      .trust-key {
        font-weight: 600;
      }
      .recap-card .recap-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
      }
      .recap-card h4 {
        margin-top: 0;
      }
      .details-markdown p,
      .details-markdown li {
        max-inline-size: 72ch;
      }
      @media (min-width: 1100px) {
        .companion-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          grid-template-areas: 'now next blocked restore';
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .card > details[data-panel-section] > summary::before,
        .slot-token {
          transition: none;
        }
      }
      @media (max-width: 700px) {
        body {
          padding: 10px;
        }
        .companion-grid {
          grid-template-columns: 1fr;
          grid-template-areas:
            'now'
            'next'
            'blocked'
            'restore';
        }
        .restore-grid,
        .companion-restore-grid,
        .recap-card .recap-grid,
        .quick-actions {
          grid-template-columns: 1fr;
        }
        .timeline-group li {
          grid-template-columns: 56px 1fr;
        }
      }
      @media (forced-colors: active) {
        button,
        .badge,
        .badge.kind-url,
        .badge.kind-file,
        button.badge.clickable.kind-url,
        button.badge.clickable.kind-file,
        .panel-emphasis-badge,
        .evidence-affordance,
        .evidence-item,
        .text-link-button,
        .slot-token {
          forced-color-adjust: auto;
          border-color: ButtonText;
        }
        .card > details[data-panel-section] > summary::before {
          color: ButtonText;
        }
        .card > details[data-panel-section][data-panel-emphasis-level='elevated'] > summary,
        .card > details[data-panel-section][data-panel-emphasis-level='critical'] > summary {
          border-left-color: ButtonText;
        }
        .state-safe,
        .state-clear,
        .state-advisory,
        .state-blocked,
        .slot-token {
          color: ButtonText;
        }
        button:focus-visible,
        summary:focus-visible,
        .text-link-button:focus-visible {
          outline: 2px solid Highlight;
          outline-offset: 2px;
        }
      }
`;
