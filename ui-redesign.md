Yes. Move to top-level tabs.

That is the right fix, not just a nicer-looking tweak. The current UI is trying to be both a dashboard and a document, and that guarantees vertical sprawl inside a VS Code webview. In a side pane, that gets annoying fast. Humans, tragically, only get one viewport at a time.

I couldn’t reliably inspect `demo.png` through the connector here, so this is grounded mostly in the current webview code and repo structure. The structural diagnosis is still clear from the code in [panelCards.ts](https://github.com/jkordish/vscode-tacos/blob/main/src/webview/panelCards.ts), [panelFragments.ts](https://github.com/jkordish/vscode-tacos/blob/main/src/webview/panelFragments.ts), and [panelStyles.ts](https://github.com/jkordish/vscode-tacos/blob/main/src/webview/panelStyles.ts).

## My read

Your current design seems to be:

- one long stacked surface
- multiple semantically different cards
- collapsible/disclosure-style detail inside that same flow
- generous spacing and comfortable card padding

That works for readability, but not for “fit the important stuff in one window.”

Dropdowns and collapsibles help a little, but they do **not** solve the core problem. They still preserve the mental model of “one long page.” Tabs fix the actual issue because they turn the view into **modes** instead of a document.

## Strong recommendation

Use **4 tabs max** across the top:

### 1. Overview

Keep only the high-signal stuff:

- current task / task title
- freshness / confidence / status
- short summary
- primary actions

This should be the “open panel, understand state in 3 seconds” tab.

### 2. Resume

Everything directly tied to getting back into flow:

- task state
- checkpoint
- resume brief
- restore pack / next-step cues

This is probably the real center of gravity for the product.

### 3. Evidence

All the supporting detail:

- files
- timeline
- evidence trail
- details / rationale / references

This content is important, but it should stop bullying the primary workflow.

### 4. Debrief

Keep the daily cognitive debrief here, isolated from the real-time resume path.

That separation matters. Debrief is reflective. Resume is operational. Mixing them in one scroll stack makes the UI feel more complicated than it is.

---

## What I would demote

A few things should stop being full-height cards.

### Quick Actions

Make this a compact toolbar row near the header, not a standalone big card.

### Trust / privacy / model / provenance info

Important, yes. But unless the user is actively auditing behavior, it should be a compact badge row, info popover, or small expandable strip. Not prime real estate every time.

### Secondary explanatory text

A lot of extension UIs die because every section insists on narrating itself. Keep the prose brutally short.

## Layout shape I’d use

### Sticky compact header

At the top:

- task title
- tiny status chips
- one-line subtitle
- 1 to 3 primary actions

Then directly below that:

### Sticky tab bar

Always visible while scrolling within the active tab.

That gives you constant orientation without burning much space.

### Active tab panel only

Do not render everything in one vertical flow and just visually “separate” it. Actually treat tabs like tab panels.

## Density changes I’d make immediately

In [panelStyles.ts](https://github.com/jkordish/vscode-tacos/blob/main/src/webview/panelStyles.ts):

- reduce card padding by about 20 to 30%
- reduce vertical gaps between sections
- tighten headings and subhead spacing
- reduce oversized empty states
- make metadata rows denser and single-line where possible
- use smaller helper text and fewer paragraphs

You do not need a radically prettier design. You need a **more disciplined** one.

## What to change in code

This is the nice part: the repo already looks componentized enough that you don’t need to rewrite the cards themselves.

### Keep

- the existing card renderers in [panelCards.ts](https://github.com/jkordish/vscode-tacos/blob/main/src/webview/panelCards.ts)

### Add

- a top-level tab shell in [panelFragments.ts](https://github.com/jkordish/vscode-tacos/blob/main/src/webview/panelFragments.ts)
- tab state handling in the webview script
- tab styles in [panelStyles.ts](https://github.com/jkordish/vscode-tacos/blob/main/src/webview/panelStyles.ts)

### Refactor

Wherever you currently assemble the page body, stop doing “append every card in order.” Instead, bucket cards by tab.

Conceptually:

```ts
const tabs = {
  overview: [
    renderStatusCard(...),
    renderTaskStateCard(...),
    renderQuickActionsCompact(...),
  ],
  resume: [
    renderCheckpointCard(...),
    renderResumePathCard(...),
    renderRestorePackCard?.(...),
  ],
  evidence: [
    renderEvidenceCard(...),
    renderDetailsCard(...),
  ],
  debrief: [
    renderDailyDebriefCard?.(...),
  ],
};
```

Then render:

```html
<header class="page-header">...</header>
<nav class="page-tabs" role="tablist">...</nav>
<section class="tab-panel" data-tab="overview">...</section>
<section class="tab-panel" data-tab="resume" hidden>...</section>
...
```

And in CSS:

```css
.page-tabs {
  position: sticky;
  top: 0;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.page-tab[aria-selected="true"] { ... }
.tab-panel[hidden] { display: none; }
```

## One design trap to avoid

Do **not** replace one bad pattern with another:

- tabs
- inside collapsibles
- inside cards
- inside a scrolling document

That turns the UI into a cursed filing cabinet.

Use tabs for the **first-level split**, then keep each tab mostly flat.

## Best information architecture for your use case

Because this extension is about task resumption, the UI should answer these in order:

1. What was I doing?
2. What matters right now?
3. What should I do next?
4. Where’s the proof if I need it?

Your current stacked-card approach likely answers all four, but not in that order, and not efficiently enough. Tabs would force the product to respect priority.

## My verdict

**High confidence:** tabs are the correct move.
**Medium confidence:** exact density tuning until the screenshot is reviewed more directly.
**Low confidence:** keeping every current card as-is and just rearranging them will be enough. Some cards probably need to be split or demoted.

Most likely best version:

- compact sticky header
- top tabs
- Overview / Resume / Evidence / Debrief
- quick actions in header
- trust/provenance compacted
- tighter spacing everywhere

That gets you much closer to “everything important in one window” without turning the UI into unreadable dashboard sludge.
