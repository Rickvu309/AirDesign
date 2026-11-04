ISSUES

## Stale codes

- F10 Learn, Rules — “shown on the site and in S08” points to a retired Settings code; replace S08 with S81.02.
- F05 Import, diagram — S41.04 is labelled “Review what is flagged,” but the actual screen is the editor grid after pasting slides; reserve S41.04 for paste and map file import to S32.01–S32.03, with report explanations as described in the steps table.
- F11 Templates, diagram — S43.01 is labelled “Save a template,” but it only picks templates; use S43.01 for picking and assign a new screen/state for saving, rather than implying S43.02 already implements it.
- F07 Usage, diagram/steps — “S92.01 Out of usage, reset” conflates the limit card with executing a reset, and step 2 maps a balance reset to external X5; map limit → S92.01, confirmation → S92.02, insufficient credits → S92.03/S91.01, completion → S92.04, with X5/X6 used only for adding credits.
- F01–F14 screen references — All explicit Sxx.NN references exist; S11/S21/S22/S31/S40/S61/S71/S81 are family or area shorthand, not missing screens. Resolve these to concrete states in handoff tables; no active S51, S59, S92 “Payment method,” or S93 reference remains on the strategy canvas. Earlier numbering in decision-note history is superseded.

## Orphan screens

- S41.02–S41.03 / F03 — Grid add-slide hover/hold states are included only by the broad editor screen range; no flow describes adding a slide or the hold outcome. Add the behavior and transition to F03.
- S43.04–S43.07 / F03, F12 — Shapes, expanded shapes, text styles and Actions have no specific flow steps; “edit by hand” and the editor screen range provide only umbrella coverage. Document insertion/editing behavior, including Actions → Chart/Table/Icon and image actions, under F03/F12. No entire screen is wholly unreferenced once ranges and family references are counted.

## Contradictions

- S11.01 / F07, F10 — The Pricing placeholder says “Free to start, Pro for teams,” contradicting free weekly usage with paid resets and S12.01; replace it with the free/reset model and remove Pro/team-plan wording.
- F07 Usage, step 1 and Rules / S81.01, S91.01–S91.02 — Strategy still includes payment methods, saved-method list/remove, a “Pay with” provider row, and pending payments in popup/history; current screens correctly use amount-only Add credits, partner checkout and a waiting banner. Remove these old requirements; keep History for finished payments/resets only.
- F07 Usage, step 1 / S92.01–S92.03 — Strategy still calls for a balance-dependent popup with “Reset for $5” or “Add credits”; the designs use an inline limit card, “Reset,” a confirmation and the shared Add credits dialog. Rewrite the old step to match that sequence.
- F03 Edit and refine, own-agent step / S42.03, Copy Kit — Strategy requires an agent-colored glow plus “Claude is editing” pill; the later decision and actual screen use the shared blue/violet working glow without a name. Remove the pill and per-agent-color requirement.
- S71.01, S71.03 / F06 — Consent screens omit the promised return destination and the boundary that agents cannot delete decks, bill or manage accounts; show claude.ai or “Codex on this computer” before Allow, plus the access limitations.
- S32.03 / F05, latest import decision — The failed deck card says only “Unable to import,” omitting the password reason and recovery instruction promised for this state; add “This file has a password. Remove it and try again.” on the card.
- S11.01 / F10 — Landing has only Start free/Sign in entry points, a product-shot placeholder and no real before/after PowerPoint result; add the import and own-agent intents and replace the placeholders with the promised product evidence.
- S11.01 / F06, F10 — The agents placeholder promotes ChatGPT and Cursor alongside Claude/Codex, while launch guidance focuses on Claude and Codex; name those two first and describe other compatible MCP agents generically.
- S41.01–S43.07, S49.01–S49.02, S61.01–S61.03, S69.01, S92.01–S92.04 / Aira naming decision — The toolbar still labels the built-in panel “Agent” although the composer and Settings use Aira; rename the panel switch to “Aira.”
- F07 Usage, insufficient-balance text / S92.02, Copy Kit — Strategy confirmation promises a remaining balance and uses older wording; the design correctly uses “This uses $5 of your credits.” Update strategy to the kit string and remove the balance projection.
- F15 / Copy Kit, S49.01, S69.01 — “Every alert and result” as one dialog conflicts with the kit's in-chat failure cards and export-error toast; explicitly distinguish notice cards, toasts and confirmation/result dialogs.
- F02–F03 / S42.03 — F02 promises stopping either agent from AirDesign, while F03 says the person stops a User Agent in its own app; S42.03 shows a working glow with no stop control. Make the stop ownership consistent before implementing it.

## Design gaps (missing screens or states)

- F04 / S61 — Flagged-items review is explicitly promised and explicitly undesigned: no slide/item list, translation consequence, Fix or Export anyway state; add it only when flags exist.
- F09 / S81.03 — Delete account has no confirmation despite irreversible deck/credit loss and the 30-day deletion promise; add explicit confirmation explaining lost credits, ended sessions/connections and data-removal timing.
- F06, F09 / S81.02 — Manage has no connection-detail/end-access state, approval/last-used timestamps or separate connections for the same app on two computers; design per-connection inspection and revocation.
- F01 / S22.01 — Strategy promises email link OR code, but the check-inbox screen has no code entry, invalid-code state or resend cooldown; add those states within the same email-only flow, without adding a separate signup form.
- F02 / S31.01, S41–S42 — No empty newly created deck/editor state shows the first request to Aira; current editor examples already contain a deck or an active/completed run. Add the initial editor state and correct F02's S31 “Describe it” mapping to the editor after New deck.
- F10, F06 / S13 reserved, S81.02 — Public/setup agent guides and their agent-readable plain-text counterpart are promised but absent; design the shared Claude/Codex setup content and assign a concrete S13.NN code. X1–X6 remain outside surfaces, not missing AirDesign screens.
- F11, F08 / S43.01–S43.02 — Saving a template from a deck/PowerPoint, creating/editing its fonts/logos/layouts and setting a default have no designed states; add them so the next-deck default-template promise has a usable path.
- F02–F03 / S42.02 — Completed runs promise visible overflow/contrast/PowerPoint-fit findings and expandable changes by slide, including edits outside selection and edits retained after Undo; only the collapsed activity line and generic completion are shown. Add expanded findings/change-review states.
- F12 / S43.03 — Personal image library, reuse/removal and source/license information are promised but absent from the stock/upload picker; add the library states.
- F12 / S43.03 — Crop, focal point, mask, replace, alt text and low-resolution warnings have no designed editing states; add these controls and their feedback while preserving originals.
- F14 / S31–S33 — Rename, duplicate and move-to-Trash entry controls, title editing and search-result/no-result states are not shown; design the actions/search states that lead to the existing Trash toast and list.
- F07 / S92.03–S92.04 — Under-$5 checkout promises an automatic $5 reset after payment, then manual Resume, but the only waiting screen is Settings and the only credits-added result shows an ordinary top-up. Add the editor-origin waiting/return and post-payment reset state with the correct resulting balance and retained request.
- F07 / S81.01 — Auto reset promises off-by-default behavior and a maximum of three resets a week, but only an enabled toggle is shown; add the default-off state and the fallback when the cap or insufficient balance prevents another automatic reset.
- F04 / S61 — Export during an active run promises “export now” versus “when the run ends,” and large exports promise background progress/readiness; design these states beyond options/downloaded/error.
- F06, F15 / S71, S49 — Expired approval and a connection revoked during a run have no recovery states; show reconnect/restart approval while preserving edits.
- F12, F15 / S43.03 — Rejected image, storage full and empty stock-search states are promised but absent; add the reason, safe outcome and next action in the existing picker/editor.
- F09 / S81.03 — Profile Edit, email-change confirmation at both addresses and email-already-used rejection have no designed states; add them behind Edit.
- F14 / S40 — A deck deleted from another tab must become read-only and stop its run, but no deleted-deck editor state exists; add that state with a route back to owned decks/Trash.
- F15 — AirDesign-down/status-page and visible retry-after-3-seconds states are promised but absent; design the failure/retry surfaces and their next step.

## Copy issues

- S22.01 — “We sent a sign-in link to” breaks the no-“we” rule; use “Sign-in link sent to” followed by the address.
- S11.01 — “AirDesign frames before it designs. One governing thought. Three arguments that hold it up. Evidence under each. The way top partners build a deck.” exceeds the one-or-two-short-sentence rule; shorten to “Lead with one recommendation. Support it with three clear arguments and sources.”
- S11.01 — “FRAMING,” “VALUE” and “PLACEHOLDERS” break sentence case, and placeholder instructions remain visible; use sentence-case labels and replace internal placeholder text with finished content.
- F07 / S91.03, S99.01 — Strategy still names results “Credits added” and “Payment didn't go through,” while the kit/screens use “{amount} added” and “Unable to complete payment”; reuse the kit strings in strategy to prevent regressions.
- S29.01, S99.02 / Copy Kit — Expiry titles are explicit kit exceptions to “Unable to”: “This link has expired” and “Payment expired.” Keep these approved strings; clarify the exception if the error-prefix rule is intended to be universal. No exclamation-mark violation was found in product messages.
