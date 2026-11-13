---- MODULE Element ----
\* A person adds one text box or picture, or removes it. Their undo puts back whether it shows, only while their own edit still shows, and someone else may remove or bring it back in between.
\* An agent's run adds the box or removes it. The run's Undo puts the box back as it was before the run, all or nothing, and is refused once a person changed the box since.
\* A picture's bytes upload after its add, and another device exports the deck only once every added picture's bytes are there.
EXTENDS Naturals

VARIABLES added, removed, typed, held, kind, told, last, run, picture, uploaded, exported
vars == <<added, removed, typed, held, kind, told, last, run, picture, uploaded, exported>>

Bytes == <<picture, uploaded>>

Shown == added /\ ~removed

Init ==
  /\ added = FALSE
  /\ removed = FALSE
  /\ typed = FALSE
  /\ held = "empty"
  /\ kind = "none"
  /\ told = FALSE
  /\ last = "none"
  /\ run = "none"
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
  /\ UNCHANGED <<removed, typed, told, run>>
  /\ UNCHANGED Bytes

AddPicture ==
  /\ ~added
  /\ added' = TRUE
  /\ picture' = TRUE
  /\ held' = "undo"
  /\ kind' = "add"
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<removed, typed, told, run, uploaded>>

Type ==
  /\ Shown
  /\ ~typed
  /\ ~picture
  /\ typed' = TRUE
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, held, kind, told, last, run>>
  /\ UNCHANGED Bytes

Remove ==
  /\ Shown
  /\ run = "none"
  /\ removed' = TRUE
  /\ held' = "undo"
  /\ kind' = "remove"
  /\ last' = "none"
  /\ UNCHANGED <<added, typed, told, run>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* Another tab or person removes the box, or brings a removed one back.
OtherRemove ==
  /\ Shown
  /\ removed' = TRUE
  /\ last' = "none"
  /\ UNCHANGED <<added, typed, held, kind, told, run>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

OtherRestore ==
  /\ added
  /\ removed
  /\ removed' = FALSE
  /\ last' = "none"
  /\ UNCHANGED <<added, typed, held, kind, told, run>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* An agent's run adds the box, or removes a box that shows. A person's typing during the run closes the box to the agent's removal.
AgentAdd ==
  /\ ~added
  /\ run = "none"
  /\ added' = TRUE
  /\ run' = "add"
  /\ last' = "none"
  /\ UNCHANGED <<removed, typed, held, kind, told>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

AgentRemove ==
  /\ Shown
  /\ run \in {"none", "add"}
  /\ ~(run \in {"add", "both"} /\ typed)
  /\ removed' = TRUE
  /\ run' = IF run = "add" THEN "both" ELSE "remove"
  /\ last' = "none"
  /\ UNCHANGED <<added, typed, held, kind, told>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

AgentRemoveRefused ==
  /\ Shown
  /\ run = "add"
  /\ typed
  /\ UNCHANGED vars

\* The run's Undo takes back everything the run did, or nothing: it is refused once a person typed in a box the run added, or removed or brought back a box, so the box no longer shows as the run left it.
RunUndoable == run # "none" /\ Shown = (run = "add") /\ ~(run \in {"add", "both"} /\ typed)

UndoRun ==
  /\ RunUndoable
  /\ removed' = (run # "remove")
  /\ last' = "runundone"
  /\ UNCHANGED <<added, typed, held, kind, told, run>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

UndoRunRefused ==
  /\ run # "none"
  /\ ~RunUndoable
  /\ told' = TRUE
  /\ last' = "none"
  /\ UNCHANGED <<added, removed, typed, held, kind, run>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* What the person's own edit left: the box shows after an add, and is gone after a removal.
EditShows == IF kind = "add" THEN Shown ELSE added /\ removed

Undo ==
  /\ held = "undo"
  /\ run = "none"
  /\ IF EditShows
       THEN /\ removed' = (kind = "add")
            /\ held' = "redo"
            /\ last' = "undone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED removed
  /\ UNCHANGED <<added, typed, kind, run>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

Redo ==
  /\ held = "redo"
  /\ run = "none"
  /\ IF ~EditShows
       THEN /\ removed' = (kind = "remove")
            /\ held' = "undo"
            /\ last' = "redone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED removed
  /\ UNCHANGED <<added, typed, kind, run>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* The device that added the picture sends its bytes.
Upload ==
  /\ picture
  /\ ~uploaded
  /\ uploaded' = TRUE
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, last, run, picture>>

\* Another device exports the deck as it is now. An export describes that moment, so every later step clears it.
ExportElsewhere ==
  /\ ~exported
  /\ (picture => uploaded)
  /\ exported' = TRUE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, last, run, picture, uploaded>>

Next ==
  \/ Add \/ AddPicture \/ Type \/ Remove \/ OtherRemove \/ OtherRestore \/ Undo \/ Redo
  \/ AgentAdd \/ AgentRemove \/ AgentRemoveRefused \/ UndoRun \/ UndoRunRefused
  \/ Upload \/ ExportElsewhere
Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ added \in BOOLEAN
  /\ removed \in BOOLEAN
  /\ typed \in BOOLEAN
  /\ held \in {"empty", "undo", "redo", "dropped"}
  /\ kind \in {"none", "add", "remove"}
  /\ told \in BOOLEAN
  /\ last \in {"none", "undone", "redone", "runundone"}
  /\ run \in {"none", "add", "remove", "both"}
  /\ picture \in BOOLEAN
  /\ uploaded \in BOOLEAN
  /\ exported \in BOOLEAN

RemovedWasAdded == removed => added
TypedWhileShown == typed => added
\* The server admits only edits the device can apply: text lands on a text box, never on a picture.
TypedIsText == typed => ~picture
UploadedWasAdded == uploaded => picture /\ added
ExportHasBytes == exported /\ picture => uploaded

\* An undo shows what showed before the person's edit, and a redo shows the edit again.
UndoShowsBefore ==
  /\ last = "undone" => Shown = (kind = "remove")
  /\ last = "redone" => Shown = (kind = "add")

\* A run's Undo leaves the box as it was before the run: shown after a removal, gone after an add.
RunUndoRestores == last = "runundone" => Shown = (run = "remove")

\* A run's Undo never lands over a change a person made to the box since, and only while the box still shows as the run left it.
RunUndoOnlyUnchanged ==
  [][(last' = "runundone" /\ last # "runundone") => RunUndoable]_vars

\* An undo or redo that changed nothing is always told.
DroppedIsTold == held = "dropped" => told
====
