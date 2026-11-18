---- MODULE PersonUndo ----
\* A person's undo is one step: a person edit back to what showed before, on every element the step named, and only on the fields it named.
\* The step names the text of two elements, A and B. An agent's run writes one row on A, on its text or on its box.
\* The step lands only while each field it names still shows the person's edit, so it never covers an agent's row on such a field, never hides one, and leaves A's box as it is.
\* The replay runs it twice: on the text of two text boxes, and on the crop of two photos, where the run's other field is the recolour of A's image, a field of the same fills.
EXTENDS Integers

VARIABLES rowsA, rowsB, boxA, agentRow, agentField, agentAt, phase, readAt, guarded, held, told, last, turns, covered

vars == <<rowsA, rowsB, boxA, agentRow, agentField, agentAt, phase, readAt, guarded, held, told, last, turns, covered>>

\* Person rows on each element alternate between the person's text and the text before it, starting with the person's text.
PersonShown(rows) == IF rows % 2 = 1 THEN "mine" ELSE "file"

AgentTextOnTop == agentRow = "shown" /\ agentField = "text" /\ agentAt = rowsA

ShownA == IF AgentTextOnTop THEN "aira" ELSE PersonShown(rowsA)

ShownB == PersonShown(rowsB)

StepShows(text) == ShownA = text /\ ShownB = text

TypeOK ==
  /\ rowsA \in 0..4
  /\ rowsB \in 0..4
  /\ boxA \in {"file", "aira"}
  /\ agentRow \in {"none", "shown", "hidden"}
  /\ agentField \in {"none", "text", "box"}
  /\ agentAt \in -1..4
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ readAt \in -1..4
  /\ guarded \in BOOLEAN
  /\ held \in {"empty", "undo", "redo", "dropped"}
  /\ told \in BOOLEAN
  /\ last \in {"none", "undone", "redone"}
  /\ turns \in 0..3
  /\ covered \in BOOLEAN

Init ==
  /\ rowsA = 0
  /\ rowsB = 0
  /\ boxA = "file"
  /\ agentRow = "none"
  /\ agentField = "none"
  /\ agentAt = -1
  /\ phase = "idle"
  /\ readAt = -1
  /\ guarded = FALSE
  /\ held = "empty"
  /\ told = FALSE
  /\ last = "none"
  /\ turns = 0
  /\ covered = FALSE

\* A person step lands one row on the text of each element. During a run it guards A from the run.
PersonLands ==
  /\ rowsA' = rowsA + 1
  /\ rowsB' = rowsB + 1
  /\ guarded' = (guarded \/ phase = "running")

\* An undo or redo marks the element covered if it lands over an agent row that shows on a field it names.
TurnLands ==
  /\ PersonLands
  /\ covered' = (covered \/ AgentTextOnTop)

PersonEdit ==
  /\ held = "empty"
  /\ PersonLands
  /\ held' = "undo"
  /\ UNCHANGED <<boxA, agentRow, agentField, agentAt, phase, readAt, told, last, turns, covered>>

AgentStart ==
  /\ phase = "idle"
  /\ phase' = "running"
  /\ readAt' = rowsA
  /\ UNCHANGED <<rowsA, rowsB, boxA, agentRow, agentField, agentAt, guarded, held, told, last, turns, covered>>

\* The run writes A's text.
AgentWrite ==
  /\ phase = "running"
  /\ ~guarded
  /\ agentRow = "none"
  /\ agentRow' = "shown"
  /\ agentField' = "text"
  /\ agentAt' = rowsA
  /\ last' = "none"
  /\ UNCHANGED <<rowsA, rowsB, boxA, phase, readAt, guarded, held, told, turns, covered>>

\* The run moves A's box instead, a field the person's step does not name.
AgentMove ==
  /\ phase = "running"
  /\ ~guarded
  /\ agentRow = "none"
  /\ agentRow' = "shown"
  /\ agentField' = "box"
  /\ agentAt' = rowsA
  /\ boxA' = "aira"
  /\ last' = "none"
  /\ UNCHANGED <<rowsA, rowsB, phase, readAt, guarded, held, told, turns, covered>>

AgentStop ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ UNCHANGED <<rowsA, rowsB, boxA, agentRow, agentField, agentAt, readAt, guarded, held, told, last, turns, covered>>

\* The run's own Undo hides only the run's row.
AgentUndo ==
  /\ phase = "stopped"
  /\ phase' = "undone"
  /\ agentRow' = IF agentRow = "shown" THEN "hidden" ELSE agentRow
  /\ boxA' = "file"
  /\ UNCHANGED <<rowsA, rowsB, agentField, agentAt, readAt, guarded, held, told, last, turns, covered>>

\* Undo lands the text before the step on both elements while both still show the person's text. Otherwise nothing changes, the step leaves the undo list, and the person is told.
Undo ==
  /\ held = "undo"
  /\ turns < 3
  /\ turns' = turns + 1
  /\ IF StepShows("mine")
       THEN /\ TurnLands
            /\ held' = "redo"
            /\ last' = "undone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED <<rowsA, rowsB, guarded, covered>>
  /\ UNCHANGED <<boxA, agentRow, agentField, agentAt, phase, readAt>>

\* Redo lands the person's text again on both elements while both still show the text before. Otherwise nothing changes and the person is told.
Redo ==
  /\ held = "redo"
  /\ turns < 3
  /\ turns' = turns + 1
  /\ IF StepShows("file")
       THEN /\ TurnLands
            /\ held' = "undo"
            /\ last' = "redone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED <<rowsA, rowsB, guarded, covered>>
  /\ UNCHANGED <<boxA, agentRow, agentField, agentAt, phase, readAt>>

Next == PersonEdit \/ AgentStart \/ AgentWrite \/ AgentMove \/ AgentStop \/ AgentUndo \/ Undo \/ Redo

Spec == Init /\ [][Next]_vars

\* An undo or redo shows exactly the text it went back to, on every element of the step.
UndoShowsBefore ==
  /\ last = "undone" => StepShows("file")
  /\ last = "redone" => StepShows("mine")

\* A person's undo never lands over an agent row that shows on a field the undo names.
NeverCoversAgent == covered = FALSE

\* Only the run's own Undo hides the run's row.
AgentRowStays == agentRow = "hidden" => phase = "undone"

\* An undo that changed nothing is always told.
DroppedIsTold == held = "dropped" => told

\* A field the step does not name keeps what showed: A's box is the agent's while its row shows, and the file's otherwise.
UndoKeepsOtherFields == boxA = IF agentRow = "shown" /\ agentField = "box" THEN "aira" ELSE "file"

\* A step lands on every element it names or on none.
StepTurnsWhole == rowsA = rowsB

====
