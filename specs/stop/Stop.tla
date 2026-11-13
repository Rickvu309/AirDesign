---- MODULE Stop ----
EXTENDS Integers

\* One ask runs its model call on server A. A person stops it from server B,
\* or leaves A, or both at once. The ask row in Postgres is the only state the
\* two servers share. B marks the row stopped and notifies; A learns it from a
\* wake, which a dropped listen connection can lose until it reconnects.
\* call is the ask on A: none, running, aborted, or closed once settled or
\* released.
\* row is the stored ask row: none, live, stopped, or gone once A forgets it.
\* stop is B's stop request; reached says it found the row; late says its wait
\* passed the bound. next is a new ask on B while the turn may still be open.
\* model is A's model call after the reserve: unsent, sent, or skipped when A
\* finds the ask stopped just before it would send.

VARIABLES call, row, charges, stop, reached, late, wake, next, model

vars == <<call, row, charges, stop, reached, late, wake, next, model>>

TypeOK ==
  /\ call \in {"none", "running", "aborted", "closed"}
  /\ row \in {"none", "live", "stopped", "gone"}
  /\ charges \in 0..2
  /\ stop \in {"idle", "waiting", "answered"}
  /\ reached \in BOOLEAN
  /\ late \in BOOLEAN
  /\ wake \in BOOLEAN
  /\ next \in {"idle", "waiting", "reserved", "refused"}
  /\ model \in {"unsent", "sent", "skipped"}

ChargedOnce == charges <= 1

ChargedOnlyIfSent == charges > 0 => model = "sent"

StopBeforeAskIsHeeded == (stop = "answered" /\ ~reached /\ row /= "gone") => model /= "sent"

RowOutlivesCall == row = "gone" => call = "closed"

AnsweredAfterClose ==
  (stop = "answered" /\ reached /\ ~late) => call = "closed"

OneOpenTurn == next = "reserved" => call = "closed"

Init ==
  /\ call = "none"
  /\ row = "none"
  /\ charges = 0
  /\ stop = "idle"
  /\ reached = FALSE
  /\ late = FALSE
  /\ wake = FALSE
  /\ next = "idle"
  /\ model = "unsent"

Follow ==
  /\ call = "none"
  /\ call' = "running"
  /\ row' = "live"
  /\ UNCHANGED <<charges, stop, reached, late, wake, next, model>>

Leave ==
  /\ call = "running"
  /\ call' = "aborted"
  /\ UNCHANGED <<row, charges, stop, reached, late, wake, next, model>>

Mark ==
  /\ call = "aborted"
  /\ row = "live"
  /\ row' = "stopped"
  /\ UNCHANGED <<call, charges, stop, reached, late, wake, next, model>>

StopSent ==
  /\ stop = "idle"
  /\ IF row \in {"live", "stopped"}
     THEN /\ row' = "stopped"
          /\ wake' = TRUE
          /\ stop' = "waiting"
          /\ reached' = TRUE
     ELSE /\ stop' = "answered"
          /\ UNCHANGED <<row, wake, reached>>
  /\ UNCHANGED <<call, charges, late, next, model>>

Drop ==
  /\ wake
  /\ wake' = FALSE
  /\ UNCHANGED <<call, row, charges, stop, reached, late, next, model>>

Reconnect ==
  /\ ~wake
  /\ call = "running"
  /\ wake' = TRUE
  /\ UNCHANGED <<call, row, charges, stop, reached, late, next, model>>

Watch ==
  /\ wake
  /\ wake' = FALSE
  /\ call' = IF call = "running" /\ row = "stopped" THEN "aborted" ELSE call
  /\ UNCHANGED <<row, charges, stop, reached, late, next, model>>

Send ==
  /\ call = "running"
  /\ model = "unsent"
  /\ row = "live"
  /\ model' = "sent"
  /\ UNCHANGED <<call, row, charges, stop, reached, late, wake, next>>

Skip ==
  /\ model = "unsent"
  /\ (call = "aborted" \/ (call = "running" /\ row = "stopped"))
  /\ model' = "skipped"
  /\ call' = "closed"
  /\ UNCHANGED <<row, charges, stop, reached, late, wake, next>>

Settle ==
  /\ call \in {"running", "aborted"}
  /\ model = "sent"
  /\ call' = "closed"
  /\ charges' = charges + 1
  /\ UNCHANGED <<row, stop, reached, late, wake, next, model>>

Forget ==
  /\ call = "closed"
  /\ row \in {"live", "stopped"}
  /\ row' = "gone"
  /\ UNCHANGED <<call, charges, stop, reached, late, wake, next, model>>

Late ==
  /\ (stop = "waiting" \/ next = "waiting")
  /\ ~late
  /\ late' = TRUE
  /\ UNCHANGED <<call, row, charges, stop, reached, wake, next, model>>

Answer ==
  /\ stop = "waiting"
  /\ (row = "gone" \/ late)
  /\ stop' = "answered"
  /\ UNCHANGED <<call, row, charges, reached, late, wake, next, model>>

NextAsk ==
  /\ next = "idle"
  /\ call /= "none"
  /\ next' = IF call = "closed" THEN "reserved" ELSE IF row = "stopped" THEN "waiting" ELSE "refused"
  /\ UNCHANGED <<call, row, charges, stop, reached, late, wake, model>>

NextRetry ==
  /\ next = "waiting"
  /\ (row = "gone" \/ late)
  /\ next' = IF call = "closed" THEN "reserved" ELSE "refused"
  /\ UNCHANGED <<call, row, charges, stop, reached, late, wake, model>>

Done ==
  /\ call = "closed"
  /\ row = "gone"
  /\ stop \in {"idle", "answered"}
  /\ next \in {"idle", "reserved", "refused"}
  /\ UNCHANGED vars

Next ==
  \/ Follow
  \/ Leave
  \/ Mark
  \/ StopSent
  \/ Drop
  \/ Reconnect
  \/ Watch
  \/ Send
  \/ Skip
  \/ Settle
  \/ Forget
  \/ Late
  \/ Answer
  \/ NextAsk
  \/ NextRetry
  \/ Done

Spec ==
  /\ Init
  /\ [][Next]_vars
  /\ WF_vars(Reconnect)
  /\ SF_vars(Watch)
  /\ WF_vars(Forget)
  /\ WF_vars(Late)
  /\ WF_vars(Answer)
  /\ WF_vars(NextRetry)

SentOnlyWhileLive == [][(model = "unsent" /\ model' = "sent") => row = "live"]_vars

StopIsNotLost == (row = "stopped" /\ call = "running") ~> (call /= "running")

StopIsAnswered == (stop = "waiting") ~> (stop = "answered")

NextAskIsAnswered == (next = "waiting") ~> (next \in {"reserved", "refused"})

====
