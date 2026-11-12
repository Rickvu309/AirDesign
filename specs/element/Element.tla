---- MODULE Element ----
\* A person adds one text box or removes it. Their undo puts back whether it shows, only while their own edit still shows, and someone else may remove or bring it back in between.
EXTENDS Naturals

VARIABLES added, removed, typed, held, kind, told, last
vars == <<added, removed, typed, held, kind, told, last>>

Shown == added /\ ~removed

Init ==
  /\ added = FALSE
  /\ removed = FALSE
  /\ typed = FALSE
  /\ held = "empty"
  /\ kind = "none"
  /\ told = FALSE
  /\ last = "none"

Add ==
  /\ ~added
  /\ added' = TRUE
  /\ held' = "undo"
  /\ kind' = "add"
  /\ last' = "none"
  /\ UNCHANGED <<removed, typed, told>>

Type == Shown /\ ~typed /\ typed' = TRUE /\ UNCHANGED <<added, removed, held, kind, told, last>>

Remove ==
  /\ Shown
  /\ removed' = TRUE
  /\ held' = "undo"
  /\ kind' = "remove"
  /\ last' = "none"
  /\ UNCHANGED <<added, typed, told>>

\* Another tab or person removes the box, or brings a removed one back.
OtherRemove == Shown /\ removed' = TRUE /\ last' = "none" /\ UNCHANGED <<added, typed, held, kind, told>>

OtherRestore == added /\ removed /\ removed' = FALSE /\ last' = "none" /\ UNCHANGED <<added, typed, held, kind, told>>

\* What the person's own edit left: the box shows after an add, and is gone after a removal.
EditShows == IF kind = "add" THEN Shown ELSE added /\ removed

Undo ==
  /\ held = "undo"
  /\ IF EditShows
       THEN /\ removed' = (kind = "add")
            /\ held' = "redo"
            /\ last' = "undone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED removed
  /\ UNCHANGED <<added, typed, kind>>

Redo ==
  /\ held = "redo"
  /\ IF ~EditShows
       THEN /\ removed' = (kind = "remove")
            /\ held' = "undo"
            /\ last' = "redone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED removed
  /\ UNCHANGED <<added, typed, kind>>

Next == Add \/ Type \/ Remove \/ OtherRemove \/ OtherRestore \/ Undo \/ Redo
Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ added \in BOOLEAN
  /\ removed \in BOOLEAN
  /\ typed \in BOOLEAN
  /\ held \in {"empty", "undo", "redo", "dropped"}
  /\ kind \in {"none", "add", "remove"}
  /\ told \in BOOLEAN
  /\ last \in {"none", "undone", "redone"}

RemovedWasAdded == removed => added
TypedWhileShown == typed => added

\* An undo shows what showed before the person's edit, and a redo shows the edit again.
UndoShowsBefore ==
  /\ last = "undone" => Shown = (kind = "remove")
  /\ last = "redone" => Shown = (kind = "add")

\* An undo or redo that changed nothing is always told.
DroppedIsTold == held = "dropped" => told
====
