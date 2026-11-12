---- MODULE PersonUndo ----
\* A person's undo is a person edit back to what showed before their edit. It lands only while their edit still shows, so it never covers an agent's later row and never hides one.
EXTENDS Integers

VARIABLES personRows, agentRow, agentAt, phase, readAt, guarded, held, told, last, turns, covered

vars == <<personRows, agentRow, agentAt, phase, readAt, guarded, held, told, last, turns, covered>>

\* Person rows alternate between the person's text and the text before it, starting with the person's text.
PersonShown == IF personRows % 2 = 1 THEN "mine" ELSE "file"

AgentOnTop == agentRow = "shown" /\ agentAt = personRows

Shown == IF AgentOnTop THEN "aira" ELSE PersonShown

TypeOK ==
  /\ personRows \in 0..4
  /\ agentRow \in {"none", "shown", "hidden"}
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
  /\ personRows = 0
  /\ agentRow = "none"
  /\ agentAt = -1
  /\ phase = "idle"
  /\ readAt = -1
  /\ guarded = FALSE
  /\ held = "empty"
  /\ told = FALSE
  /\ last = "none"
  /\ turns = 0
  /\ covered = FALSE

\* A person row lands on top. During a run it guards the element from the run.
PersonLands ==
  /\ personRows' = personRows + 1
  /\ guarded' = (guarded \/ phase = "running")

\* An undo or redo marks the element covered if it lands over an agent row that shows.
TurnLands ==
  /\ PersonLands
  /\ covered' = (covered \/ AgentOnTop)

PersonEdit ==
  /\ held = "empty"
  /\ PersonLands
  /\ held' = "undo"
  /\ UNCHANGED <<agentRow, agentAt, phase, readAt, told, last, turns, covered>>

AgentStart ==
  /\ phase = "idle"
  /\ phase' = "running"
  /\ readAt' = personRows
  /\ UNCHANGED <<personRows, agentRow, agentAt, guarded, held, told, last, turns, covered>>

AgentWrite ==
  /\ phase = "running"
  /\ ~guarded
  /\ agentRow = "none"
  /\ agentRow' = "shown"
  /\ agentAt' = personRows
  /\ last' = "none"
  /\ UNCHANGED <<personRows, phase, readAt, guarded, held, told, turns, covered>>

AgentStop ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ UNCHANGED <<personRows, agentRow, agentAt, readAt, guarded, held, told, last, turns, covered>>

\* The run's own Undo hides only the run's row.
AgentUndo ==
  /\ phase = "stopped"
  /\ phase' = "undone"
  /\ agentRow' = IF agentRow = "shown" THEN "hidden" ELSE agentRow
  /\ UNCHANGED <<personRows, agentAt, readAt, guarded, held, told, last, turns, covered>>

\* Undo lands the text before the edit while the person's text still shows. Otherwise nothing changes, the edit leaves the undo list, and the person is told.
Undo ==
  /\ held = "undo"
  /\ turns < 3
  /\ turns' = turns + 1
  /\ IF Shown = "mine"
       THEN /\ TurnLands
            /\ held' = "redo"
            /\ last' = "undone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED <<personRows, guarded, covered>>
  /\ UNCHANGED <<agentRow, agentAt, phase, readAt>>

\* Redo lands the person's text again while the text before still shows. Otherwise nothing changes and the person is told.
Redo ==
  /\ held = "redo"
  /\ turns < 3
  /\ turns' = turns + 1
  /\ IF Shown = "file"
       THEN /\ TurnLands
            /\ held' = "undo"
            /\ last' = "redone"
            /\ UNCHANGED told
       ELSE /\ held' = "dropped"
            /\ told' = TRUE
            /\ last' = "none"
            /\ UNCHANGED <<personRows, guarded, covered>>
  /\ UNCHANGED <<agentRow, agentAt, phase, readAt>>

Next == PersonEdit \/ AgentStart \/ AgentWrite \/ AgentStop \/ AgentUndo \/ Undo \/ Redo

Spec == Init /\ [][Next]_vars

\* An undo or redo shows exactly the text it went back to.
UndoShowsBefore ==
  /\ last = "undone" => Shown = "file"
  /\ last = "redone" => Shown = "mine"

\* A person's undo never lands over an agent row that shows.
NeverCoversAgent == covered = FALSE

\* Only the run's own Undo hides the run's row.
AgentRowStays == agentRow = "hidden" => phase = "undone"

\* An undo that changed nothing is always told.
DroppedIsTold == held = "dropped" => told

====
