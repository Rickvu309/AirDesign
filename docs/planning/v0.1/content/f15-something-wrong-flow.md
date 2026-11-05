# F15 Something Wrong Flow

AirDesign / v0.1 / F15, across every flow

F15 When something goes wrong

One pattern everywhere: say what happened, say what is safe, offer one next step. Saved work is never lost.

yes: retried quietly, up to 3 times

no

Where it happened

1 Something fails

Fixes itself?

Where it happened

2 Told plainly

Where it happened

3 One next step

The flow it came from

Back on track

Failure map: what happened, what is safe, next step

Agent run fails

Changes so far stay

Resume, or Undo run. Usage for a failure on our side returns. F02, F03.

Credits run out mid-run

The current change finishes

Pay to reset or wait for the weekly reset, then send the kept request. F07.

Agent connection ended mid-run

Changes so far stay

Connect again. F06.

Import refused

Nothing saved

Fix the file as told, try again. F05.

Export fails

The deck is untouched

Retry. The same version builds again. F04.

Image refused

Nothing added

Use another file. F12.

Sign-in link expired or code wrong

Nothing changed

Send a new link and code. F01.

Payment fails

Nothing charged

Try again or pick another way to pay. F07.

Connection lost

Edits are kept on this device

Keep working. They are sent when the connection is back.

User Agent rate limited

Nothing lost

The agent is told when to retry.

AirDesign is down

Saved work is safe

A status page says what is known. Try again later.

Errors live in each area flow 9: S29 access, S49 editor, S69 export, S99 payment. Three surfaces, by weight: a toast for small results that need no choice (S69.01 export failed), a notice card in the agent chat for anything about a run (S49.01 run failed, S92.01 limit), and an alert dialog for results and confirms that need a choice (S99, S33.03, S92.02). Every message: what happened, what is safe, one next step. Limit and failure icons are red.

Rules

Saved work is never lost.
Every message says what happened, what is safe, and one next step. Plain words, no blame.
Short glitches retry quietly, up to 3 times. If it takes over 3 s, the person is told it is retrying.
Agents get the same failures as structured errors, with a retry hint.
Every failure carries a reference that support can trace.
Edits sent after a lost connection follow the same rules: the person wins over agents, and between the person's own tabs the latest change to each property wins. If a queued edit targets a slide or deck that was deleted meanwhile, it is kept, never dropped, and the person is offered to restore it into the open deck.
