---- MODULE Element ----
EXTENDS Naturals

VARIABLES added, removed, typed
vars == <<added, removed, typed>>

Init == added = FALSE /\ removed = FALSE /\ typed = FALSE

Add == ~added /\ added' = TRUE /\ UNCHANGED <<removed, typed>>

Type == added /\ ~removed /\ ~typed /\ typed' = TRUE /\ UNCHANGED <<added, removed>>

Remove == added /\ ~removed /\ removed' = TRUE /\ UNCHANGED <<added, typed>>

Next == Add \/ Type \/ Remove
Spec == Init /\ [][Next]_vars

TypeOK == added \in BOOLEAN /\ removed \in BOOLEAN /\ typed \in BOOLEAN
RemovedWasAdded == removed => added
TypedWhileShown == typed => added
====
