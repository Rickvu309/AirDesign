---- MODULE Edit ----
\* One person and one agent run edit one property of one deck.
\* Version is how many landed writes the property has.
\* A structural step names the node it adds or removes.
\* The second run stores the nodes that were present when it read.
EXTENDS Integers

VARIABLES
  phase,
  personBefore,
  personAfter,
  agent,
  readAt,
  guarded,
  agentAt,
  claims,
  stoppedAt,
  beforeFrozen,
  laterFrozen,
  refused,
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
  prevBefore,
  prevAfter,
  prevAgent

vars == <<
  phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, stoppedAt,
  beforeFrozen, laterFrozen, refused, nodeA, nodeB, record, recordNode, beforeA, beforeB,
  didRead, snapA, snapB, storedA, storedB, lastKind, prevBefore, prevAfter, prevAgent
>>

Version == personBefore + personAfter + agent

PersonCan ==
  \/ agent = 1 /\ personAfter = 0
  \/ agent = 0 /\ personBefore = 0

Settle ==
  /\ lastKind' = "other"
  /\ prevBefore' = -1
  /\ prevAfter' = -1
  /\ prevAgent' = -1
  /\ UNCHANGED <<nodeA, nodeB, record, recordNode, beforeA, beforeB, didRead, snapA, snapB, storedA, storedB>>

TypeOK ==
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ personBefore \in {0, 1}
  /\ personAfter \in {0, 1}
  /\ agent \in {0, 1}
  /\ readAt \in {-1, 0, 1, 2, 3}
  /\ guarded \in BOOLEAN
  /\ agentAt \in {-1, 0, 1, 2, 3}
  /\ claims \in {-1, 0, 1, 2, 3}
  /\ stoppedAt \in {-1, 0, 1, 2, 3}
  /\ beforeFrozen \in {-1, 0, 1}
  /\ laterFrozen \in {-1, 0, 1}
  /\ refused \in {0, 1}
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
  /\ lastKind \in {"none", "absent", "other"}
  /\ prevBefore \in {-1, 0, 1}
  /\ prevAfter \in {-1, 0, 1}
  /\ prevAgent \in {-1, 0, 1}

Init ==
  /\ phase = "idle"
  /\ personBefore = 0
  /\ personAfter = 0
  /\ agent = 0
  /\ readAt = -1
  /\ guarded = FALSE
  /\ agentAt = -1
  /\ claims = -1
  /\ stoppedAt = -1
  /\ beforeFrozen = -1
  /\ laterFrozen = -1
  /\ refused = 0
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
  /\ prevBefore = -1
  /\ prevAfter = -1
  /\ prevAgent = -1

\* A person write has no refusal. It always changes the property.
PersonWrites ==
  /\ nodeA = TRUE
  /\ PersonCan
  /\ personBefore' = IF agent = 0 THEN personBefore + 1 ELSE personBefore
  /\ personAfter' = IF agent = 1 THEN personAfter + 1 ELSE personAfter
  /\ guarded' = IF phase = "running" /\ agent = 0 THEN TRUE ELSE guarded
  /\ Settle
  /\ UNCHANGED <<phase, agent, readAt, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* The run reads the current version. A person edit from before the run does not guard it.
RunStarts ==
  /\ nodeA = TRUE
  /\ phase = "idle"
  /\ phase' = "running"
  /\ readAt' = Version
  /\ guarded' = FALSE
  /\ Settle
  /\ UNCHANGED <<personBefore, personAfter, agent, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* Reading again updates the named version. It does not clear a guard.
AgentRereads ==
  /\ nodeA = TRUE
  /\ phase = "running"
  /\ agent = 0
  /\ readAt # Version
  /\ readAt' = Version
  /\ Settle
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* The write lands only on the version it names, and only while the run is open and unguarded.
AgentWrites ==
  /\ phase = "running"
  /\ guarded = FALSE
  /\ agent = 0
  /\ readAt = Version
  /\ nodeA = TRUE
  /\ agent' = 1
  /\ claims' = readAt
  /\ agentAt' = Version + 1
  /\ Settle
  /\ UNCHANGED <<phase, personBefore, personAfter, readAt, guarded, stoppedAt, beforeFrozen, laterFrozen, refused>>

RunStops ==
  /\ nodeA = TRUE
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ stoppedAt' = Version
  /\ Settle
  /\ UNCHANGED <<personBefore, personAfter, agent, readAt, guarded, agentAt, claims, beforeFrozen, laterFrozen, refused>>

\* Undo drops the agent's text and leaves both person edits where they are.
RunUndoes ==
  /\ nodeA = TRUE
  /\ phase \in {"running", "stopped"}
  /\ phase' = "undone"
  /\ agent' = 0
  /\ beforeFrozen' = personBefore
  /\ laterFrozen' = personAfter
  /\ Settle
  /\ UNCHANGED <<personBefore, personAfter, readAt, guarded, agentAt, claims, stoppedAt, refused>>

Done ==
  /\ phase = "undone"
  /\ ~PersonCan
  /\ Settle
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

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
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused, nodeA, didRead, snapA, snapB, storedA, storedB>>

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
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused, nodeA, didRead, snapA, snapB, storedA, storedB>>

SecondRunReads ==
  /\ phase \in {"stopped", "undone"}
  /\ nodeA = TRUE
  /\ didRead = FALSE
  /\ didRead' = TRUE
  /\ snapA' = nodeA
  /\ snapB' = nodeB
  /\ storedA' = nodeA
  /\ storedB' = nodeB
  /\ lastKind' = "other"
  /\ prevBefore' = -1
  /\ prevAfter' = -1
  /\ prevAgent' = -1
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused, nodeA, nodeB, record, recordNode, beforeA, beforeB>>

NameAbsent ==
  /\ nodeB = FALSE
  /\ \/ personBefore = 1
     \/ agent = 1
     \/ phase = "running"
  /\ lastKind' = "absent"
  /\ prevBefore' = personBefore
  /\ prevAfter' = personAfter
  /\ prevAgent' = agent
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused, nodeA, nodeB, record, recordNode, beforeA, beforeB, didRead, snapA, snapB, storedA, storedB>>

Next ==
  PersonWrites \/ RunStarts \/ AgentRereads \/ AgentWrites \/ RunStops \/ RunUndoes \/ Done
  \/ AddNode \/ RemoveNode \/ SecondRunReads \/ NameAbsent

Spec == Init /\ [][Next]_vars

\* The person write is never refused.
PersonAlwaysLands == refused = 0

\* An agent write that landed named the version that was current.
AgentSawCurrent == agent = 0 \/ agentAt = claims + 1

\* A person edit during the run keeps the agent from landing afterwards.
ProtectedFromRun == guarded => agent = 0

\* Stop fixes the property. A later agent write would sit past stoppedAt.
StopFences == stoppedAt = -1 \/ agent = 0 \/ agentAt <= stoppedAt

\* Undo removes the agent's contribution and keeps the person edits from that moment on.
\* A person edit after undo still lands, so the counts may rise above the frozen ones.
UndoRevertsOnlyTheRun ==
  phase # "undone"
  \/ (agent = 0 /\ personBefore >= beforeFrozen /\ personAfter >= laterFrozen)

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
  didRead = FALSE \/ (storedA = snapA /\ storedB = snapB)

AbsentEditLeavesCounts ==
  lastKind # "absent" \/ (personBefore = prevBefore /\ personAfter = prevAfter /\ agent = prevAgent)

====
