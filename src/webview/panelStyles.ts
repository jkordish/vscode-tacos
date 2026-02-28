export const PANEL_WEBVIEW_STYLE = `
      :root {
        --surface-bg: var(--vscode-editorWidget-background);
        --surface-border: var(--vscode-panel-border);
        --surface-muted: var(--vscode-descriptionForeground);
        --surface-strong: var(--vscode-foreground);
        --accent: var(--vscode-focusBorder);
      }
      body {
        color: var(--surface-strong);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        line-height: 1.5;
        padding: 16px;
      }
      .card {
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 14px;
        background: var(--surface-bg);
      }
      ul {
        padding-left: 20px;
      }
      h3 {
        margin-top: 0;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
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
        margin-top: 6px;
      }
      .status-actions {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .step-evidence {
        margin-top: 6px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .step-actions {
        margin-top: 8px;
      }
      .step-action {
        padding: 4px 10px;
        font-size: 12px;
      }
      .step-advisory {
        margin-top: 6px;
        font-size: 12px;
      }
      .badge {
        display: inline-block;
        border: 1px solid var(--vscode-widget-border);
        border-radius: 999px;
        padding: 2px 8px;
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
        padding: 2px 8px;
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
        padding: 0;
        border-radius: 4px;
        text-align: left;
        text-decoration: underline;
        font: inherit;
        cursor: pointer;
      }
      .text-link-button:hover {
        color: var(--vscode-textLink-activeForeground);
      }
      .timeline-link-button {
        align-self: flex-start;
      }
      .timeline-row-heading {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .timeline-label {
        font-weight: 600;
      }
      .evidence-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .evidence-item {
        border: 1px solid var(--vscode-widget-border);
        border-radius: 8px;
        padding: 8px;
        margin-bottom: 8px;
        background: var(--vscode-editor-background);
      }
      .evidence-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .evidence-link-button,
      .evidence-label {
        font-weight: 600;
      }
      .evidence-meta {
        margin-top: 4px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 12px;
      }
      .evidence-affordance {
        border: 1px solid var(--vscode-widget-border);
        border-radius: 999px;
        padding: 1px 8px;
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
      }
      .card > details[data-panel-section] > summary::-webkit-details-marker {
        display: none;
      }
      .card > details[data-panel-section] > summary h3 {
        margin-bottom: 0;
      }
      .panel-section-body {
        margin-top: 10px;
      }
      .show-more-btn {
        margin-top: 8px;
      }
      .muted {
        color: var(--surface-muted);
      }
      .resume-path-list {
        margin-top: 10px;
      }
      .resume-path-item {
        margin-bottom: 8px;
      }
      .resume-path-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
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
        margin-top: 8px;
      }
      .restore-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
      }
      button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 8px;
        padding: 8px 10px;
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
        gap: 8px;
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
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .quick-actions button {
        min-width: 160px;
      }
      .action-group + .action-group {
        margin-top: 10px;
      }
      .action-group h4,
      .action-group h5 {
        margin: 0 0 8px 0;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--surface-muted);
      }
      .companion-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .companion-block {
        border: 1px solid var(--vscode-widget-border);
        border-radius: 10px;
        padding: 12px;
        background: var(--vscode-editor-background);
        display: flex;
        flex-direction: column;
        gap: 8px;
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
      }
      .intent-editor {
        border: 1px solid var(--vscode-widget-border);
        border-radius: 8px;
        padding: 8px;
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
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .compact-list {
        margin: 0 0 10px 0;
        padding-left: 18px;
      }
      .companion-restore-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 6px;
      }
      .companion-restore-grid button {
        text-align: left;
      }
      .trust-row {
        margin-bottom: 8px;
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
      @media (forced-colors: active) {
        button,
        .badge,
        .badge.kind-url,
        .badge.kind-file,
        button.badge.clickable.kind-url,
        button.badge.clickable.kind-file,
        .evidence-affordance,
        .evidence-item,
        .text-link-button {
          forced-color-adjust: auto;
          border-color: ButtonText;
        }
        button:focus-visible,
        summary:focus-visible,
        .text-link-button:focus-visible {
          outline: 2px solid Highlight;
          outline-offset: 2px;
        }
      }
`;
