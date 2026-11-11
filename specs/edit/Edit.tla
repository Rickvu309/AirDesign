---- MODULE Edit ----
\* This model follows one run editing one property of one deck. A later run is specified in the run, undo and rerun models.
\* Version rises by one on each landed write and by one for each row an undo hides. It never falls.
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
  sawFirst,
  sawSecond,
  atFirst,
  guardedAt,
  stoppedAt,
  beforeFrozen,
  laterFrozen,
  refused,
  hidden

vars == <<phase, personBefore, personAfter, agent, readAt, guarded, agentAt, claims, sawFirst, sawSecond, atFirst, guardedAt, stoppedAt, beforeFrozen, laterFrozen, refused, hidden>>

Version == personBefore + personAfter + agent + 2 * hidden

PersonCan ==
  \/ agent = 1 /\ personAfter = 0
  \/ agent = 0 /\ personBefore = 0

\* The refusal an agent edit of the running run meets for its read. The guard is checked before the read.
AgentRefusal(read) ==
  IF guarded THEN "protected"
  ELSE IF read # Version /\ read # claims THEN "stale"
  ELSE "none"

TypeOK ==
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ personBefore \in {0, 1}
  /\ personAfter \in {0, 1}
  /\ agent \in {0, 1, 2}
  /\ readAt \in {-1, 0, 1, 2, 3, 4}
  /\ guarded \in BOOLEAN
  /\ agentAt \in {-1, 0, 1, 2, 3, 4}
  /\ claims \in {-1, 0, 1, 2, 3, 4}
  /\ sawFirst \in {-1, 0, 1, 2, 3, 4}
  /\ sawSecond \in {-1, 0, 1, 2, 3, 4}
  /\ atFirst \in {-1, 0, 1, 2, 3, 4}
  /\ guardedAt \in {-1, 0, 1, 2}
  /\ stoppedAt \in {-1, 0, 1, 2, 3, 4}
  /\ beforeFrozen \in {-1, 0, 1}
  /\ laterFrozen \in {-1, 0, 1}
  /\ refused \in {0, 1}
  /\ hidden \in {0, 1, 2}

Init ==
  /\ phase = "idle"
  /\ personBefore = 0
  /\ personAfter = 0
  /\ agent = 0
  /\ readAt = -1
  /\ guarded = FALSE
  /\ agentAt = -1
  /\ claims = -1
  /\ sawFirst = -1
  /\ sawSecond = -1
  /\ atFirst = -1
  /\ guardedAt = -1
  /\ stoppedAt = -1
  /\ beforeFrozen = -1
  /\ laterFrozen = -1
  /\ refused = 0
  /\ hidden = 0

\* A person write has no refusal. It always changes the property.
\* A person edit during a live run sets the guard, including after the run has landed a row.
PersonWrites ==
  /\ \/ agent = 1 /\ personAfter = 0
     \/ agent = 0 /\ personBefore = 0
  /\ personBefore' = IF agent = 0 THEN personBefore + 1 ELSE personBefore
  /\ personAfter' = IF agent = 1 THEN personAfter + 1 ELSE personAfter
  /\ guarded' = IF phase = "running" THEN TRUE ELSE guarded
  /\ guardedAt' = IF phase = "running" /\ guarded = FALSE THEN agent ELSE guardedAt
  /\ UNCHANGED <<phase, agent, readAt, agentAt, claims, sawFirst, sawSecond, atFirst, stoppedAt, beforeFrozen, laterFrozen, refused, hidden>>

\* The run reads the current version. A person edit from before the run does not guard it.
RunStarts ==
  /\ phase = "idle"
  /\ phase' = "running"
  /\ readAt' = Version
  /\ guarded' = FALSE
  /\ UNCHANGED <<personBefore, personAfter, agent, agentAt, claims, sawFirst, sawSecond, atFirst, guardedAt, stoppedAt, beforeFrozen, laterFrozen, refused, hidden>>

\* Reading again names the current version, including after the first agent row. It does not clear a guard.
AgentRereads ==
  /\ phase = "running"
  /\ agent \in {0, 1}
  /\ readAt # Version
  /\ readAt' = Version
  /\ UNCHANGED <<phase, personBefore, personAfter, agent, guarded, agentAt, claims, sawFirst, sawSecond, atFirst, guardedAt, stoppedAt, beforeFrozen, laterFrozen, refused, hidden>>

\* The first row lands on the version the run names, while the run is open and unguarded.
AgentWrites ==
  /\ phase = "running"
  /\ guarded = FALSE
  /\ agent = 0
  /\ readAt = Version
  /\ agent' = 1
  /\ claims' = readAt
  /\ agentAt' = Version + 1
  /\ sawFirst' = readAt
  /\ atFirst' = Version + 1
  /\ UNCHANGED <<phase, personBefore, personAfter, readAt, guarded, sawSecond, guardedAt, stoppedAt, beforeFrozen, laterFrozen, refused, hidden>>

\* A later row lands on a fresh read. The run may read again after its first row.
AgentWritesAgain ==
  /\ phase = "running"
  /\ guarded = FALSE
  /\ agent = 1
  /\ readAt = Version
  /\ agent' = 2
  /\ claims' = readAt
  /\ agentAt' = Version + 1
  /\ sawSecond' = readAt
  /\ UNCHANGED <<phase, personBefore, personAfter, readAt, guarded, sawFirst, atFirst, guardedAt, stoppedAt, beforeFrozen, laterFrozen, refused, hidden>>

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
  /\ sawSecond' = readAt
  /\ UNCHANGED <<phase, personBefore, personAfter, readAt, guarded, claims, sawFirst, atFirst, guardedAt, stoppedAt, beforeFrozen, laterFrozen, refused, hidden>>

\* A guarded run's agent edit does not land and is refused as protected, whatever its read.
AgentRefusesProtected ==
  /\ phase = "running"
  /\ AgentRefusal(readAt) = "protected"
  /\ UNCHANGED vars

RunStops ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ stoppedAt' = Version
  /\ UNCHANGED <<personBefore, personAfter, agent, readAt, guarded, agentAt, claims, sawFirst, sawSecond, atFirst, guardedAt, beforeFrozen, laterFrozen, refused, hidden>>

\* Undo drops both agent rows of this run and leaves both person edits where they are.
RunUndoes ==
  /\ phase \in {"running", "stopped"}
  /\ phase' = "undone"
  /\ agent' = 0
  /\ hidden' = agent
  /\ beforeFrozen' = personBefore
  /\ laterFrozen' = personAfter
  /\ UNCHANGED <<personBefore, personAfter, readAt, guarded, agentAt, claims, sawFirst, sawSecond, atFirst, guardedAt, stoppedAt, refused>>

Done ==
  /\ phase = "undone"
  /\ ~PersonCan
  /\ UNCHANGED vars

Next ==
  PersonWrites \/ RunStarts \/ AgentRereads \/ AgentWrites \/ AgentWritesAgain \/ AgentKeepsClaim \/ AgentRefusesProtected \/ RunStops \/ RunUndoes \/ Done

Spec == Init /\ [][Next]_vars

\* A guarded run's agent edit is refused as protected, whatever its read.
GuardedRunRefusesAsProtected == (phase = "running" /\ guarded) => AgentRefusal(readAt) = "protected"

\* The person write is never refused.
PersonAlwaysLands == refused = 0

\* Every agent row named the version that was current, or the claim of its own run.
AgentSawCurrent ==
  \/ agent = 0
  \/ /\ agent = 1
     /\ sawFirst = personBefore
     /\ atFirst = personBefore + 1
     /\ claims = sawFirst
     /\ agentAt = atFirst
  \/ /\ agent = 2
     /\ sawFirst = personBefore
     /\ atFirst = personBefore + 1
     /\ \/ sawSecond = sawFirst
        \/ sawSecond = personBefore + personAfter + 1
     /\ agentAt = personBefore + personAfter + 2
     /\ claims = sawSecond

\* Once a person has edited during the run, no agent row of that run lands afterwards.
ProtectedFromRun == guardedAt = -1 \/ agent <= guardedAt

\* Stop fixes the property. A later agent write would sit past stoppedAt.
StopFences == stoppedAt = -1 \/ agent = 0 \/ agentAt <= stoppedAt

\* Undo removes both agent rows of this run and keeps the person edits from that moment on.
\* A person edit after undo still lands, so the counts may rise above the frozen ones.
UndoRevertsOnlyTheRun ==
  phase # "undone"
  \/ (agent = 0 /\ personBefore >= beforeFrozen /\ personAfter >= laterFrozen)

====
