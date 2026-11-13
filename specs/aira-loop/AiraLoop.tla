---- MODULE AiraLoop ----
\* One Aira ask in the browser (askAira in apps/web/src/aira-loop.ts) whose model turn asks
\* for one edit, while the person may press Stop and then ask again.
\* The edit call is sent when the model starts. server says whether it landed and wrote run r.
\* answer is the browser's fetch of that call: waiting, read, or cut once the browser gave up.
\* After Stop the browser keeps an edit call's fetch until its answer comes or the wait ends.
\* The model assumes an answer comes within the wait once the server landed, so the wait ends
\* only on a call that has not landed. late marks a call that landed after the browser cut it.
\* known is r in the exchange's runs, which is what offers Undo. closed is stop_run of r
\* answered. settled is askAira resolved. A next ask starts from the chat shown when the
\* person asks, and held is r in that chat's runs. Its turn waits for settled, and nextKnown
\* is r in the runs of the chat it holds when its turn is sent.
EXTENDS Integers

VARIABLES server, answer, late, stop, shown, known, closed, settled, asked, held, sent, nextKnown

vars == <<server, answer, late, stop, shown, known, closed, settled, asked, held, sent, nextKnown>>

TypeOK ==
  /\ server \in {"none", "landed"}
  /\ answer \in {"waiting", "read", "cut"}
  /\ late \in BOOLEAN
  /\ stop \in BOOLEAN
  /\ shown \in {"working", "stopped", "done"}
  /\ known \in BOOLEAN
  /\ closed \in BOOLEAN
  /\ settled \in BOOLEAN
  /\ asked \in BOOLEAN
  /\ held \in BOOLEAN
  /\ sent \in BOOLEAN
  /\ nextKnown \in BOOLEAN

Init ==
  /\ server = "none"
  /\ answer = "waiting"
  /\ late = FALSE
  /\ stop = FALSE
  /\ shown = "working"
  /\ known = FALSE
  /\ closed = FALSE
  /\ settled = FALSE
  /\ asked = FALSE
  /\ held = FALSE
  /\ sent = FALSE
  /\ nextKnown = FALSE

\* askAira resolving lets a waiting next ask send its turn. Before it does, the next ask adds
\* the runs the resolved chat holds to the chat it started from.
Release ==
  /\ settled' = TRUE
  /\ sent' = asked
  /\ nextKnown' = IF asked THEN held \/ known ELSE nextKnown

\* The server writes the edit under run r.
Land ==
  /\ server = "none"
  /\ server' = "landed"
  /\ late' = (answer = "cut")
  /\ UNCHANGED <<answer, stop, shown, known, closed, settled, asked, held, sent, nextKnown>>

\* The browser reads the answer and puts r in the exchange's runs: the answered event while
\* the run goes on, the landed event once a Stop came first.
Read ==
  /\ answer = "waiting"
  /\ server = "landed"
  /\ answer' = "read"
  /\ known' = TRUE
  /\ UNCHANGED <<server, late, stop, shown, closed, settled, asked, held, sent, nextKnown>>

\* The person presses Stop. The exchange shows stopped at once, whether the edit call still
\* waits or the model's next turn streams.
Stop ==
  /\ shown = "working"
  /\ stop' = TRUE
  /\ shown' = "stopped"
  /\ UNCHANGED <<server, answer, late, known, closed, settled, asked, held, sent, nextKnown>>

\* The wait after Stop ends on a call with no answer. The browser cuts the fetch, and with no
\* run to stop askAira resolves.
WaitEnds ==
  /\ stop
  /\ answer = "waiting"
  /\ server = "none"
  /\ answer' = "cut"
  /\ Release
  /\ UNCHANGED <<server, late, stop, shown, known, closed, asked, held>>

\* The model's next turn ends the run with no more calls.
Finish ==
  /\ ~stop
  /\ answer = "read"
  /\ shown = "working"
  /\ shown' = "done"
  /\ UNCHANGED <<server, answer, late, stop, known, closed, settled, asked, held, sent, nextKnown>>

\* closeRuns sends stop_run of r and the server answers it, then askAira resolves.
Close ==
  /\ shown # "working"
  /\ answer = "read"
  /\ ~settled
  /\ closed' = TRUE
  /\ Release
  /\ UNCHANGED <<server, answer, late, stop, shown, known, asked, held>>

\* The person asks again once the exchange no longer works. The new ask's turn goes at once
\* when the first ask resolved, or waits for it.
Ask ==
  /\ shown # "working"
  /\ ~asked
  /\ asked' = TRUE
  /\ held' = known
  /\ sent' = settled
  /\ nextKnown' = IF settled THEN known ELSE nextKnown
  /\ UNCHANGED <<server, answer, late, stop, shown, known, closed, settled>>

Done ==
  /\ settled
  /\ asked
  /\ server = "landed"
  /\ UNCHANGED vars

Next == Land \/ Read \/ Stop \/ WaitEnds \/ Finish \/ Close \/ Ask \/ Done

Spec == Init /\ [][Next]_vars

\* A stopped run's write that landed and answered in time is offered for Undo as one step,
\* and its run is stopped, so nothing more of it lands.
StoppedRunUndoable == settled /\ shown = "stopped" /\ server = "landed" /\ ~late => known /\ closed

\* A run the exchange holds is stopped before askAira resolves.
KnownRunClosed == settled /\ known => closed

\* A next ask's turn goes only once the stopped ask resolved, so its edits never join r.
NextAskAfterClose == sent => settled

\* The chat a next ask sends with still offers Undo of the stopped run.
NextAskKeepsUndo == sent => nextKnown = known
====
