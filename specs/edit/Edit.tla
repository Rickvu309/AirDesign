---- MODULE Edit ----
\* One person and one agent run edit one property of one deck.
\* Version is how many landed writes the property has.
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
  refused

vars == <<phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

Version == personBefore + personAfter + agent

PersonCan ==
  \/ agent = 1 /\ personAfter = 0
  \/ agent = 0 /\ personBefore = 0

TypeOK ==
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ personBefore \in {0, 1}
  /\ personAfter \in {0, 1}
  /\ agent \in {0, 1, 2}
  /\ readAt \in {-1, 0, 1, 2, 3, 4}
  /\ guarded \in BOOLEAN
  /\ agentAt \in {-1, 0, 1, 2, 3, 4}
  /\ claims \in {-1, 0, 1, 2, 3, 4}
  /\ stoppedAt \in {-1, 0, 1, 2, 3, 4}
  /\ beforeFrozen \in {-1, 0, 1}
  /\ laterFrozen \in {-1, 0, 1}
  /\ refused \in {0, 1}

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

\* A person write has no refusal. It always changes the property.
PersonWrites ==
  /\ \/ agent = 1 /\ personAfter = 0
     \/ agent = 0 /\ personBefore = 0
  /\ personBefore' = IF agent = 0 THEN personBefore + 1 ELSE personBefore
  /\ personAfter' = IF agent = 1 THEN personAfter + 1 ELSE personAfter
  /\ guarded' = IF phase = "running" /\ agent = 0 THEN TRUE ELSE guarded
  /\ UNCHANGED <<phase, agent, readAt, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* The run reads the current version. A person edit from before the run does not guard it.
RunStarts ==
  /\ phase = "idle"
  /\ phase' = "running"
  /\ readAt' = Version
  /\ guarded' = FALSE
  /\ UNCHANGED <<personBefore, personAfter, agent, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* Reading again names the current version, including after the first agent row. It does not clear a guard.
AgentRereads ==
  /\ phase = "running"
  /\ agent \in {0, 1}
  /\ readAt # Version
  /\ readAt' = Version
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, guarded, agentAt, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* The first row lands on the version the run names, while the run is open and unguarded.
AgentWrites ==
  /\ phase = "running"
  /\ guarded = FALSE
  /\ agent = 0
  /\ readAt = Version
  /\ agent' = 1
  /\ claims' = readAt
  /\ agentAt' = Version + 1
  /\ UNCHANGED <<phase, personBefore, personAfter, readAt, guarded, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* A later row lands on a fresh read. The run may read again after its first row.
AgentWritesAgain ==
  /\ phase = "running"
  /\ guarded = FALSE
  /\ agent = 1
  /\ readAt = Version
  /\ agent' = 2
  /\ claims' = readAt
  /\ agentAt' = Version + 1
  /\ UNCHANGED <<phase, personBefore, personAfter, readAt, guarded, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* A later row lands on the claimed read when no person row has landed since the claim.
AgentKeepsClaim ==
  /\ phase = "running"
  /\ guarded = FALSE
  /\ agent = 1
  /\ personAfter = 0
  /\ readAt = claims
  /\ readAt # Version
  /\ agent' = 2
  /\ agentAt' = Version + 1
  /\ UNCHANGED <<phase, personBefore, personAfter, readAt, guarded, claims, stoppedAt, beforeFrozen, laterFrozen, refused>>

\* The claimed read after a person row does not land.
AgentRefusesStale ==
  /\ phase = "running"
  /\ agent = 1
  /\ personAfter = 1
  /\ readAt = claims
  /\ UNCHANGED vars

RunStops ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ stoppedAt' = Version
  /\ UNCHANGED <<personBefore, personAfter, agent, readAt, guarded, agentAt, claims, beforeFrozen, laterFrozen, refused>>

\* Undo drops both agent rows and leaves both person edits where they are.
RunUndoes ==
  /\ phase \in {"running", "stopped"}
  /\ phase' = "undone"
  /\ agent' = 0
  /\ beforeFrozen' = personBefore
  /\ laterFrozen' = personAfter
  /\ UNCHANGED <<personBefore, personAfter, readAt, guarded, agentAt, claims, stoppedAt, refused>>

Done ==
  /\ phase = "undone"
  /\ ~PersonCan
  /\ UNCHANGED vars

Next ==
  PersonWrites \/ RunStarts \/ AgentRereads \/ AgentWrites \/ AgentWritesAgain \/ AgentKeepsClaim \/ AgentRefusesStale \/ RunStops \/ RunUndoes \/ Done

Spec == Init /\ [][Next]_vars

\* The person write is never refused.
PersonAlwaysLands == refused = 0

\* Every agent row named the version that was current, or continued that run's claim with no person row in between.
AgentSawCurrent ==
  \/ agent = 0
  \/ /\ agent = 1
     /\ claims = personBefore
     /\ agentAt = personBefore + 1
  \/ /\ agent = 2
     /\ personAfter = 0
     /\ claims = personBefore
     /\ agentAt = personBefore + 2
  \/ /\ agent = 2
     /\ claims = personBefore + 1 + personAfter
     /\ agentAt = claims + 1

\* A person edit during the run keeps the agent from landing afterwards.
ProtectedFromRun == guarded => agent = 0

\* Stop fixes the property. A later agent write would sit past stoppedAt.
StopFences == stoppedAt = -1 \/ agent = 0 \/ agentAt <= stoppedAt

\* Undo removes both agent rows and keeps the person edits from that moment on.
\* A person edit after undo still lands, so the counts may rise above the frozen ones.
UndoRevertsOnlyTheRun ==
  phase # "undone"
  \/ (agent = 0 /\ personBefore >= beforeFrozen /\ personAfter >= laterFrozen)

====
