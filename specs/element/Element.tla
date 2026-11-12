---- MODULE Element ----
\* A person adds one text box or picture, or removes it. Their undo puts back whether it shows, only while their own edit still shows, and someone else may remove or bring it back in between.
\* A picture's bytes upload after its add, and another device exports the deck only once every added picture's bytes are there.
EXTENDS Naturals

VARIABLES added, removed, typed, held, kind, told, last, picture, uploaded, exported
vars == <<added, removed, typed, held, kind, told, last, picture, uploaded, exported>>

Shown == added /\ ~removed

Init ==
  /\ added = FALSE
  /\ removed = FALSE
  /\ typed = FALSE
  /\ held = "empty"
  /\ kind = "none"
  /\ told = FALSE
  /\ last = "none"
  /\ picture = FALSE
  /\ uploaded = FALSE
  /\ exported = FALSE

Add ==
  /\ ~added
  /\ added' = TRUE
  /\ held' = "undo"
  /\ kind' = "add"
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<removed, typed, told, picture, uploaded>>

AddPicture ==
  /\ ~added
  /\ added' = TRUE
  /\ picture' = TRUE
  /\ held' = "undo"
  /\ kind' = "add"
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<removed, typed, told, uploaded>>

Type ==
  /\ Shown
  /\ ~typed
  /\ ~picture
  /\ typed' = TRUE
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, held, kind, told, last, picture, uploaded>>

Remove ==
  /\ Shown
  /\ removed' = TRUE
  /\ held' = "undo"
  /\ kind' = "remove"
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<added, typed, told, picture, uploaded>>

\* Another tab or person removes the element, or brings a removed one back.
OtherRemove ==
  /\ Shown
  /\ removed' = TRUE
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<added, typed, held, kind, told, picture, uploaded>>

OtherRestore ==
  /\ added
  /\ removed
  /\ removed' = FALSE
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<added, typed, held, kind, told, picture, uploaded>>

\* The device that added the picture sends its bytes.
Upload ==
  /\ picture
  /\ ~uploaded
  /\ uploaded' = TRUE
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, last, picture>>

\* Another device exports the deck as it is now. An export describes that moment, so every later step clears it.
ExportElsewhere ==
  /\ ~exported
  /\ (picture => uploaded)
  /\ exported' = TRUE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, last, picture, uploaded>>

\* What the person's own edit left: the element shows after an add, and is gone after a removal.
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
  /\ exported' = FALSE
  /\ UNCHANGED <<added, typed, kind, picture, uploaded>>

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
  /\ exported' = FALSE
  /\ UNCHANGED <<added, typed, kind, picture, uploaded>>

Next ==
  \/ Add \/ AddPicture \/ Type \/ Remove \/ OtherRemove \/ OtherRestore \/ Undo \/ Redo
  \/ Upload \/ ExportElsewhere
Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ added \in BOOLEAN
  /\ removed \in BOOLEAN
  /\ typed \in BOOLEAN
  /\ held \in {"empty", "undo", "redo", "dropped"}
  /\ kind \in {"none", "add", "remove"}
  /\ told \in BOOLEAN
  /\ last \in {"none", "undone", "redone"}
  /\ picture \in BOOLEAN
  /\ uploaded \in BOOLEAN
  /\ exported \in BOOLEAN

RemovedWasAdded == removed => added
TypedWhileShown == typed => added
TypedIsText == typed => ~picture
UploadedWasAdded == uploaded => picture /\ added
ExportHasBytes == exported /\ picture => uploaded

\* An undo shows what showed before the person's edit, and a redo shows the edit again.
UndoShowsBefore ==
  /\ last = "undone" => Shown = (kind = "remove")
  /\ last = "redone" => Shown = (kind = "add")

\* An undo or redo that changed nothing is always told.
DroppedIsTold == held = "dropped" => told
====
