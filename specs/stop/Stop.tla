---- MODULE Stop ----
EXTENDS Integers

\* One ask runs its model call on server A. A person stops it from server B,
\* or leaves A, or both at once. The ask row in Postgres is the only state the
\* two servers share. B marks the row stopped and notifies; A learns it from a
\* wake, which a dropped listen connection can lose until it reconnects.
\* call is the model call on A: none, running, aborted, or closed once settled.
\* row is the stored ask row: none, live, stopped, or gone once A forgets it.
\* stop is B's stop request; reached says it found the row; late says its wait
\* passed the bound. next is a new ask on B while the turn may still be open.

VARIABLES call, row, charges, stop, reached, late, wake, left, next

vars == <<call, row, charges, stop, reached, late, wake, left, next>>

TypeOK ==
  /\ call \in {"none", "running", "aborted", "closed"}
  /\ row \in {"none", "live", "stopped", "gone"}
  /\ charges \in 0..2
  /\ stop \in {"idle", "waiting", "answered"}
  /\ reached \in BOOLEAN
  /\ late \in BOOLEAN
  /\ wake \in BOOLEAN
  /\ left \in BOOLEAN
  /\ next \in {"idle", "waiting", "reserved", "refused"}

ChargedOnce == charges <= 1

RowOutlivesCall == row = "gone" => call = "closed"

AnsweredAfterClose ==
  (stop = "answered" /\ reached /\ ~late) => (call = "closed" /\ charges = 1)

OneOpenTurn == next = "reserved" => call = "closed"

Init ==
  /\ call = "none"
  /\ row = "none"
  /\ charges = 0
  /\ stop = "idle"
  /\ reached = FALSE
  /\ late = FALSE
  /\ wake = FALSE
  /\ left = FALSE
  /\ next = "idle"

Follow ==
  /\ call = "none"
  /\ call' = "running"
  /\ row' = "live"
  /\ UNCHANGED <<charges, stop, reached, late, wake, left, next>>

Leave ==
  /\ call = "running"
  /\ ~left
  /\ left' = TRUE
  /\ call' = "aborted"
  /\ UNCHANGED <<row, charges, stop, reached, late, wake, next>>

Mark ==
  /\ left
  /\ row = "live"
  /\ row' = "stopped"
  /\ UNCHANGED <<call, charges, stop, reached, late, wake, left, next>>

StopSent ==
  /\ stop = "idle"
  /\ IF row \in {"live", "stopped"}
     THEN /\ row' = "stopped"
          /\ wake' = TRUE
          /\ stop' = "waiting"
          /\ reached' = TRUE
     ELSE /\ stop' = "answered"
          /\ UNCHANGED <<row, wake, reached>>
  /\ UNCHANGED <<call, charges, late, left, next>>

Drop ==
  /\ wake
  /\ wake' = FALSE
  /\ UNCHANGED <<call, row, charges, stop, reached, late, left, next>>

Reconnect ==
  /\ ~wake
  /\ call = "running"
  /\ wake' = TRUE
  /\ UNCHANGED <<call, row, charges, stop, reached, late, left, next>>

Watch ==
  /\ wake
  /\ wake' = FALSE
  /\ call' = IF call = "running" /\ row = "stopped" THEN "aborted" ELSE call
  /\ UNCHANGED <<row, charges, stop, reached, late, left, next>>

Settle ==
  /\ call \in {"running", "aborted"}
  /\ call' = "closed"
  /\ charges' = charges + 1
  /\ UNCHANGED <<row, stop, reached, late, wake, left, next>>

Forget ==
  /\ call = "closed"
  /\ row \in {"live", "stopped"}
  /\ row' = "gone"
  /\ UNCHANGED <<call, charges, stop, reached, late, wake, left, next>>

Late ==
  /\ (stop = "waiting" \/ next = "waiting")
  /\ ~late
  /\ late' = TRUE
  /\ UNCHANGED <<call, row, charges, stop, reached, wake, left, next>>

Answer ==
  /\ stop = "waiting"
  /\ (row = "gone" \/ late)
  /\ stop' = "answered"
  /\ UNCHANGED <<call, row, charges, reached, late, wake, left, next>>

NextAsk ==
  /\ next = "idle"
  /\ call /= "none"
  /\ next' = IF call = "closed" THEN "reserved" ELSE IF row = "stopped" THEN "waiting" ELSE "refused"
  /\ UNCHANGED <<call, row, charges, stop, reached, late, wake, left>>

NextRetry ==
  /\ next = "waiting"
  /\ (row = "gone" \/ late)
  /\ next' = IF call = "closed" THEN "reserved" ELSE "refused"
  /\ UNCHANGED <<call, row, charges, stop, reached, late, wake, left>>

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

StopIsNotLost == (row = "stopped" /\ call = "running") ~> (call /= "running")

StopIsAnswered == (stop = "waiting") ~> (stop = "answered")

NextAskIsAnswered == (next = "waiting") ~> (next \in {"reserved", "refused"})

====
