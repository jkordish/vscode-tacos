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
        --radius-1: 4px;
        --radius-2: 6px;
        --radius-3: 6px;
        --radius-4: 8px;
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
        padding: 0;
      }
      main {
        display: block;
      }
      /* ── Compact sticky page header ─────────────────────────────────── */
      .page-header {
        position: sticky;
        top: 0;
        z-index: 11;
        background: var(--vscode-sideBar-background, var(--vscode-editor-background));
        border-bottom: 1px solid var(--surface-border);
        padding: var(--space-2) var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .header-title-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        min-width: 0;
      }
      .header-intent {
        font-size: var(--vscode-font-size);
        font-weight: 600;
        color: var(--surface-strong);
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin: 0;
        padding: 0;
      }
      .header-chip {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: var(--surface-muted);
        background: var(--vscode-badge-background, rgba(128,128,128,0.15));
        border-radius: var(--radius-1);
        padding: 1px var(--space-2);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .header-chip-secondary {
        background: transparent;
        border: 1px solid var(--surface-border);
      }
      /* ── Provenance badge row ───────────────────────────────────────── */
      .header-provenance {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .badge-local {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: var(--vscode-testing-iconPassed, #4caf50);
        background: transparent;
        border: 1px solid var(--vscode-testing-iconPassed, #4caf50);
        border-radius: var(--radius-1);
        padding: 1px var(--space-2);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .badge-ai {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: var(--vscode-editorWarning-foreground, #e8a030);
        background: transparent;
        border: 1px solid var(--vscode-editorWarning-foreground, #e8a030);
        border-radius: var(--radius-1);
        padding: 1px var(--space-2);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .provenance-preview-link {
        font-size: 10px;
        font-weight: 400;
        color: var(--vscode-textLink-foreground, var(--accent));
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        flex-shrink: 0;
      }
      .provenance-preview-link:hover {
        color: var(--vscode-textLink-activeForeground, var(--accent));
      }
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        align-items: center;
      }
      .header-actions button {
        font-size: 11px;
        min-height: 22px;
        padding: 1px var(--space-2);
      }
      /* ── Tab nav ────────────────────────────────────────────────────── */
      .page-tabs {
        position: sticky;
        top: var(--page-header-height, 0px);
        z-index: 10;
        display: flex;
        gap: 2px;
        background: var(--vscode-sideBar-background, var(--vscode-editor-background));
        padding: var(--space-2) var(--space-2) 0;
        border-bottom: 1px solid var(--surface-border);
        flex-wrap: wrap;
      }
      .page-tab {
        border: 1px solid transparent;
        border-bottom: 1px solid transparent;
        border-radius: var(--radius-1) var(--radius-1) 0 0;
        background: transparent;
        color: var(--surface-muted);
        min-height: 28px;
        padding: 3px var(--space-3);
        cursor: pointer;
        font-size: var(--vscode-font-size);
        font-family: var(--vscode-font-family);
        transition: color var(--motion-quick) ease, background var(--motion-quick) ease;
      }
      .page-tab:hover {
        color: var(--surface-strong);
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
      }
      .page-tab[aria-selected='true'] {
        color: var(--surface-strong);
        background: var(--vscode-editor-background);
        border-color: var(--surface-border);
        border-bottom-color: var(--vscode-editor-background);
        font-weight: 600;
      }
      .page-tab:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      /* ── Tab panels ─────────────────────────────────────────────────── */
      .tab-panels {
        padding: var(--space-2) var(--space-3) var(--space-3);
      }
      .tab-panel[hidden] {
        display: none;
      }
      /* ── Card density tightened ~20% ────────────────────────────────── */
      .card {
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-4);
        padding: var(--space-2) var(--space-3);
        margin-bottom: var(--space-2);
        background: var(--surface-bg);
      }
      .card:last-child {
        margin-bottom: 0;
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
      /* ── Typography ─────────────────────────────────────────────────── */
      ul {
        padding-left: 18px;
      }
      h3 {
        margin: 0 0 var(--space-2) 0;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        letter-spacing: 0.06em;
        color: var(--surface-muted);
        text-transform: uppercase;
      }
      h4 {
        margin: 0 0 var(--space-2) 0;
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
        font-size: 12px;
      }
      .status-label {
        font-weight: 600;
        font-size: var(--vscode-font-size);
        color: var(--surface-strong);
      }
      .status-detail {
        margin-top: var(--space-1);
      }
      .status-actions {
        margin-top: var(--space-3);
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .step-evidence {
        margin-top: var(--space-2);
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
      }
      .step-actions {
        margin-top: var(--space-2);
      }
      .step-action {
        min-height: 24px;
        padding: 4px 10px;
        font-size: 12px;
      }
      .step-advisory {
        margin-top: var(--space-1);
        font-size: 12px;
        color: var(--surface-muted);
      }
      /* ── Badges ────────────────────────────────────────────────────── */
      .badge {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-1);
        padding: 1px var(--space-2);
        font-size: 11px;
        text-decoration: none;
        color: inherit;
        line-height: 1.4;
        white-space: nowrap;
      }
      .badge.clickable {
        cursor: pointer;
      }
      button.badge.clickable {
        background: transparent;
        color: inherit;
        border-width: 1px;
        border-style: solid;
        min-height: 22px;
        min-width: 22px;
        padding: 2px 8px;
        font-size: 11px;
      }
      .badge.kind-url {
        border-color: var(--vscode-textLink-foreground);
        color: var(--vscode-textLink-foreground);
      }
      .badge.kind-file {
        border-color: var(--vscode-charts-green);
        color: var(--vscode-charts-green);
      }
      /* ── Buttons ───────────────────────────────────────────────────── */
      button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: var(--radius-2);
        min-height: 24px;
        padding: var(--space-1) var(--space-3);
        cursor: pointer;
        font-size: var(--vscode-font-size);
        font-family: var(--vscode-font-family);
        transition: opacity var(--motion-quick) ease;
      }
      button:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      button.secondary {
        background: transparent;
        color: var(--vscode-foreground);
        border-color: var(--vscode-button-secondaryBorder, var(--vscode-widget-border));
      }
      button.secondary:hover {
        background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.1));
      }
      button:disabled,
      button[aria-disabled='true'] {
        opacity: 0.45;
        cursor: default;
        pointer-events: none;
      }
      .text-link-button {
        border: none;
        background: transparent;
        color: var(--vscode-textLink-foreground);
        min-height: 22px;
        padding: 1px var(--space-1);
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
      summary:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      /* ── Disclosure (collapsible sections) ──────────────────────────── */
      details summary {
        cursor: pointer;
        list-style: none;
      }
      details summary::-webkit-details-marker {
        display: none;
      }
      .card > details[data-panel-section] > summary {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 24px;
        border-radius: var(--radius-1);
        padding: 2px 0;
      }
      .card > details[data-panel-section] > summary::before,
      details > summary.panel-disclosure-summary::before {
        content: '';
        display: inline-block;
        width: 0;
        height: 0;
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
        border-left: 6px solid var(--surface-muted);
        flex: 0 0 auto;
        margin-right: 2px;
        transition: transform var(--motion-quick) ease;
      }
      .card > details[data-panel-section][open] > summary::before,
      details[open] > summary.panel-disclosure-summary::before {
        transform: rotate(90deg);
      }
      .panel-disclosure-summary {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
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
        color: var(--vscode-textLink-foreground);
      }
      .panel-emphasis-critical {
        border-color: var(--vscode-errorForeground);
        color: var(--vscode-errorForeground);
      }
      .section-heading {
        font-weight: 600;
        font-size: var(--vscode-font-size);
        line-height: 1.3;
        color: var(--surface-strong);
      }
      .section-heading-inline {
        font-weight: 600;
      }
      .panel-section-body {
        margin-top: var(--space-3);
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
      /* ── Primary content text ───────────────────────────────────────── */
      .companion-primary {
        margin: 0 0 var(--space-2) 0;
        font-weight: 600;
        font-size: calc(var(--vscode-font-size) + 1px);
        line-height: 1.45;
        max-inline-size: 72ch;
        color: var(--surface-strong);
      }
      .companion-primary:last-child {
        margin-bottom: 0;
      }
      /* ── Timeline ───────────────────────────────────────────────────── */
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
      .timeline-group ul {
        margin-top: 0;
      }
      .timeline-group li {
        display: grid;
        grid-template-columns: 64px 1fr;
        gap: var(--space-2);
        margin-bottom: var(--space-1);
      }
      .timeline-time {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        padding-top: 3px;
        white-space: nowrap;
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
      /* ── Evidence ───────────────────────────────────────────────────── */
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
      .extra-evidence-group {
        display: none;
      }
      .evidence-list.show-more .extra-evidence-group {
        display: block;
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
        margin-bottom: var(--space-1);
        background: var(--vscode-editor-background);
      }
      .evidence-item:last-child {
        margin-bottom: 0;
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
        font-size: 11px;
        color: var(--surface-muted);
      }
      .evidence-affordance {
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-1);
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
        border-color: transparent;
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
      /* ── Quick Actions card ─────────────────────────────────────────── */
      .quick-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: var(--space-2);
      }
      .quick-actions button {
        min-width: 0;
        width: 100%;
        text-align: left;
      }
      .shortcut-help {
        margin-top: var(--space-3);
        border-top: 1px solid var(--surface-border);
        padding-top: var(--space-2);
      }
      kbd {
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-1);
        padding: 0 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
        font-size: 11px;
        background: var(--vscode-editor-background);
      }
      .action-group + .action-group {
        margin-top: var(--space-2);
      }
      .action-group h4,
      .action-group h5 {
        margin: 0 0 var(--space-2) 0;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--surface-muted);
      }
      /* ── Companion grid (Now / Next / Blocked / Restore) ────────────── */
      .companion-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-areas:
          'now next'
          'blocked restore';
        gap: var(--space-2);
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
        padding: var(--space-2) var(--space-3);
        background: var(--surface-bg);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }
      .companion-block h4 {
        margin: 0;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--surface-muted);
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
        border-radius: var(--radius-1);
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
        color: var(--vscode-testing-iconPassed);
      }
      .slot-token-advisory {
        border-color: var(--vscode-testing-iconQueued);
        color: var(--vscode-testing-iconQueued);
      }
      .slot-token-suppressed {
        border-color: var(--surface-muted);
        color: var(--surface-muted);
      }
      .companion-kicker {
        margin: 0;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--surface-muted);
      }
      .companion-meta {
        margin: 0;
        color: var(--surface-muted);
        font-size: 12px;
        max-inline-size: 72ch;
      }
      /* Reset browser-default paragraph margins inside tight grid cells
         without overriding explicit spacing on specialized paragraph styles */
      .companion-block p:not(.state-caption):not(.companion-primary) {
        margin: 0;
      }
      /* Tighter action row and list indent inside companion grid cells */
      .companion-block .status-actions {
        margin-top: var(--space-2);
      }
      .companion-block .compact-list {
        padding-left: 12px;
      }
      /* ── Intent editor ──────────────────────────────────────────────── */
      .intent-editor {
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-2);
        padding: var(--space-2) var(--space-3);
        background: var(--vscode-editor-background);
      }
      .intent-editor-row {
        margin-top: var(--space-1);
      }
      .intent-editor input[type='text'] {
        width: 100%;
        box-sizing: border-box;
        padding: 5px var(--space-2);
        border-radius: var(--radius-1);
        border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }
      .intent-editor-actions {
        display: flex;
        gap: var(--space-2);
        margin-top: var(--space-2);
        flex-wrap: wrap;
      }
      .compact-list {
        margin: 0 0 var(--space-2) 0;
        padding-left: 16px;
        line-height: 1.6;
      }
      .compact-list:last-child {
        margin-bottom: 0;
      }
      .compact-list li {
        margin-bottom: 2px;
      }
      .companion-restore-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: var(--space-1);
      }
      .companion-restore-grid button {
        text-align: left;
        font-size: 12px;
      }
      /* ── Trust Center ───────────────────────────────────────────────── */
      .trust-details-more {
        margin: var(--space-2) 0;
      }
      .trust-details-summary {
        font-size: 12px;
        color: var(--surface-muted);
        cursor: pointer;
        padding: 2px 0;
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .trust-details-more[open] .trust-details-summary {
        margin-bottom: var(--space-1);
      }
      .trust-row {
        margin-bottom: var(--space-1);
        font-size: 12px;
        line-height: 1.4;
      }
      .trust-row:last-of-type {
        margin-bottom: var(--space-2);
      }
      .trust-key {
        font-weight: 600;
        color: var(--surface-strong);
      }
      /* ── Session Recap ──────────────────────────────────────────────── */
      .recap-card .recap-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--space-3);
      }
      .recap-card h4 {
        margin-top: 0;
      }
      .recap-section-heading {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: var(--space-2);
        font-weight: 600;
      }
      .recap-section-done {
        color: var(--vscode-testing-iconPassed);
      }
      .recap-section-pending {
        color: var(--vscode-testing-iconQueued, var(--surface-muted));
      }
      .details-markdown p,
      .details-markdown li {
        max-inline-size: 72ch;
      }
      /* ── Attention card (Welcome back / low-confidence) ─────────────── */
      .card-attention {
        border-left: 3px solid var(--vscode-testing-iconQueued, #cca700);
        background: color-mix(in srgb, var(--vscode-testing-iconQueued, #cca700) 4%, var(--surface-bg));
      }
      /* ── Mental Load card — dominant, demands attention ─────────────── */
      .card-mental-load {
        border-left: 3px solid var(--vscode-errorForeground, #f14c4c);
        background: color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 4%, var(--surface-bg));
      }
      /* ── Meta / supplemental text ───────────────────────────────────── */
      .card-meta {
        font-size: 12px;
        margin: var(--space-1) 0 0;
        color: var(--surface-muted);
      }
      .card-meta-label {
        font-weight: 600;
        color: var(--surface-strong);
      }
      .card-stale-label {
        font-size: 12px;
        font-style: italic;
        color: var(--vscode-testing-iconQueued, var(--surface-muted));
      }
      /* ── Badge variants ─────────────────────────────────────────────── */
      .badge-done {
        border-color: var(--vscode-testing-iconPassed);
        color: var(--vscode-testing-iconPassed);
      }
      .badge-attention {
        border-color: var(--vscode-testing-iconQueued, #cca700);
        color: var(--vscode-testing-iconQueued, var(--surface-muted));
      }
      .badge-confidence {
        border-color: var(--accent);
        color: var(--accent);
      }
      .badge-freshness {
        border-color: var(--vscode-testing-iconPassed);
        color: var(--vscode-testing-iconPassed);
      }
      /* ── Cognitive debrief count list ───────────────────────────────── */
      .debrief-list {
        padding-left: 0;
        list-style: none;
      }
      .debrief-list li {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin-bottom: var(--space-1);
        font-size: 13px;
      }
      .debrief-count {
        font-size: 1.15em;
        font-weight: 700;
        min-width: 1.8ch;
        text-align: right;
        color: var(--vscode-errorForeground, #f14c4c);
        font-variant-numeric: tabular-nums;
      }
      /* ── Resume path ────────────────────────────────────────────────── */
      .resume-path-list {
        margin-top: var(--space-2);
      }
      .resume-path-item {
        margin-bottom: var(--space-2);
      }
      .resume-path-item:last-child {
        margin-bottom: 0;
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
        flex: 0 0 auto;
      }
      .resume-path-detail {
        margin: 3px 0 0 22px;
        font-size: 12px;
        color: var(--surface-muted);
      }
      .resume-path-item-done .resume-path-toggle span {
        text-decoration: line-through;
        color: var(--surface-muted);
      }
      .resume-path-item-done .resume-path-detail {
        text-decoration: line-through;
      }
      /* ── Blocker / disabled notes ───────────────────────────────────── */
      .blocker-disabled-reason {
        margin-top: var(--space-2);
      }
      .restore-note {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        margin-top: var(--space-1);
        margin-bottom: var(--space-2);
      }
      .restricted-mode-note {
        font-size: 12px;
        margin-bottom: var(--space-2);
        padding: var(--space-1) var(--space-2);
        border-left: 2px solid var(--vscode-testing-iconQueued, #cca700);
        color: var(--vscode-editorWarning-foreground, var(--surface-muted));
        background: transparent;
      }
      /* ── Restore Pack ───────────────────────────────────────────────── */
      .restore-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: var(--space-2);
      }
      .restore-grid button {
        text-align: left;
        cursor: pointer;
        font-size: 12px;
      }
      /* ── Notes ──────────────────────────────────────────────────────── */
      .note-actions {
        margin-top: var(--space-2);
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .note-actions button {
        padding: 4px 10px;
        font-size: 12px;
      }
      /* ── Status autosummary ─────────────────────────────────────────── */
      .status-autosummary-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }
      .status-autosummary-detail {
        font-size: 12px;
        color: var(--surface-muted);
      }
      /* ── Keyboard shortcut help ─────────────────────────────────────── */
      .shortcut-help-summary {
        font-size: 12px;
        cursor: pointer;
        color: var(--surface-muted);
        padding: 2px 0;
      }
      /* ── Responsive: wide sidebar / multi-column ────────────────────── */
      @media (min-width: 900px) {
        .companion-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          grid-template-areas: 'now next blocked restore';
        }
      }
      /* ── Responsive: narrow sidebar ─────────────────────────────────── */
      @media (max-width: 500px) {
        body {
          padding: var(--space-1) var(--space-2) var(--space-2);
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
      /* ── Resume Cockpit card ────────────────────────────────────────── */
      .cockpit-card {
        padding: var(--space-2) var(--space-3);
      }
      .cockpit-field-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-bottom: var(--space-2);
      }
      .cockpit-field-row:last-child {
        margin-bottom: 0;
      }
      .cockpit-field-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--surface-muted);
      }
      .cockpit-blocker-label {
        color: var(--vscode-testing-iconQueued, #cca700);
      }
      .cockpit-input {
        width: 100%;
        box-sizing: border-box;
        padding: 5px var(--space-2);
        border-radius: var(--radius-1);
        border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }
      .cockpit-input:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 1px;
      }
      .cockpit-blocker-details {
        margin-bottom: var(--space-2);
      }
      .cockpit-blocker-summary {
        font-size: 12px;
      }
      .cockpit-blocker-body {
        margin-top: var(--space-1);
        margin-left: var(--space-3);
        font-size: 12px;
        color: var(--vscode-testing-iconQueued, #cca700);
        overflow-wrap: anywhere;
      }
      .cockpit-anchors {
        margin-top: var(--space-2);
        margin-bottom: var(--space-2);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .cockpit-anchor-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }
      .cockpit-anchor-list li {
        margin: 0;
      }
      .cockpit-anchor-btn {
        text-decoration: none;
      }
      .cockpit-action-row {
        margin-top: var(--space-2);
      }
      /* ── Compact density mode ───────────────────────────────────────── */
      .tacos-root[data-density='compact'] {
        --space-1: 2px;
        --space-2: 5px;
        --space-3: 8px;
        --space-4: 12px;
      }
      .tacos-root[data-density='compact'] .card {
        padding: var(--space-1) var(--space-2);
        margin-bottom: var(--space-1);
      }
      .tacos-root[data-density='compact'] .cockpit-input {
        padding: 3px var(--space-2);
      }
      /* ── Evidence group mode bar ────────────────────────────────────── */
      .evidence-group-mode-bar {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin-bottom: var(--space-2);
      }
      .evidence-group-btn {
        background: transparent;
        color: var(--surface-muted);
        border: 1px solid var(--vscode-widget-border);
        border-radius: var(--radius-1);
        min-height: 22px;
        padding: 1px var(--space-2);
        font-size: 11px;
        font-family: var(--vscode-font-family);
        cursor: pointer;
        transition: background var(--motion-quick) ease, color var(--motion-quick) ease;
      }
      .evidence-group-btn:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
        color: var(--surface-strong);
      }
      .evidence-group-btn-active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-background);
        font-weight: 600;
      }
      .evidence-group-btn-active:hover {
        background: var(--vscode-button-hoverBackground, var(--vscode-button-background));
        color: var(--vscode-button-foreground);
      }
      /* ── Evidence recent anchor row ─────────────────────────────────── */
      .evidence-recent-anchor {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .evidence-anchor-time {
        font-size: 11px;
        color: var(--surface-muted);
        white-space: nowrap;
        min-width: 52px;
        padding-top: 3px;
      }
      .evidence-kind-inline {
        color: var(--surface-muted);
        font-size: 11px;
      }
      /* ── Evidence file groups (By file view) ────────────────────────── */
      .evidence-file-group {
        list-style: none;
        margin-bottom: var(--space-2);
      }
      .evidence-file-group:last-child {
        margin-bottom: 0;
      }
      .evidence-file-group-summary {
        font-size: 12px;
        font-weight: 600;
        color: var(--surface-strong);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: 2px 0;
      }
      .evidence-file-group-label {
        overflow-wrap: anywhere;
      }
      /* ── Evidence action groups (By action view) ────────────────────── */
      .evidence-action-group {
        list-style: none;
        margin-bottom: var(--space-2);
      }
      .evidence-action-group:last-child {
        margin-bottom: 0;
      }
      .evidence-action-group-summary {
        font-size: 12px;
        font-weight: 600;
        color: var(--surface-strong);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: 2px 0;
      }
      .evidence-action-group-label {
        overflow-wrap: anywhere;
      }
      /* ── Evidence time bucket headings ──────────────────────────────── */
      .evidence-time-bucket {
        list-style: none;
        margin-bottom: var(--space-2);
      }
      .evidence-time-bucket:last-child {
        margin-bottom: 0;
      }
      .evidence-time-bucket-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--surface-muted);
        margin: 0 0 var(--space-1) 0;
      }
      /* ── Expand full timeline affordance ────────────────────────────── */
      .evidence-expand-full {
        margin-top: var(--space-2);
        text-align: right;
      }
      .evidence-expand-btn {
        font-size: 11px;
        color: var(--surface-muted);
      }
      .evidence-expand-btn:hover {
        color: var(--vscode-textLink-activeForeground);
      }
      /* ── Reduced motion ─────────────────────────────────────────────── */
      @media (prefers-reduced-motion: reduce) {
        .card > details[data-panel-section] > summary::before,
        details > summary.panel-disclosure-summary::before,
        .slot-token {
          transition: none;
        }
      }
      /* ── Forced colors (Windows High Contrast) ──────────────────────── */
      @media (forced-colors: active) {
        button,
        /* === Evidence group mode bar (forced-colors) === */
        .evidence-group-btn {
          forced-color-adjust: auto;
          border-color: ButtonText;
        }
        .evidence-group-btn-active {
          background: Highlight;
          color: HighlightText;
        }
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
        .card > details[data-panel-section] > summary::before,
        details > summary.panel-disclosure-summary::before {
          border-left-color: ButtonText;
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
        .card-attention,
        .card-mental-load {
          background: Canvas;
          border-left-color: ButtonText;
        }
        button:focus-visible,
        summary:focus-visible,
        .text-link-button:focus-visible {
          outline: 2px solid Highlight;
          outline-offset: 2px;
        }
      }
`;
