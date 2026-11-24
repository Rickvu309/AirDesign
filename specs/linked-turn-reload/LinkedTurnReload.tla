---- MODULE LinkedTurnReload ----

CONSTANTS PersistIntent, ClobberLater
VARIABLES turn, phase, queue, written, data, variant, tokens, alpha, beta
vars == <<turn, phase, queue, written, data, variant, tokens, alpha, beta>>

Fields == {"data", "variant", "tokens"}
Turns == {"undo-inputs", "redo-inputs", "undo-delete"}
Inputs == [data |-> data, variant |-> variant, tokens |-> tokens]
Goal == IF turn = "undo-inputs" THEN "prior" ELSE "edited"

Init ==
  /\ turn \in Turns /\ phase = "ready"
  /\ queue = "none" /\ written = "none"
  /\ LET initial == IF turn = "undo-inputs" THEN "edited" ELSE "prior"
     IN /\ data = initial /\ variant = initial /\ tokens = initial
  /\ alpha = TRUE /\ beta = (turn # "undo-delete")

Queue ==
  /\ phase = "ready"
  /\ phase' = "queued"
  /\ queue' = IF PersistIntent THEN turn ELSE "writes-only"
  /\ UNCHANGED <<turn, written, data, variant, tokens, alpha, beta>>

Reload ==
  /\ phase = "queued"
  /\ phase' = "reloaded"
  /\ UNCHANGED <<turn, queue, written, data, variant, tokens, alpha, beta>>

OtherDelete ==
  /\ phase \in {"queued", "reloaded"}
  /\ phase' = "stale" /\ alpha' = FALSE
  /\ UNCHANGED <<turn, queue, written, data, variant, tokens, beta>>

OtherInput ==
  /\ turn # "undo-delete"
  /\ phase \in {"queued", "reloaded"}
  /\ \E p \in Fields :
       /\ written' = p
       /\ data' = IF p = "data" THEN "later" ELSE data
       /\ variant' = IF p = "variant" THEN "later" ELSE variant
       /\ tokens' = IF p = "tokens" THEN "later" ELSE tokens
  /\ phase' = "stale"
  /\ UNCHANGED <<turn, queue, alpha, beta>>

Reconnect ==
  /\ phase \in {"queued", "reloaded", "stale"}
  /\ LET rejoin == phase # "stale" \/ queue = turn
         restore(p) == IF rejoin /\ turn # "undo-delete" /\ (written # p \/ ClobberLater)
                       THEN Goal ELSE Inputs[p]
     IN /\ data' = restore("data")
        /\ variant' = restore("variant")
        /\ tokens' = restore("tokens")
        /\ beta' = IF rejoin /\ turn = "undo-delete" THEN TRUE ELSE beta
  /\ phase' = "saved" /\ queue' = "none"
  /\ UNCHANGED <<turn, written, alpha>>

Spec == Init /\ [][Queue \/ Reload \/ OtherDelete \/ OtherInput \/ Reconnect]_vars

RebuildsOwnedWrites ==
  phase = "saved" =>
    IF turn = "undo-delete" THEN beta
    ELSE \A p \in Fields : p # written => Inputs[p] = Goal

KeepsLaterInput == \A p \in Fields : p = written => Inputs[p] = "later"
====
