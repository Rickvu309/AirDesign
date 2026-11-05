# Copy kit

Every screen, component and agent message uses these strings by key. Write a new string here first, then reuse it. Slots in braces fill in at run time.

## Rules

- One or two short sentences: what happened, then what is safe or what to do next.
- Sentence case everywhere. No exclamation marks, no oops, no we.
- Buttons start with a verb. Confirm buttons repeat the action, red when it deletes.
- Same fact, same sentence, in every place it appears.
- Words: usage, credits, reset, payment. Times: Monday at 8:00 AM. Reset price: $5. Balances show cents.
- Placeholders in braces fill in at run time: {amount}, {balance}, {deck}, {n}, {file}.

## Patterns

| Pattern | Shape |
|---|---|
| `toast.success` | {Thing} {done}. Optional action: Undo. |
| `toast.error` | Unable to {verb}. {What is safe}. Action: Try again. |
| `toast.info` | {State}. {What is safe}. |
| `confirm` | Title: {Verb} {thing}? Body: {Consequence}. Buttons: Cancel, {Verb}. |
| `result.success` | Title: {Outcome}. Body: {What changed}. Button: Done. |
| `result.error` | Title: Unable to {verb}. Body: {What is safe}. Try again. Buttons: Close, Try again. |
| `notice.card` | Title: {What happened}. Body: {When it changes} or {what is safe}. One or two actions. |
| `error.page` | Title: Unable to {verb} or {Thing} has expired. Body: {Why}. {Fix}. One button. |
| `empty.state` | Title: No {things} yet. Body: {What this place is for}. Button: {Create thing}. |
| `banner.waiting` | Waiting for {thing}. {Where to finish}. Actions: Open, Cancel. |

## Strings

| Key | Text |
|---|---|
| `usage.title` | Weekly usage |
| `usage.resets` | Resets Monday at 8:00 AM |
| `usage.reset_action` | Reset |
| `usage.limit_title` | You've hit this week's limit |
| `usage.limit_body` | Resets Monday at 8:00 AM. Your request is saved. |
| `usage.reset_done` | Usage reset. $5 used from your credits. |
| `agent.resume_line` | Pick up where you left off. |
| `agent.resume` | Resume |
| `credits.title` | Credits |
| `credits.facts` | Each reset is $5. Credits never expire. |
| `credits.add` | Add credits |
| `credits.minimum` | Minimum $10. |
| `auto.title` | Auto reset |
| `auto.body` | When usage runs out, reset for $5 from your credits. |
| `pay.continue` | Continue to payment |
| `pay.new_tab` | Opens a secure page in a new tab. |
| `pay.waiting` | Waiting for your {amount} payment. Finish in the new tab. |
| `pay.open` | Open payment page |
| `pay.added_title` | {amount} added |
| `pay.added_body` | Your balance is now {balance}. Receipt sent to your email. |
| `pay.failed_title` | Unable to complete payment |
| `pay.expired_title` | Payment expired |
| `pay.not_charged` | Nothing was charged. Try again. |
| `pay.try_again` | Try again |
| `history.added` | Credits added |
| `history.reset` | Usage reset |
| `common.cancel` | Cancel |
| `common.close` | Close |
| `common.not_now` | Not now |
| `common.done` | Done |
| `agent.failed_title` | Unable to finish this run |
| `agent.failed_body` | Your work so far is saved. |
| `export.downloaded` | {file} downloaded |
| `export.failed` | Unable to export. Your deck is unchanged. |
| `editor.offline` | You're offline. Edits are saved on this device. |
| `import.pasted` | {n} slides pasted from PowerPoint |
| `decks.trashed` | {deck} moved to Trash |
| `common.undo` | Undo |
| `trash.empty_title` | Delete {n} decks for good? |
| `trash.empty_body` | This can't be undone. |
| `trash.empty_action` | Delete for good |
| `agent.name` | Aira |
| `usage.reset_confirm_title` | Reset usage? |
| `usage.reset_confirm_body` | This uses $5 of your credits. |
| `import.failed_title` | Unable to import this file |
| `access.sign_in_title` | Sign in |
| `access.email_label` | Email |
| `access.continue` | Continue |
| `access.check_title` | Check your email |
| `access.check_body` | Use the link or the 6-digit code. The link works once and expires in 15 minutes. |
| `access.code_label` | Code |
| `access.resend` | Resend email |
| `access.resend_wait` | Resend is available in {n} seconds. |
| `access.different_email` | Use a different email |
| `access.wrong_code` | That code is not valid. Try again. |
| `access.expired_title` | This link has expired |
| `access.expired_body` | Send a new link to continue. Your place is saved. |
| `access.send_new` | Send a new link |
| `access.sign_out` | Sign out |
| `access.sign_out_title` | Sign out? |
| `access.sign_out_body` | This ends the session on this device. |
| `access.signed_in` | Signed in. |
| `home.empty_title` | No decks yet |
| `home.empty_body` | This is where your decks will show up. |
| `home.new_deck` | Start a deck |
| `home.import` | Import a PowerPoint |
| `home.connect_agent` | Connect an agent |
| `home.intent_kept` | Your place is saved. |
| `shell.command` | Commands |
| `shell.home` | Home |
| `shell.brand` | AirDesign |
| `shell.command_empty` | No commands match. |
| `access.email_invalid` | Enter an email address. |
