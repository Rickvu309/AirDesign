---- MODULE MultiStep ----
\* A person chooses two elements, A and B, with Shift+click and presses Delete once. One undo step names every element that went.
\* The device refuses to delete an element with an animation, so the Delete deletes what it can, says what it could not, and its step names only what went.
\* Undo brings back every element the step names that is still gone. Redo deletes again every one that shows, skips one that is already gone, and lands on none while any shows an agent's row written since the step.
\* Each turn leaves a step that names only the elements it turned, so a later turn never brings back an element an agent deleted.
\* An agent makes one change: it deletes an element that has no animation, or writes in one that shows.
\* Each set of elements is kept as one flag per element, so the replay reads every state as plain values.
EXTENDS Naturals

Elements == {"A", "B"}

VARIABLES shownA, shownB, lockedA, wentA, wentB, namedA, namedB, refusedA, agent, agentOn, since, held, told, last, turns, wiped

vars == <<shownA, shownB, lockedA, wentA, wentB, namedA, namedB, refusedA, agent, agentOn, since, held, told, last, turns, wiped>>

Set(a, b) == {e \in Elements : (e = "A" /\ a) \/ (e = "B" /\ b)}

present == Set(shownA, shownB)
went == Set(wentA, wentB)
named == Set(namedA, namedB)
refused == Set(refusedA, FALSE)

\* Only A may have an animation in the file. The file decides it, and nothing in the model changes it.
locked == Set(lockedA, FALSE)

agentGone == IF agent = "delete" THEN {agentOn} ELSE {}

\* Whether an agent's row shows on an element: none, written before the person's Delete, or written since it.
Wrote(e) == IF agent = "write" /\ agentOn = e THEN IF since THEN "since" ELSE "before" ELSE "none"

PresentIs(s) == shownA' = ("A" \in s) /\ shownB' = ("B" \in s)
WentIs(s) == wentA' = ("A" \in s) /\ wentB' = ("B" \in s)
NamedIs(s) == namedA' = ("A" \in s) /\ namedB' = ("B" \in s)

TypeOK ==
  /\ shownA \in BOOLEAN /\ shownB \in BOOLEAN /\ lockedA \in BOOLEAN
  /\ wentA \in BOOLEAN /\ wentB \in BOOLEAN /\ namedA \in BOOLEAN /\ namedB \in BOOLEAN /\ refusedA \in BOOLEAN
  /\ agent \in {"idle", "delete", "write"}
  /\ agentOn \in {"none", "A", "B"}
  /\ since \in BOOLEAN
  /\ held \in {"empty", "undo", "redo", "dropped"}
  /\ told \in BOOLEAN
  /\ last \in {"none", "deleted", "undone", "redone"}
  /\ turns \in 0..3
  /\ wiped \in BOOLEAN

Init ==
  /\ shownA = TRUE /\ shownB = TRUE
  /\ lockedA \in BOOLEAN
  /\ wentA = FALSE /\ wentB = FALSE /\ namedA = FALSE /\ namedB = FALSE /\ refusedA = FALSE
  /\ agent = "idle"
  /\ agentOn = "none"
  /\ since = FALSE
  /\ held = "empty"
  /\ told = FALSE
  /\ last = "none"
  /\ turns = 0
  /\ wiped = FALSE

\* The person presses Delete with every element that shows chosen: the selection let go of one an agent deleted. It deletes each one the device takes, says each one it refused, and records one step naming what went, or none when nothing went.
Delete ==
  /\ held = "empty"
  /\ ~refusedA
  /\ present # {}
  /\ WentIs(present \ locked)
  /\ NamedIs(present \ locked)
  /\ refusedA' = ("A" \in present \cap locked)
  /\ PresentIs(present \cap locked)
  /\ held' = IF present \ locked = {} THEN "empty" ELSE "undo"
  /\ last' = "deleted"
  /\ UNCHANGED <<lockedA, agent, agentOn, since, told, turns, wiped>>

\* An agent deletes an element that shows. The device refuses it one with an animation, as it refuses the person.
AgentDelete(e) ==
  /\ agent = "idle"
  /\ e \in present \ locked
  /\ PresentIs(present \ {e})
  /\ agent' = "delete"
  /\ agentOn' = e
  /\ last' = "none"
  /\ UNCHANGED <<lockedA, wentA, wentB, namedA, namedB, refusedA, since, held, told, turns, wiped>>

\* An agent writes in an element that shows. Before the Delete its row is part of what the person deleted.
AgentWrite(e) ==
  /\ agent = "idle"
  /\ e \in present
  /\ agent' = "write"
  /\ agentOn' = e
  /\ since' = (held # "empty")
  /\ last' = "none"
  /\ UNCHANGED <<shownA, shownB, lockedA, wentA, wentB, namedA, namedB, refusedA, held, told, turns, wiped>>

Dropped ==
  /\ held' = "dropped"
  /\ told' = TRUE
  /\ last' = "none"
  /\ UNCHANGED <<shownA, shownB, namedA, namedB, wiped>>

\* Undo brings back every element the step names that is still gone, and the step then names only those.
Undo ==
  /\ held = "undo"
  /\ turns < 3
  /\ turns' = turns + 1
  /\ IF named \ present # {}
       THEN /\ PresentIs(present \cup (named \ present))
            /\ NamedIs(named \ present)
            /\ held' = "redo"
            /\ last' = "undone"
            /\ UNCHANGED <<told, wiped>>
       ELSE Dropped
  /\ UNCHANGED <<lockedA, wentA, wentB, refusedA, agent, agentOn, since>>

\* Redo deletes every element the step names that shows, skips one already gone, and lands on none while any of them shows an agent's row written since the step. The step then names only what it deleted.
Redo ==
  /\ held = "redo"
  /\ turns < 3
  /\ turns' = turns + 1
  /\ IF named \cap present # {} /\ \A e \in named \cap present : Wrote(e) # "since"
       THEN /\ PresentIs(present \ named)
            /\ NamedIs(named \cap present)
            /\ wiped' = (wiped \/ \E e \in named \cap present : Wrote(e) = "since")
            /\ held' = "undo"
            /\ last' = "redone"
            /\ UNCHANGED told
       ELSE Dropped
  /\ UNCHANGED <<lockedA, wentA, wentB, refusedA, agent, agentOn, since>>

Next ==
  \/ Delete
  \/ \E e \in Elements : AgentDelete(e) \/ AgentWrite(e)
  \/ Undo
  \/ Redo

Spec == Init /\ [][Next]_vars

\* One key press records one step, and a step names at least one element.
OneStep == held \in {"undo", "redo"} => named # {}

\* The step names only elements the Delete deleted, never one the device refused.
StepNamesWent == named \subseteq went /\ went \cap locked = {} /\ refused \subseteq locked

\* Right after the Delete, every chosen element still on the slide is one the person was told could not be deleted.
SaysRefused == last = "deleted" => present = refused

\* An undo brings back every element the Delete deleted that no agent deleted, and a redo leaves none of them.
StepTurnsWhole ==
  /\ last = "undone" => went \ agentGone \subseteq present
  /\ last = "redone" => went \cap present = {}

\* A person's redo never deletes an element that shows an agent's row written since the step.
NeverWipesAgent == wiped = FALSE

\* An element an agent deleted stays gone: no undo or redo of the person brings it back.
AgentGoneStays == agentGone \cap present = {}

\* An undo or redo that changed nothing is always told.
DroppedIsTold == held = "dropped" => told

====
