# Copy Kit

AirDesign / v0.1 / Copy kit

Copy kit

Write a new message by picking a pattern, filling its slots, then reusing any string below that already says the same thing. Screens and components read these strings by name.

Rules

One or two short sentences: what happened, then what is safe or what to do next.

Sentence case everywhere. No exclamation marks, no oops, no we.

Buttons start with a verb. Confirm buttons repeat the action, red when it deletes.

Same fact, same sentence, in every place it appears.

Words: usage, credits, reset, payment. Times: Monday at 8:00 AM. Reset price: $5. Balances show cents.

Placeholders in braces fill in at run time: {amount}, {balance}, {deck}, {n}, {file}.

Patterns

Use one of these for every new message.

toast.success

{Thing} {done}. Optional action: Undo.

toast.error

Unable to {verb}. {What is safe}. Action: Try again.

toast.info

{State}. {What is safe}.

confirm

Title: {Verb} {thing}? Body: {Consequence}. Buttons: Cancel, {Verb}.

result.success

Title: {Outcome}. Body: {What changed}. Button: Done.

result.error

Title: Unable to {verb}. Body: {What is safe}. Try again. Buttons: Close, Try again.

notice.card

Title: {What happened}. Body: {When it changes} or {what is safe}. One or two actions.

error.page

Title: Unable to {verb} or {Thing} has expired. Body: {Why}. {Fix}. One button.

empty.state

Title: No {things} yet. Body: {What this place is for}. Button: {Create thing}.

banner.waiting

Waiting for {thing}. {Where to finish}. Actions: Open, Cancel.

Usage

usage.title

Weekly usage

usage.resets

Resets Monday at 8:00 AM

usage.reset_action

Reset

usage.limit_title

You've hit this week's limit

usage.limit_body

Resets Monday at 8:00 AM. Your request is saved.

usage.reset_done

Usage reset. $5 used from your credits.

usage.reset_confirm_title

Reset usage?

usage.reset_confirm_body

This uses $5 of your credits.

Agent chat

agent.resume_line

Pick up where you left off.

agent.resume

Resume

agent.failed_title

Unable to finish this run

agent.failed_body

Your work so far is saved.

agent.name

Aira

Credits

credits.title

Credits

credits.facts

Each reset is $5. Credits never expire.

credits.add

Add credits

credits.minimum

Minimum $10.

Auto reset

auto.title

Auto reset

auto.body

When usage runs out, reset for $5 from your credits.

Payment

pay.continue

Continue to payment

pay.new_tab

Opens a secure page in a new tab.

pay.waiting

Waiting for your {amount} payment. Finish in the new tab.

pay.open

Open payment page

pay.added_title

{amount} added

pay.added_body

Your balance is now {balance}. Receipt sent to your email.

pay.failed_title

Unable to complete payment

pay.expired_title

Payment expired

pay.not_charged

Nothing was charged. Try again.

pay.try_again

Try again

History

history.added

Credits added

history.reset

Usage reset

Buttons

common.cancel

Cancel

common.close

Close

common.not_now

Not now

common.done

Done

common.undo

Undo

Export

export.downloaded

{file} downloaded

export.failed

Unable to export. Your deck is unchanged.

Editor

editor.offline

You're offline. Edits are saved on this device.

Import

import.pasted

{n} slides pasted from PowerPoint

import.failed_title

Unable to import this file

Decks

decks.trashed

{deck} moved to Trash

Trash

trash.empty_title

Delete {n} decks for good?

trash.empty_body

This can't be undone.

trash.empty_action

Delete for good

Components

Each one is built once and filled from this kit.

Notice card

In-chat card. Icon (limit, error, ok), title, body, up to two buttons. S92.01, S92.04, S49.01.

Alert dialog

Icon, title, one line, buttons; red when it deletes. S91.03, S99.01, S99.02, S33.03, S92.02.

Toast

Top center bar, optional icon and one action. S33.01, S41.04, S61.03, S69.01, S49.02, S92.04.

Add credits dialog

The only way to add credits. S91.01 and S92.03, only numbers change.

Module card

Card with title, line, actions and rows. Every Settings tab.

Working glow

Shown while any agent (Aira, Claude, Codex) changes a slide. Blue to violet gradient edge, soft glow, light sweep over the part being changed. No name or label. S42.01, S42.03.
