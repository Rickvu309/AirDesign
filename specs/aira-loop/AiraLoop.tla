---- MODULE AiraLoop ----
\* One Aira ask in the browser (askAira in apps/web/src/aira/aira-loop.ts) whose model turn asks
\* for one edit, while the person may press Stop and then ask again, or the model's next turn
\* fails and the person presses Try again.
\* The edit call is sent when the model starts, with a once the browser made from the ask.
\* server is the call's once in deck.doom_edit: none, landed with the edit under run r, or spent
\* by the Stop. The edit and its once are one write, so the server lands only an unspent once.
\* answer is the browser's fetch of that call: waiting, read, or cut by Stop at once.
\* named is the stop that names the cut call answered: it spends the once, or finds it landed
\* and answers r. known is r in the exchange's runs, which is what offers Undo. closed is
\* stop_run of r answered. settled is askAira resolved. A next ask starts from the chat shown
\* when the person asks, and held is r in that chat's runs. Its turn waits for settled, and
\* nextKnown is r in the runs of the chat it holds when its turn is sent. retried is a next ask
\* that is Try again on the failed request, and rows is how many requests its chat shows.
EXTENDS Integers

VARIABLES server, answer, named, stop, shown, known, closed, settled, asked, held, sent, nextKnown, retried, rows

vars == <<server, answer, named, stop, shown, known, closed, settled, asked, held, sent, nextKnown, retried, rows>>

TypeOK ==
  /\ server \in {"none", "landed", "spent"}
  /\ answer \in {"waiting", "read", "cut"}
  /\ named \in BOOLEAN
  /\ stop \in BOOLEAN
  /\ shown \in {"working", "stopped", "done", "failed"}
  /\ known \in BOOLEAN
  /\ closed \in BOOLEAN
  /\ settled \in BOOLEAN
  /\ asked \in BOOLEAN
  /\ held \in BOOLEAN
  /\ sent \in BOOLEAN
  /\ nextKnown \in BOOLEAN
  /\ retried \in BOOLEAN
  /\ rows \in {1, 2}

Init ==
  /\ server = "none"
  /\ answer = "waiting"
  /\ named = FALSE
  /\ stop = FALSE
  /\ shown = "working"
  /\ known = FALSE
  /\ closed = FALSE
  /\ settled = FALSE
  /\ asked = FALSE
  /\ held = FALSE
  /\ sent = FALSE
  /\ nextKnown = FALSE
  /\ retried = FALSE
  /\ rows = 1

\* askAira resolving lets a waiting next ask send its turn. Before it does, the next ask adds
\* the runs the resolved chat holds to the chat it started from.
Release ==
  /\ settled' = TRUE
  /\ sent' = asked
  /\ nextKnown' = IF asked THEN held \/ known ELSE nextKnown

\* The server writes the edit under run r and spends its once in the same statement, which
\* fails on a once the Stop already spent.
Land ==
  /\ server = "none"
  /\ server' = "landed"
  /\ UNCHANGED <<answer, named, stop, shown, known, closed, settled, asked, held, sent, nextKnown, retried, rows>>

\* The browser reads the answer and puts r in the exchange's runs.
Read ==
  /\ answer = "waiting"
  /\ server = "landed"
  /\ answer' = "read"
  /\ known' = TRUE
  /\ UNCHANGED <<server, named, stop, shown, closed, settled, asked, held, sent, nextKnown, retried, rows>>

\* The person presses Stop. The exchange shows stopped at once, and a waiting edit call's
\* fetch is cut at once.
Stop ==
  /\ shown = "working"
  /\ stop' = TRUE
  /\ shown' = "stopped"
  /\ answer' = IF answer = "waiting" THEN "cut" ELSE answer
  /\ UNCHANGED <<server, named, known, closed, settled, asked, held, sent, nextKnown, retried, rows>>

\* The stop names the cut call's deck and once. The server spends the once, or finds it
\* landed and answers r, which the browser puts in the exchange's runs. With no run to stop,
\* askAira resolves.
Spend ==
  /\ answer = "cut"
  /\ ~named
  /\ named' = TRUE
  /\ IF server = "landed"
     THEN known' = TRUE /\ UNCHANGED <<server, settled, sent, nextKnown>>
     ELSE server' = "spent" /\ Release /\ UNCHANGED known
  /\ UNCHANGED <<answer, stop, shown, closed, asked, held, retried, rows>>

\* The model's next turn ends the run with no more calls.
Finish ==
  /\ ~stop
  /\ answer = "read"
  /\ shown = "working"
  /\ shown' = "done"
  /\ UNCHANGED <<server, answer, named, stop, known, closed, settled, asked, held, sent, nextKnown, retried, rows>>

\* The model's next turn fails, so the request shows Try again.
Fail ==
  /\ ~stop
  /\ answer = "read"
  /\ shown = "working"
  /\ shown' = "failed"
  /\ UNCHANGED <<server, answer, named, stop, known, closed, settled, asked, held, sent, nextKnown, retried, rows>>

\* closeRuns sends stop_run of r and the server answers it, then askAira resolves.
Close ==
  /\ shown # "working"
  /\ known
  /\ ~settled
  /\ closed' = TRUE
  /\ Release
  /\ UNCHANGED <<server, answer, named, stop, shown, known, asked, held, retried, rows>>

\* The person asks again once the exchange no longer works. The new ask's turn goes at once
\* when the first ask resolved, or waits for it.
Ask ==
  /\ shown # "working"
  /\ ~asked
  /\ asked' = TRUE
  /\ held' = known
  /\ sent' = settled
  /\ nextKnown' = IF settled THEN known ELSE nextKnown
  /\ rows' = 2
  /\ UNCHANGED <<server, answer, named, stop, shown, known, closed, settled, retried>>

\* The person presses Try again on the failed request, which retries it in place. Its turn
\* waits for the failed ask to resolve, as a next ask's does.
Retry ==
  /\ shown = "failed"
  /\ ~asked
  /\ asked' = TRUE
  /\ retried' = TRUE
  /\ held' = known
  /\ sent' = settled
  /\ nextKnown' = IF settled THEN known ELSE nextKnown
  /\ UNCHANGED <<server, answer, named, stop, shown, known, closed, settled, rows>>

Done ==
  /\ settled
  /\ asked
  /\ UNCHANGED vars

Next == Land \/ Read \/ Stop \/ Spend \/ Finish \/ Fail \/ Close \/ Ask \/ Retry \/ Done

Spec == Init /\ [][Next]_vars

\* A stopped ask's run ends on the server however late its write would land: the edit lands
\* before the Stop spent its once or never, and one that landed is offered for Undo as one
\* step and its run is stopped, so nothing more of it lands.
StoppedRunUndoable == settled /\ shown = "stopped" /\ server = "landed" => known /\ closed

\* A run the exchange holds is stopped before askAira resolves.
KnownRunClosed == settled /\ known => closed

\* A next ask's turn goes only once the stopped ask resolved, so its edits never join r.
NextAskAfterClose == sent => settled

\* The chat a next ask sends with still offers Undo of the stopped run.
NextAskKeepsUndo == sent => nextKnown = known

\* Try again retries the failed request in place: its chat shows that one request, not a copy.
RetryInPlace == retried => rows = 1
====
