# Logic

The state machine of each v0.1 flow, with the rules developers must keep. Screen codes are in brackets. Strategy boards with the full reasoning are in [docs/planning/v0.1](../../planning/v0.1/README.md). States with no screen yet are in the [backlog](backlog.md).

## Sign in (F01)

States: email [S21.01] → check email [S22.01] → signed in → back to the intent the person came with.

- One email field. A new email creates the account through the same link; there is no separate sign up.
- A link and a 6-digit code are sent; either one signs in. Links last 15 minutes and work once. Resend after 30 seconds.
- Expired link or wrong code → [S29.01] with Send a new link. Use a different email → back to [S21.01].
- If an agent approval was waiting and expired while the person signed in, restart the connection after sign-in; keep the session.

## Usage and reset (F07)

States: available → limit reached [S92.01] → confirm reset [S92.02] → reset [S92.04] → resume.

- Usage resets every Monday at 8:00 AM in the person's time zone. Shown as percent used, never tokens.
- At the limit the current change finishes, then the run stops. The agent reply ends in the limit card with Reset. The request is kept.
- Every Reset button (Settings and the limit card) opens the confirm: "Reset usage? This uses $5 of your credits." Cancel or Reset.
- Credits of $5 or more: Reset spends $5 at once and usage is back to 0%. A toast and a Resume card follow; the run continues only when the person presses Resume.
- Credits under $5: Reset opens the Add credits dialog [S92.03]. When that payment lands, the reset runs by itself, if the same week's limit still applies.
- One reset per limit hit. A reset belongs to the week and limit it was asked for. If usage already reset (Monday, another tab, auto reset) before a payment lands, the credits land but no $5 is spent.
- Auto reset is off by default and runs at most 3 times a week. When it can run, $5 leaves and the run carries on with no confirm. With credits under $5 or the cap reached, the run stops and the limit card shows. Turning it on while already at the limit does not reset by itself.
- A run that fails on our side gives its usage back. Usage never goes below 0%.

## Add credits and payment (F07)

States: amount [S91.01 or S92.03] → partner page (new tab) and waiting banner [S91.02] → credits added [S91.03] | unable to complete payment [S99.01] | payment expired [S99.02].

- AirDesign only asks the amount (10 or more). Way to pay, card or bank details, saved methods, promo code, tax and receipts all live on the partner page. AirDesign never shows or stores ways to pay.
- One open payment per person. Add credits during an open payment reopens it.
- Credits land only on a verified provider event, never on the return page. Each payment is handled once, by its id.
- Closing the dialog keeps the payment open; Cancel ends it and nothing is charged. If cancel fails because the payment just went through, it is credited.
- An open payment is checked with the provider when the person returns, reopens it or its link expires. Until the provider answers it stays Waiting. "Nothing was charged" is shown only once the provider confirms it.
- Results reach the person wherever they are in AirDesign. History lists only finished payments and resets.
- Each provider is an adapter with four parts: start (returns the page link and expiry), read status, cancel, and turn its signed webhook into paid or failed. Adding a provider adds an adapter, never new screens.

## Agent run (F02, F03)

States: idle → working [S42.01, S42.03] → complete [S42.02] | stopped | failed [S49.01] | limit reached [S92.01].

- One request is one run. One Aira run per deck at a time. A new message while it runs steers that run, in every tab; no second run starts.
- The deck and selection are captured when a message is sent. Selection shows as chips ("Slide 3", "Bar chart") and can be removed. Nothing selected means the whole deck.
- The slide being changed shows the working glow for any agent, with no name.
- The person can stop any run and keep the work so far: Aira from its message box, a User Agent from its own app or by ending its connection in Settings, Agents.
- The person always wins: their edits land; an agent change based on an older version is refused and the agent re-reads.
- Undo right after a run removes the whole run; later edits by the person stay.
- Run failed → notice card with Resume and Undo; work so far is saved.

## Import and paste (F05)

States: New deck menu [S32.01] → importing card on Home [S32.02] → deck opens | import failed card [S32.03].

- Import has no page of its own; progress and failure show on the deck card.
- Import failed → Choose another file or Remove. Remove deletes the failed card; nothing was saved.
- Paste in the grid [S41.04] inserts all slides at once with a toast and Undo.

## Export (F04)

States: options [S61.01, S61.02] → building in the background → downloaded toast [S61.03] | export failed toast with Try again [S69.01].

- Every export is built from one saved version; the file and its fit report come from the same build. The person can keep working.
- Flagged items review and export during a run are in the backlog.

## Decks and Trash (F14)

- Recents and All decks list the person's decks, last edited first.
- Move to Trash → toast with Undo [S33.01]. Other open tabs turn read-only; a running agent stops.
- Trash [S33.02]: Restore brings a deck back with its history. Empty Trash asks to confirm [S33.03]; the confirm applies to the decks shown when it opened. After 30 days decks are removed for good.

## Connect an agent (F06)

States: approve [S71.01, S71.03] → connected [S71.02] → back to the agent.

- Consent shows the account (with Switch), what the agent can do, and where the person returns (claude.ai, or Codex on this computer). Allow or Cancel.
- Agents can read and edit all the person's decks, use their templates and files, and import and export. They cannot change billing, credits, resets or the account, and cannot delete decks.
- Ending a connection in Settings stops its access at once; a running agent's next call fails and its changes so far stay.

## Offline and errors (F15)

- Offline [S49.02]: edits are saved on the device; Ask agent and Export wait for the connection.
- Edits sent after reconnecting follow the same rules: the person wins over agents; between the person's own tabs the latest change to each property wins. A queued edit to a slide or deck deleted meanwhile is kept and offered for restore, never dropped.
- Surfaces by weight: toast for small results with no choice, notice card for anything about a run, alert dialog for results and confirms that need a choice. Every message says what happened, what is safe and one next step.
