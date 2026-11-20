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
  groupKind,
  framed,
  auto,
  pad,
  backdrop,
  member

old == <<
  nodeA, nodeB, record, recordNode, beforeA, beforeB, didRead, snapA, snapB, storedA, storedB,
  lastKind, personBefore, personAfter, agent, prevBefore, prevAfter, prevAgent, phase, runId, readId
>>

tree == <<grouped, maker, offset, inside, own, seen, childMoved, touched, groupKind, framed, auto, pad, backdrop, member>>

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
  /\ grouped \in {"none", "formed", "dissolved", "emptied"}
  /\ maker \in {"none", "person", "agent"}
  /\ offset \in {0, 1}
  /\ inside \in 0..2
  /\ own \in 0..3
  /\ seen \in 0..3
  /\ childMoved \in {0, 1}
  /\ touched \in BOOLEAN
  /\ groupKind \in {"none", "group", "move", "ungroup", "regroup", "runUndo", "refused", "frame", "member", "empty"}
  /\ framed \in BOOLEAN
  /\ auto \in BOOLEAN
  /\ pad \in {0, 1}
  /\ backdrop \in BOOLEAN
  /\ member \in BOOLEAN

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
  /\ framed = FALSE
  /\ auto = FALSE
  /\ pad = 0
  /\ backdrop = FALSE
  /\ member = TRUE

Ungrouped == grouped = "none" /\ groupKind = "none"

Quiet ==
  /\ record = "none"
  /\ lastKind = "none"
  /\ phase = "idle"
  /\ runId = "s"
  /\ readId = "s"

Laid == IF framed THEN pad ELSE 0

Shown == IF grouped = "formed" /\ member THEN inside + offset + Laid ELSE own

frame == <<framed, auto, pad, backdrop, member>>

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
  /\ framed' = FALSE
  /\ auto' = FALSE
  /\ pad' = 0
  /\ backdrop' = FALSE
  /\ member' = TRUE
  /\ UNCHANGED <<own, seen, childMoved>>
  /\ UNCHANGED old

GroupPerson == GroupBy("person")

GroupAgent == GroupBy("agent")

MoveGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ member
  /\ offset = 0
  /\ offset' = 1
  /\ seen' = seen + 1
  /\ touched' = TRUE
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, inside, own, childMoved>>
  /\ UNCHANGED frame
  /\ UNCHANGED old

UndoMoveGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ member
  /\ member
  /\ offset = 1
  /\ offset' = 0
  /\ seen' = seen - 1
  /\ touched' = TRUE
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, inside, own, childMoved>>
  /\ UNCHANGED frame
  /\ UNCHANGED old

MoveChild ==
  /\ Quiet
  /\ grouped \in {"none", "dissolved"}
  /\ childMoved = 0
  /\ own < 3
  /\ own' = own + 1
  /\ seen' = seen + 1
  /\ childMoved' = 1
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, offset, inside, touched>>
  /\ UNCHANGED frame
  /\ UNCHANGED old

UndoMoveChild ==
  /\ Quiet
  /\ grouped \in {"none", "dissolved"}
  /\ childMoved = 1
  /\ own' = own - 1
  /\ seen' = seen - 1
  /\ childMoved' = 0
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, offset, inside, touched>>
  /\ UNCHANGED frame
  /\ UNCHANGED old

MoveInGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ ~framed /\ member
  /\ maker = "person" /\ own = 0 /\ inside = 0 /\ childMoved = 0 /\ offset = 0
  /\ inside' = inside + 1
  /\ seen' = seen + 1
  /\ touched' = TRUE
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, offset, own, childMoved>>
  /\ UNCHANGED frame
  /\ UNCHANGED old

UndoMoveInGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ ~framed /\ member
  /\ inside = own + 1
  /\ inside' = own
  /\ seen' = seen - 1
  /\ touched' = TRUE
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, offset, own, childMoved>>
  /\ UNCHANGED frame
  /\ UNCHANGED old

Ungroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ grouped' = "dissolved"
  /\ own' = Shown
  /\ childMoved' = 0
  /\ groupKind' = "ungroup"
  /\ backdrop' = FALSE
  /\ UNCHANGED <<maker, offset, inside, seen, touched, framed, auto, pad, member>>
  /\ UNCHANGED old

Regroup ==
  /\ Quiet
  /\ grouped = "dissolved"
  /\ maker # "none"
  /\ childMoved = 0
  /\ grouped' = "formed"
  /\ groupKind' = "regroup"
  /\ backdrop' = framed
  /\ inside' = IF framed THEN inside ELSE own - offset
  /\ UNCHANGED <<maker, offset, own, seen, childMoved, touched, framed, auto, pad, member>>
  /\ UNCHANGED old

Wrap ==
  /\ Quiet
  /\ grouped = "none"
  /\ childMoved = 0
  /\ grouped' = "formed"
  /\ maker' = "person"
  /\ inside' = own
  /\ offset' = 0
  /\ touched' = FALSE
  /\ groupKind' = "group"
  /\ framed' = TRUE
  /\ auto' = TRUE
  /\ pad' = 0
  /\ backdrop' = TRUE
  /\ member' = TRUE
  /\ UNCHANGED <<own, seen, childMoved>>
  /\ UNCHANGED old

Pad ==
  /\ Quiet
  /\ grouped = "formed"
  /\ framed /\ auto /\ member
  /\ pad' = 1 - pad
  /\ seen' = seen + (1 - 2 * pad)
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, offset, inside, own, childMoved, touched, framed, auto, backdrop, member>>
  /\ UNCHANGED old

RemoveAutoLayout ==
  /\ Quiet
  /\ grouped = "formed"
  /\ framed /\ auto
  /\ auto' = FALSE
  /\ groupKind' = "frame"
  /\ UNCHANGED <<grouped, maker, offset, inside, own, seen, childMoved, touched, framed, pad, backdrop, member>>
  /\ UNCHANGED old

UndoRemoveAutoLayout ==
  /\ Quiet
  /\ grouped = "formed"
  /\ framed /\ ~auto
  /\ groupKind = "frame"
  /\ auto' = TRUE
  /\ groupKind' = "frame"
  /\ UNCHANGED <<grouped, maker, offset, inside, own, seen, childMoved, touched, framed, pad, backdrop, member>>
  /\ UNCHANGED old

MoveInFrame ==
  /\ Quiet
  /\ grouped = "formed"
  /\ framed /\ ~auto /\ member
  /\ pad' = 1 - pad
  /\ seen' = seen + (1 - 2 * pad)
  /\ groupKind' = "move"
  /\ UNCHANGED <<grouped, maker, offset, inside, own, childMoved, touched, framed, auto, backdrop, member>>
  /\ UNCHANGED old

Leave ==
  /\ Quiet
  /\ grouped = "formed"
  /\ framed /\ member
  /\ member' = FALSE
  /\ own' = 3
  /\ seen' = 3
  /\ childMoved' = 0
  /\ groupKind' = "member"
  /\ UNCHANGED <<grouped, maker, offset, inside, touched, framed, auto, pad, backdrop>>
  /\ UNCHANGED old

LeaveGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ ~framed /\ member /\ offset = 0 /\ maker = "person" /\ ~touched /\ childMoved = 0
  /\ member' = FALSE
  /\ own' = Shown
  /\ groupKind' = "member"
  /\ UNCHANGED <<grouped, maker, offset, inside, seen, childMoved, touched, framed, auto, pad, backdrop>>
  /\ UNCHANGED old

EmptyGroup ==
  /\ Quiet
  /\ grouped = "formed"
  /\ ~framed /\ ~member /\ groupKind = "member"
  /\ grouped' = "emptied"
  /\ groupKind' = "empty"
  /\ UNCHANGED <<maker, offset, inside, own, seen, childMoved, touched, framed, auto, pad, backdrop, member>>
  /\ UNCHANGED old

UndoEmpty ==
  /\ Quiet
  /\ grouped = "emptied"
  /\ grouped' = "formed"
  /\ groupKind' = "member"
  /\ UNCHANGED <<maker, offset, inside, own, seen, childMoved, touched, framed, auto, pad, backdrop, member>>
  /\ UNCHANGED old

UndoLeave ==
  /\ Quiet
  /\ grouped = "formed"
  /\ ~member
  /\ groupKind = "member"
  /\ member' = TRUE
  /\ seen' = inside + offset + pad
  /\ groupKind' = IF framed THEN "move" ELSE "group"
  /\ UNCHANGED <<grouped, maker, offset, inside, own, childMoved, touched, framed, auto, pad, backdrop>>
  /\ UNCHANGED old

Unwrap ==
  /\ Quiet
  /\ grouped = "formed"
  /\ framed /\ auto /\ pad = 0
  /\ grouped' = "dissolved"
  /\ own' = IF member THEN inside + offset ELSE own
  /\ childMoved' = 0
  /\ groupKind' = "ungroup"
  /\ backdrop' = FALSE
  /\ UNCHANGED <<maker, offset, inside, seen, touched, framed, auto, pad, member>>
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
  /\ UNCHANGED frame
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
  \/ MoveInGroup
  \/ UndoMoveInGroup
  \/ Ungroup
  \/ Regroup
  \/ RunUndo
  \/ Wrap
  \/ Pad
  \/ RemoveAutoLayout
  \/ UndoRemoveAutoLayout
  \/ MoveInFrame
  \/ Leave
  \/ LeaveGroup
  \/ UndoLeave
  \/ EmptyGroup
  \/ UndoEmpty
  \/ Unwrap

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

LeftChildStaysOut == ~member => grouped # "none"

EmptiedGroupHoldsNoLayer == grouped = "emptied" => ~member /\ ~framed /\ ~backdrop

BackdropOnlyInFrame == backdrop <=> (grouped = "formed" /\ framed)

PersonMoveKeepsAgentGroup == groupKind = "refused" => grouped = "formed" /\ (touched \/ own # inside)

====
