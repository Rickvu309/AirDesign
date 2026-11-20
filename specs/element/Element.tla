---- MODULE Element ----
\* A person adds one text box or picture, or a copy of another layer, or removes it. Their undo puts back whether it shows, only while their own edit still shows, and someone else may remove or bring it back in between.
\* Someone types in the text box, and another agent's run writes in it once, which the person may undo. A person's undo or redo that would take the box away lands only while the box shows what the person's edit left, so it never hides an agent's text written since.
\* An agent's run adds the box, or a copy, or removes it. The run's Undo puts the box back as it was before the run, all or nothing, and is refused once anyone but the run removed or brought back the box since, the run's own Undo among them, so it lands once.
\* A picture's bytes upload after its add, and another device exports the deck only once every added picture's bytes are there.
EXTENDS Naturals

VARIABLES added, removed, typed, held, kind, told, last, run, fenced, picture, uploaded, exported, agent, shows, left
vars == <<added, removed, typed, held, kind, told, last, run, fenced, picture, uploaded, exported, agent, shows, left>>

Bytes == <<picture, uploaded>>

Text == <<agent, shows, left>>

Shown == added /\ ~removed

\* What each kind of element takes, as the one table of kinds says. A text box takes text; a picture, a shape whose fills hold an image and no text body, does not.
Takes == [box |-> {"box", "text"}, picture |-> {"box", "fills"}]

Kind == IF picture THEN "picture" ELSE "box"

\* Whether an agent's row shows on the box: none yet, landed before the person's add or removal, landed since, or undone with its run. One run writes once.
Agents == {"none", "before", "since", "undone"}

\* What the box's text shows: the text it opened with, the text someone typed, or the agent's text.
Texts == {"opening", "typed", "aira"}

Init ==
  /\ added = FALSE
  /\ removed = FALSE
  /\ typed = FALSE
  /\ held = "empty"
  /\ kind = "none"
  /\ told = FALSE
  /\ last = "none"
  /\ run = "none"
  /\ fenced = FALSE
  /\ picture = FALSE
  /\ uploaded = FALSE
  /\ exported = FALSE
  /\ agent = "none"
  /\ shows = "opening"
  /\ left = "opening"

Add ==
  /\ ~added
  /\ added' = TRUE
  /\ held' = "undo"
  /\ kind' = "add"
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<removed, typed, told, run, fenced>>
  /\ UNCHANGED Text
  /\ UNCHANGED Bytes

AddPicture ==
  /\ ~added
  /\ added' = TRUE
  /\ picture' = TRUE
  /\ held' = "undo"
  /\ kind' = "add"
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<removed, typed, told, run, fenced, uploaded>>
  /\ UNCHANGED Text

\* Someone types in the box: another tab, another person, or this person in a step of their own, which sits above the add in their undo list and is undone before it, so the one undo entry here never covers it.
Type ==
  /\ Shown
  /\ ~typed
  /\ "text" \in Takes[Kind]
  /\ typed' = TRUE
  /\ shows' = "typed"
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, held, kind, told, last, run, fenced, agent, left>>
  /\ UNCHANGED Bytes

Remove ==
  /\ Shown
  /\ run = "none"
  /\ removed' = TRUE
  /\ held' = "undo"
  /\ kind' = "remove"
  /\ last' = "none"
  /\ agent' = IF agent = "since" THEN "before" ELSE agent
  /\ left' = shows
  /\ UNCHANGED <<added, typed, told, run, fenced, shows>>
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* Another tab or person removes the box, or brings a removed one back. Once the run's row is in, that fences the run: its Undo refuses from then on.
Moved == fenced' = (fenced \/ run # "none")

OtherRemove ==
  /\ Shown
  /\ removed' = TRUE
  /\ last' = "none"
  /\ Moved
  /\ UNCHANGED <<added, typed, held, kind, told, run>>
  /\ UNCHANGED Text
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

OtherRestore ==
  /\ added
  /\ removed
  /\ removed' = FALSE
  /\ last' = "none"
  /\ Moved
  /\ UNCHANGED <<added, typed, held, kind, told, run>>
  /\ UNCHANGED Text
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* An agent's run adds the box, or removes a box that shows. A person's typing during the run closes the box to the agent's removal, and the run's Undo ends the run.
AgentAdd ==
  /\ ~added
  /\ run = "none"
  /\ added' = TRUE
  /\ run' = "add"
  /\ last' = "none"
  /\ UNCHANGED <<removed, typed, held, kind, told, fenced>>
  /\ UNCHANGED Text
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

AgentRemove ==
  /\ Shown
  /\ run \in {"none", "add"}
  /\ ~fenced
  /\ agent = "none"
  /\ ~(run \in {"add", "both"} /\ typed)
  /\ removed' = TRUE
  /\ run' = IF run = "add" THEN "both" ELSE "remove"
  /\ last' = "none"
  /\ UNCHANGED <<added, typed, held, kind, told, fenced>>
  /\ UNCHANGED Text
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

AgentRemoveRefused ==
  /\ Shown
  /\ run = "add"
  /\ typed
  /\ UNCHANGED vars

\* Another agent's run writes in a text box that shows and that no one typed in yet: it starts, writes once and stops. Someone may type over its text after.
AgentWrite ==
  /\ Shown
  /\ run = "none"
  /\ agent = "none"
  /\ ~typed
  /\ "text" \in Takes[Kind]
  /\ agent' = "since"
  /\ shows' = "aira"
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, run, fenced, left>>
  /\ UNCHANGED Bytes

\* The person undoes that run, which hides its row whether or not the box shows. The box then shows what was under the row.
UndoWrite ==
  /\ agent \in {"before", "since"}
  /\ agent' = "undone"
  /\ shows' = IF shows = "aira" THEN IF typed THEN "typed" ELSE "opening" ELSE shows
  /\ last' = "none"
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, run, fenced, left>>
  /\ UNCHANGED Bytes

\* The run's Undo takes back everything the run did, or nothing: it is refused once a person typed in a box the run added, once the box no longer shows as the run left it, and once anyone but the run removed or brought back the box since, the run's own Undo among them.
RunUndoable == run # "none" /\ ~fenced /\ Shown = (run = "add") /\ ~(run \in {"add", "both"} /\ typed)

UndoRun ==
  /\ RunUndoable
  /\ removed' = (run # "remove")
  /\ last' = "runundone"
  /\ fenced' = TRUE
  /\ UNCHANGED <<added, typed, held, kind, told, run>>
  /\ UNCHANGED Text
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* A refused run Undo changes nothing in the deck; the person sees the refusal.
UndoRunRefused ==
  /\ run # "none"
  /\ ~RunUndoable
  /\ UNCHANGED vars

\* What the person's own edit left: the box shows after an add, and is gone after a removal.
EditShows == IF kind = "add" THEN Shown ELSE added /\ removed

\* A turn that takes the box away lands only while the box shows what the person's edit left: the undo of an add, and the redo of a removal.
Kept(hides) == hides => shows = left

Undo ==
  /\ held = "undo"
  /\ run = "none"
  /\ IF EditShows /\ Kept(kind = "add")
       THEN /\ removed' = (kind = "add")
            /\ held' = "redo"
            /\ last' = "undone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED removed
  /\ UNCHANGED <<added, typed, kind, run, fenced>>
  /\ UNCHANGED Text
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

Redo ==
  /\ held = "redo"
  /\ run = "none"
  /\ IF ~EditShows /\ Kept(kind = "remove")
       THEN /\ removed' = (kind = "remove")
            /\ held' = "undo"
            /\ last' = "redone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED removed
  /\ UNCHANGED <<added, typed, kind, run, fenced>>
  /\ UNCHANGED Text
  /\ exported' = FALSE
  /\ UNCHANGED Bytes

\* The device that added the picture sends its bytes.
Upload ==
  /\ picture
  /\ ~uploaded
  /\ uploaded' = TRUE
  /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, last, run, fenced, picture>>
  /\ UNCHANGED Text

\* Another device exports the deck as it is now. An export describes that moment, so every later step clears it. Only a picture's bytes hold an export back, so the model exports only a deck whose element is a picture, or before anything was added.
ExportElsewhere ==
  /\ ~exported
  /\ (picture => uploaded)
  /\ (picture \/ ~added)
  /\ exported' = TRUE
  /\ UNCHANGED <<added, removed, typed, held, kind, told, last, run, fenced, picture, uploaded>>
  /\ UNCHANGED Text

Next ==
  \/ Add \/ AddPicture \/ Type \/ Remove \/ OtherRemove \/ OtherRestore \/ Undo \/ Redo
  \/ AgentAdd \/ AgentRemove \/ AgentRemoveRefused \/ UndoRun \/ UndoRunRefused
  \/ AgentWrite \/ UndoWrite
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
  /\ fenced \in BOOLEAN
  /\ picture \in BOOLEAN
  /\ uploaded \in BOOLEAN
  /\ exported \in BOOLEAN
  /\ agent \in Agents
  /\ shows \in Texts
  /\ left \in Texts

RemovedWasAdded == removed => added
TypedWhileShown == typed => added
\* The server admits a row only on a trait the element's kind takes: text lands on a text box, never on a picture.
TraitTakenByKind == typed => "text" \in Takes[Kind]
UploadedWasAdded == uploaded => picture /\ added
ExportHasBytes == exported /\ picture => uploaded
AgentWroteText == agent # "none" => added /\ "text" \in Takes[Kind]

\* An undo shows what showed before the person's edit, and a redo shows the edit again.
UndoShowsBefore ==
  /\ last = "undone" => Shown = (kind = "remove")
  /\ last = "redone" => Shown = (kind = "add")

\* A person's undo or redo that took the box away never hid an agent's row written since the person's edit.
UndoKeepsAgentRow == last \in {"undone", "redone"} /\ ~Shown => agent # "since"

\* A run's Undo leaves the box as it was before the run: shown after a removal, gone after an add.
RunUndoRestores == last = "runundone" => Shown = (run = "remove")

\* A run's Undo never lands over a change a person made to the box since, only while the box still shows as the run left it, and only once.
RunUndoOnlyUnchanged ==
  [][(last' = "runundone" /\ last # "runundone") => RunUndoable]_vars

\* Once a run's Undo landed, no Undo of that run lands again, whatever happens to the box after.
RunUndoOnce ==
  [][(fenced /\ last' = "runundone") => last = "runundone"]_vars

\* An undo or redo that changed nothing is always told.
DroppedIsTold == held = "dropped" => told
====
