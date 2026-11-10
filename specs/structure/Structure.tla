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
  runId

vars == <<
  nodeA, nodeB, record, recordNode, beforeA, beforeB, didRead, snapA, snapB, storedA, storedB,
  lastKind, personBefore, personAfter, agent, prevBefore, prevAfter, prevAgent, phase, runId
>>

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

accepted == runId = "s" /\ phase \in {"stopped", "undone"}

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

AddNode ==
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
  /\ UNCHANGED <<nodeA, didRead, snapA, snapB, storedA, storedB, personBefore, personAfter, agent, phase, runId>>

RemoveNode ==
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
  /\ UNCHANGED <<nodeA, didRead, snapA, snapB, storedA, storedB, personBefore, personAfter, agent, phase, runId>>

SecondRunReads ==
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
  /\ UNCHANGED <<nodeA, nodeB, record, recordNode, beforeA, beforeB, personBefore, personAfter, agent, prevBefore, prevAfter, prevAgent, phase, runId>>

NameAbsent ==
  /\ nodeB = FALSE
  /\ lastKind' = "absent"
  /\ prevBefore' = personBefore
  /\ prevAfter' = personAfter
  /\ prevAgent' = agent
  /\ UNCHANGED <<nodeA, nodeB, record, recordNode, beforeA, beforeB, didRead, snapA, snapB, storedA, storedB, personBefore, personAfter, agent, phase, runId>>

Next == AddNode \/ RemoveNode \/ SecondRunReads \/ NameAbsent

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

====
