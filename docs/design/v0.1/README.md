# AirDesign v0.1 design

How v0.1 looks and behaves. Read this index to choose a screen or a rule file. Images in `screens/` are the visual handoff. Behavior and values live in the files below.

Exported from the Brilliant project "airdesign", Screens canvas, on 2026-11-04.

- [Components](components.md): slots, variants, states and where each part is used. Read when drawing or building a visual part.
- [Logic](logic.md): the state machine of each flow and the rules to keep. Read when defining states, transitions or screen rules.
- [Tokens](tokens.md): colors, type, radii, elevation and the signature button. Read when setting a visual value.
- [Copy kit](copy-kit.md) ([json](copy-kit.json)): voice rules, message patterns and every string by key. Read when writing a user-facing string.
- [Backlog](backlog.md): states the strategy promises that have no screen yet. Read before describing a promised state.
- [Reviews](reviews/): the strategy and logic reviews these files were checked against. Read when a screen and a journey disagree.
- [Source](source/README.md): generators that built the canvas screens. Design tooling, not product code. Read when matching a screen's exact structure or values.
- [Landing research](research/2026-11-04-landing-research.md), [concepts](research/2026-11-04-landing-concepts.md) and [MBB slide anatomy](research/mbb-slide-anatomy.md). Read when changing the landing page. Briefs in [research/council](research/council/brief.md) record the review rounds.
- [Strategy, analysis and presentation source guides](research/presentation-guides/README.md). Read when preparing agent playbooks or cookbooks from the supplied Herng Lee PDFs. Includes page references, original visuals and conversion limits.

Strategy boards (journeys, rules, architecture) are in [docs/planning/v0.1](../../planning/v0.1/README.md).

## Screen codes

`S` + area digit + flow digit + `.NN`. `S42.01` is Editor (S40), Agent (S42), screen 01. Areas go in tens; flow 9 in each area holds its errors. Screens in a flow are numbered in the order things happen. Until build starts we renumber freely to keep that order; after that, new screens take the next number and codes are never reused. Screen names read `Code Area / Flow / State`.

All screens are 1470 x 923 (the landing page is taller).

## Screens


### S10 Discover

| Code | Screen | Image |
|---|---|---|
| S11.01 | Discover / Landing / Default | [S11.01-discover-landing-default.png](screens/S11.01-discover-landing-default.png) |
| S12.01 | Discover / Pricing / Default | [S12.01-discover-pricing-default.png](screens/S12.01-discover-pricing-default.png) |

### S20 Access

| Code | Screen | Image |
|---|---|---|
| S21.01 | Access / Sign in / Default | [S21.01-access-sign-in-default.png](screens/S21.01-access-sign-in-default.png) |
| S22.01 | Access / Verify email / Check inbox | [S22.01-access-verify-email-check-inbox.png](screens/S22.01-access-verify-email-check-inbox.png) |
| S29.01 | Access / Errors / Link expired | [S29.01-access-errors-link-expired.png](screens/S29.01-access-errors-link-expired.png) |

### S30 Decks

| Code | Screen | Image |
|---|---|---|
| S31.01 | Decks / Browse / Empty, first visit | [S31.01-decks-browse-empty-first-visit.png](screens/S31.01-decks-browse-empty-first-visit.png) |
| S31.02 | Decks / Browse / Recents, grid | [S31.02-decks-browse-recents-grid.png](screens/S31.02-decks-browse-recents-grid.png) |
| S31.03 | Decks / Browse / Recents, list | [S31.03-decks-browse-recents-list.png](screens/S31.03-decks-browse-recents-list.png) |
| S31.04 | Decks / Browse / All decks, grid | [S31.04-decks-browse-all-decks-grid.png](screens/S31.04-decks-browse-all-decks-grid.png) |
| S31.05 | Decks / Browse / All decks, list | [S31.05-decks-browse-all-decks-list.png](screens/S31.05-decks-browse-all-decks-list.png) |
| S32.01 | Decks / New deck / Menu open | [S32.01-decks-new-deck-menu-open.png](screens/S32.01-decks-new-deck-menu-open.png) |
| S32.02 | Decks / New deck / Importing | [S32.02-decks-new-deck-importing.png](screens/S32.02-decks-new-deck-importing.png) |
| S32.03 | Decks / New deck / Import failed | [S32.03-decks-new-deck-import-failed.png](screens/S32.03-decks-new-deck-import-failed.png) |
| S33.01 | Decks / Trash / Deck moved, toast | [S33.01-decks-trash-deck-moved-toast.png](screens/S33.01-decks-trash-deck-moved-toast.png) |
| S33.02 | Decks / Trash / List | [S33.02-decks-trash-list.png](screens/S33.02-decks-trash-list.png) |
| S33.03 | Decks / Trash / Empty trash, confirm | [S33.03-decks-trash-empty-trash-confirm.png](screens/S33.03-decks-trash-empty-trash-confirm.png) |

### S40 Editor

| Code | Screen | Image |
|---|---|---|
| S41.01 | Editor / Grid / Default | [S41.01-editor-grid-default.png](screens/S41.01-editor-grid-default.png) |
| S41.02 | Editor / Grid / Add slide, hover | [S41.02-editor-grid-add-slide-hover.png](screens/S41.02-editor-grid-add-slide-hover.png) |
| S41.03 | Editor / Grid / Add slide, hold | [S41.03-editor-grid-add-slide-hold.png](screens/S41.03-editor-grid-add-slide-hold.png) |
| S41.04 | Editor / Grid / Slides pasted | [S41.04-editor-grid-slides-pasted.png](screens/S41.04-editor-grid-slides-pasted.png) |
| S42.01 | Editor / Agent / Working | [S42.01-editor-agent-working.png](screens/S42.01-editor-agent-working.png) |
| S42.02 | Editor / Agent / Run complete | [S42.02-editor-agent-run-complete.png](screens/S42.02-editor-agent-run-complete.png) |
| S42.03 | Editor / Agent / Own agent editing | [S42.03-editor-agent-own-agent-editing.png](screens/S42.03-editor-agent-own-agent-editing.png) |
| S42.04 | Editor / Agent / Long message | [S42.04-editor-agent-long-message.png](screens/S42.04-editor-agent-long-message.png) |
| S43.01 | Editor / Tools / Template picker | [S43.01-editor-tools-template-picker.png](screens/S43.01-editor-tools-template-picker.png) |
| S43.02 | Editor / Tools / Design panel | [S43.02-editor-tools-design-panel.png](screens/S43.02-editor-tools-design-panel.png) |
| S43.03 | Editor / Tools / Images | [S43.03-editor-tools-images.png](screens/S43.03-editor-tools-images.png) |
| S43.04 | Editor / Tools / Shapes | [S43.04-editor-tools-shapes.png](screens/S43.04-editor-tools-shapes.png) |
| S43.05 | Editor / Tools / Shapes, expanded | [S43.05-editor-tools-shapes-expanded.png](screens/S43.05-editor-tools-shapes-expanded.png) |
| S43.06 | Editor / Tools / Text | [S43.06-editor-tools-text.png](screens/S43.06-editor-tools-text.png) |
| S43.07 | Editor / Tools / Actions | [S43.07-editor-tools-actions.png](screens/S43.07-editor-tools-actions.png) |
| S49.01 | Editor / Errors / Agent run failed | [S49.01-editor-errors-agent-run-failed.png](screens/S49.01-editor-errors-agent-run-failed.png) |
| S49.02 | Editor / Errors / Offline | [S49.02-editor-errors-offline.png](screens/S49.02-editor-errors-offline.png) |

### S60 Export

| Code | Screen | Image |
|---|---|---|
| S61.01 | Export / Export / PowerPoint options | [S61.01-export-export-powerpoint-options.png](screens/S61.01-export-export-powerpoint-options.png) |
| S61.02 | Export / Export / PDF options | [S61.02-export-export-pdf-options.png](screens/S61.02-export-export-pdf-options.png) |
| S61.03 | Export / Export / Downloaded, toast | [S61.03-export-export-downloaded-toast.png](screens/S61.03-export-export-downloaded-toast.png) |
| S69.01 | Export / Errors / Export failed | [S69.01-export-errors-export-failed.png](screens/S69.01-export-errors-export-failed.png) |

### S70 Agents

| Code | Screen | Image |
|---|---|---|
| S71.01 | Agents / Connect / Approve Claude | [S71.01-agents-connect-approve-claude.png](screens/S71.01-agents-connect-approve-claude.png) |
| S71.02 | Agents / Connect / Claude connected | [S71.02-agents-connect-claude-connected.png](screens/S71.02-agents-connect-claude-connected.png) |
| S71.03 | Agents / Connect / Approve Codex | [S71.03-agents-connect-approve-codex.png](screens/S71.03-agents-connect-approve-codex.png) |

### S80 Settings

| Code | Screen | Image |
|---|---|---|
| S81.01 | Settings / Settings / Usage tab | [S81.01-settings-settings-usage-tab.png](screens/S81.01-settings-settings-usage-tab.png) |
| S81.02 | Settings / Settings / Agents tab | [S81.02-settings-settings-agents-tab.png](screens/S81.02-settings-settings-agents-tab.png) |
| S81.03 | Settings / Settings / Account tab | [S81.03-settings-settings-account-tab.png](screens/S81.03-settings-settings-account-tab.png) |

### S90 Credits and usage

| Code | Screen | Image |
|---|---|---|
| S91.01 | Credits / Add credits / Amount | [S91.01-credits-add-credits-amount.png](screens/S91.01-credits-add-credits-amount.png) |
| S91.02 | Credits / Add credits / Waiting for payment | [S91.02-credits-add-credits-waiting-for-payment.png](screens/S91.02-credits-add-credits-waiting-for-payment.png) |
| S91.03 | Credits / Add credits / Credits added | [S91.03-credits-add-credits-credits-added.png](screens/S91.03-credits-add-credits-credits-added.png) |
| S92.01 | Credits / Out of usage / Limit reached | [S92.01-credits-out-of-usage-limit-reached.png](screens/S92.01-credits-out-of-usage-limit-reached.png) |
| S92.02 | Credits / Out of usage / Confirm reset | [S92.02-credits-out-of-usage-confirm-reset.png](screens/S92.02-credits-out-of-usage-confirm-reset.png) |
| S92.03 | Credits / Out of usage / Add credits first | [S92.03-credits-out-of-usage-add-credits-first.png](screens/S92.03-credits-out-of-usage-add-credits-first.png) |
| S92.04 | Credits / Out of usage / Reset complete | [S92.04-credits-out-of-usage-reset-complete.png](screens/S92.04-credits-out-of-usage-reset-complete.png) |
| S99.01 | Credits / Errors / Payment failed | [S99.01-credits-errors-payment-failed.png](screens/S99.01-credits-errors-payment-failed.png) |
| S99.02 | Credits / Errors / Payment expired | [S99.02-credits-errors-payment-expired.png](screens/S99.02-credits-errors-payment-expired.png) |

P05 state details: [Manual workspace states](p05-manual-workspace-states.md).
