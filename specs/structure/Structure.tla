---- MODULE Structure ----
EXTENDS Integers

VARIABLES
  nodeA,
  nodeB,
  record,
  recordNode,
  beforeA,
  beforeB,
  didRead,
  snapA,
  snapB,
  storedA,
  storedB,
  lastKind,
  personBefore,
  personAfter,
  agent,
  prevBefore,
  prevAfter,
  prevAgent,
  phase,
  runId,
  readId,
  grouped,
  maker,
  offset,
  inside,
  own,
  seen,
  childMoved,
  touched,
  groupKind

old == <<
  nodeA, nodeB, record, recordNode, beforeA, beforeB, didRead, snapA, snapB, storedA, storedB,
  lastKind, personBefore, personAfter, agent, prevBefore, prevAfter, prevAgent, phase, runId, readId
>>

tree == <<grouped, maker, offset, inside, own, seen, childMoved, touched, groupKind>>

vars == <<old, tree>>

TypeOK ==
  /\ nodeA \in BOOLEAN
  /\ nodeB \in BOOLEAN
  /\ record \in {"none", "add", "remove"}
  /\ recordNode \in {"none", "a", "b"}
  /\ beforeA \in BOOLEAN
  /\ beforeB \in BOOLEAN
  /\ didRead \in BOOLEAN
  /\ snapA \in BOOLEAN
  /\ snapB \in BOOLEAN
  /\ storedA \in BOOLEAN
  /\ storedB \in BOOLEAN
  /\ lastKind \in {"none", "read", "absent", "other", "fenced"}
  /\ personBefore \in {0, 1}
  /\ personAfter \in {0, 1}
  /\ agent \in {0, 1}
  /\ prevBefore \in {-1, 0, 1}
  /\ prevAfter \in {-1, 0, 1}
  /\ prevAgent \in {-1, 0, 1}
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ runId \in {"s", "t"}
  /\ readId \in {"s", "t"}
  /\ grouped \in {"none", "formed", "dissolved"}
  /\ maker \in {"none", "person", "agent"}
  /\ offset \in {0, 1}
  /\ inside \in 0..2
  /\ own \in 0..3
  /\ seen \in 0..3
  /\ childMoved \in {0, 1}
  /\ touched \in BOOLEAN
  /\ groupKind \in {"none", "group", "move", "child", "ungroup", "regroup", "runUndo", "refused"}

accepted == readId = runId /\ phase \in {"stopped", "undone"}

Init ==
  /\ nodeA = TRUE
  /\ nodeB = FALSE
  /\ record = "none"
  /\ recordNode = "none"
  /\ beforeA = TRUE
  /\ beforeB = FALSE
  /\ didRead = FALSE
  /\ snapA = TRUE
  /\ snapB = FALSE
  /\ storedA = TRUE
  /\ storedB = FALSE
  /\ lastKind = "none"
  /\ personBefore = 0
  /\ personAfter = 0
  /\ agent = 0
  /\ prevBefore = -1
  /\ prevAfter = -1
  /\ prevAgent = -1
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ runId \in {"s", "t"}
  /\ readId \in {"s", "t"}
  /\ grouped = "none"
  /\ maker = "none"
  /\ offset = 0
  /\ inside = 0
  /\ own = 0
  /\ seen = 0
  /\ childMoved = 0
  /\ touched = FALSE
  /\ groupKind = "none"

Ungrouped == grouped = "none" /\ groupKind = "none"

Quiet ==
  /\ record = "none"
  /\ lastKind = "none"
  /\ phase = "idle"
  /\ runId = "s"
  /\ readId = "s"

Shown == IF grouped = "formed" THEN inside + offset ELSE own

AddNode ==
  /\ Ungrouped
  /\ nodeB = FALSE
  /\ nodeB' = TRUE
  /\ record' = "add"
  /\ recordNode' = "b"
  /\ beforeA' = nodeA
  /\ beforeB' = nodeB
  /\ lastKind' = "other"
  /\ prevBefore' = -1
  /\ prevAfter' = -1
  /\ prevAgent' = -1
  /\ UNCHANGED <<nodeA, didRead, snapA, snapB, storedA, storedB, personBefore, personAfter, agent, phase, runId, readId>>
  /\ UNCHANGED tree

RemoveNode ==
  /\ Ungrouped
  /\ nodeB = TRUE
  /\ nodeB' = FALSE
  /\ record' = "remove"
  /\ recordNode' = "b"
  /\ beforeA' = nodeA
  /\ beforeB' = nodeB
  /\ lastKind' = "other"
  /\ prevBefore' = -1
  /\ prevAfter' = -1
  /\ prevAgent' = -1
  /\ UNCHANGED <<nodeA, didRead, snapA, snapB, storedA, storedB, personBefore, personAfter, agent, phase, runId, readId>>
  /\ UNCHANGED tree

SecondRunReads ==
  /\ Ungrouped
  /\ nodeA = TRUE
  /\ \/ /\ accepted
        /\ didRead' = TRUE
        /\ snapA' = nodeA
        /\ snapB' = nodeB
        /\ storedA' = nodeA
        /\ storedB' = nodeB
        /\ lastKind' = "read"
     \/ /\ ~accepted
        /\ lastKind' = "fenced"
        /\ UNCHANGED <<didRead, snapA, snapB, storedA, storedB>>
  /\ UNCHANGED <<nodeA, nodeB, record, recordNode, beforeA, beforeB, personBefore, personAfter, agent, prevBefore, prevAfter, prevAgent, phase, runId, readId>>
  /\ UNCHANGED tree

NameAbsent ==
  /\ Ungrouped
  /\ nodeB = FALSE
  /\ lastKind' = "absent"
  /\ prevBefore' = personBefore
  /\ prevAfter' = personAfter
  /\ prevAgent' = agent
  /\ UNCHANGED <<nodeA, nodeB, record, recordNode, beforeA, beforeB, didRead, snapA, snapB, storedA, storedB, personBefore, personAfter, agent, phase, runId, readId>>
  /\ UNCHANGED tree

GroupBy(by) ==
  /\ Quiet
  /\ grouped = "none"
  /\ grouped' = "formed"
  /\ maker' = by
  /\ inside' = own
  /\ offset' = 0
  /\ touched' = FALSE
  /\ groupKind' = "group"
  /\ UNCHANGED <<own, seen, childMoved>>
  /\ UNCHANGED old

GroupPerson == GroupBy("person")

GroupAgent == GroupBy("agent")

MoveGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ offset = 0
  /\ offset' = 1
  /\ seen' = seen + 1
  /\ touched' = TRUE
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, inside, own, childMoved>>
  /\ UNCHANGED old

UndoMoveGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ offset = 1
  /\ offset' = 0
  /\ seen' = seen - 1
  /\ touched' = TRUE
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, inside, own, childMoved>>
  /\ UNCHANGED old

MoveChild ==
  /\ Quiet
  /\ grouped # "formed"
  /\ childMoved = 0
  /\ own < 3
  /\ own' = own + 1
  /\ seen' = seen + 1
  /\ childMoved' = 1
  /\ groupKind' = "child"
  /\ UNCHANGED <<grouped, maker, offset, inside, touched>>
  /\ UNCHANGED old

UndoMoveChild ==
  /\ Quiet
  /\ grouped # "formed"
  /\ childMoved = 1
  /\ own' = own - 1
  /\ seen' = seen - 1
  /\ childMoved' = 0
  /\ groupKind' = "child"
  /\ UNCHANGED <<grouped, maker, offset, inside, touched>>
  /\ UNCHANGED old

Ungroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ grouped' = "dissolved"
  /\ own' = inside + offset
  /\ childMoved' = 0
  /\ groupKind' = "ungroup"
  /\ UNCHANGED <<maker, offset, inside, seen, touched>>
  /\ UNCHANGED old

Regroup ==
  /\ Quiet
  /\ grouped = "dissolved"
  /\ maker # "none"
  /\ childMoved = 0
  /\ grouped' = "formed"
  /\ groupKind' = "regroup"
  /\ UNCHANGED <<maker, offset, inside, own, seen, childMoved, touched>>
  /\ UNCHANGED old

RunUndo ==
  /\ Quiet
  /\ grouped = "formed"
  /\ maker = "agent"
  /\ \/ /\ ~touched
        /\ own = inside
        /\ grouped' = "dissolved"
        /\ maker' = "none"
        /\ groupKind' = "runUndo"
     \/ /\ touched \/ own # inside
        /\ groupKind' = "refused"
        /\ UNCHANGED <<grouped, maker>>
  /\ UNCHANGED <<offset, inside, own, seen, childMoved, touched>>
  /\ UNCHANGED old

Next ==
  \/ AddNode
  \/ RemoveNode
  \/ SecondRunReads
  \/ NameAbsent
  \/ GroupPerson
  \/ GroupAgent
  \/ MoveGroup
  \/ UndoMoveGroup
  \/ MoveChild
  \/ UndoMoveChild
  \/ Ungroup
  \/ Regroup
  \/ RunUndo

Spec == Init /\ [][Next]_vars

StructuralRecord ==
  \/ /\ record = "none"
     /\ recordNode = "none"
     /\ nodeA = TRUE
     /\ nodeB = FALSE
  \/ /\ record = "add"
     /\ recordNode = "b"
     /\ beforeB = FALSE
     /\ nodeB = TRUE
     /\ nodeA = beforeA
  \/ /\ record = "remove"
     /\ recordNode = "b"
     /\ beforeB = TRUE
     /\ nodeB = FALSE
     /\ nodeA = beforeA

ReadSetHeld ==
  /\ lastKind = "read" => (storedA = nodeA /\ storedB = nodeB /\ snapA = nodeA /\ snapB = nodeB)
  /\ didRead => (storedA = snapA /\ storedB = snapB)

AbsentEditLeavesCounts ==
  lastKind # "absent" \/ (personBefore = prevBefore /\ personAfter = prevAfter /\ agent = prevAgent)

ChildrenKeepPlace == Shown = seen

RunUndoTurnsBackGroup == groupKind = "runUndo" => grouped = "dissolved" /\ maker = "none"

PersonMoveKeepsAgentGroup == groupKind = "refused" => grouped = "formed" /\ (touched \/ own # inside)

====
