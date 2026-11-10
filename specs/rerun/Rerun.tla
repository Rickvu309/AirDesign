---- MODULE Rerun ----
\* This model follows two runs on one property of one deck: the guard, the claim and the stop mark of each run.
\* The second run starts from a stopped or undone first run. Undo of an earlier run while a later run is live is in the run and undo models.
\* Version is how many landed writes the property shows.
EXTENDS Integers

VARIABLES
  phase,
  run,
  firstRows,
  firstLanded,
  person,
  secondRows,
  secondPerson,
  readAt,
  guarded,
  guardedAt,
  claims,
  claimRun,
  stoppedAt,
  keptFirst,
  keptPerson,
  wroteAfterStop,
  secondEditRows

secondVars == <<secondRows, secondPerson, keptFirst, keptPerson, secondEditRows>>

vars == <<phase, run, firstRows, firstLanded, person, readAt, guarded, guardedAt, claims, claimRun, stoppedAt, secondVars, wroteAfterStop>>

Version == firstRows + person + secondRows + secondPerson

RunRows == IF run = 1 THEN firstRows ELSE secondRows

TypeOK ==
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ run \in {1, 2}
  /\ firstRows \in {0, 1}
  /\ firstLanded \in BOOLEAN
  /\ person \in {0, 1}
  /\ secondRows \in {0, 1, 2}
  /\ secondPerson \in {0, 1}
  /\ readAt \in -1..5
  /\ guarded \in BOOLEAN
  /\ guardedAt \in {-1, 0, 1, 2}
  /\ secondEditRows \in {-1, 0, 1, 2}
  /\ claims \in -1..5
  /\ claimRun \in {0, 1, 2}
  /\ stoppedAt \in -1..5
  /\ keptFirst \in {-1, 0, 1}
  /\ keptPerson \in {-1, 0, 1, 2}
  /\ wroteAfterStop \in BOOLEAN

Init ==
  /\ phase = "idle"
  /\ run = 1
  /\ firstRows = 0
  /\ firstLanded = FALSE
  /\ person = 0
  /\ secondRows = 0
  /\ secondPerson = 0
  /\ readAt = -1
  /\ guarded = FALSE
  /\ guardedAt = -1
  /\ secondEditRows = -1
  /\ claims = -1
  /\ claimRun = 0
  /\ stoppedAt = -1
  /\ keptFirst = -1
  /\ keptPerson = -1
  /\ wroteAfterStop = FALSE

\* A person edit during a live first run sets the guard, whether or not that run has landed a row.
PersonWrites ==
  /\ run = 1
  /\ person = 0
  /\ person' = 1
  /\ guarded' = IF phase = "running" THEN TRUE ELSE guarded
  /\ guardedAt' = IF phase = "running" /\ guarded = FALSE THEN firstRows ELSE guardedAt
  /\ UNCHANGED <<phase, run, firstRows, firstLanded, readAt, claims, claimRun, stoppedAt, secondVars, wroteAfterStop>>

\* A person edit in the second run lands the same way. While that run is live it sets the guard, before or after the run has landed a row.
PersonWritesSecond ==
  /\ run = 2
  /\ secondPerson = 0
  /\ secondPerson' = 1
  /\ guarded' = IF phase = "running" THEN TRUE ELSE guarded
  /\ guardedAt' = IF phase = "running" /\ guarded = FALSE THEN secondRows ELSE guardedAt
  /\ secondEditRows' = IF phase = "running" THEN secondRows ELSE secondEditRows
  /\ UNCHANGED <<phase, run, firstRows, firstLanded, person, readAt, claims, claimRun, stoppedAt, secondRows, keptFirst, keptPerson, wroteAfterStop>>

\* The first run reads the current version.
RunStarts ==
  /\ phase = "idle"
  /\ phase' = "running"
  /\ readAt' = Version
  /\ UNCHANGED <<run, firstRows, firstLanded, person, guarded, guardedAt, claims, claimRun, stoppedAt, secondVars, wroteAfterStop>>

\* A new run starts from a stopped or undone run. It reads the current version and clears the guard, the claim and the stop mark.
StartNext ==
  /\ run = 1
  /\ phase \in {"stopped", "undone"}
  /\ phase' = "running"
  /\ run' = 2
  /\ readAt' = Version
  /\ guarded' = FALSE
  /\ guardedAt' = -1
  /\ claims' = -1
  /\ claimRun' = 0
  /\ stoppedAt' = -1
  /\ keptFirst' = firstRows
  /\ UNCHANGED <<secondEditRows, firstRows, firstLanded, person, secondRows, secondPerson, keptPerson, wroteAfterStop>>

\* Reading again names the current version, including after the run's first row. It does not clear a guard.
AgentRereads ==
  /\ phase = "running"
  /\ RunRows \in {0, 1}
  /\ readAt # Version
  /\ readAt' = Version
  /\ UNCHANGED <<phase, run, firstRows, firstLanded, person, guarded, guardedAt, claims, claimRun, stoppedAt, secondVars, wroteAfterStop>>

\* The first run lands its row on the version it names, while it is open and unguarded.
FirstWrites ==
  /\ run = 1
  /\ phase = "running"
  /\ guarded = FALSE
  /\ firstRows = 0
  /\ firstLanded = FALSE
  /\ readAt = Version
  /\ firstRows' = 1
  /\ firstLanded' = TRUE
  /\ claims' = readAt
  /\ claimRun' = 1
  /\ wroteAfterStop' = (wroteAfterStop \/ phase = "stopped")
  /\ UNCHANGED <<phase, run, person, readAt, guarded, guardedAt, stoppedAt, secondVars>>

\* The first row of the second run lands on the version the run names, while the run is open and unguarded.
SecondWrites ==
  /\ run = 2
  /\ phase = "running"
  /\ guarded = FALSE
  /\ secondRows = 0
  /\ readAt = Version
  /\ secondRows' = 1
  /\ claims' = readAt
  /\ claimRun' = 2
  /\ wroteAfterStop' = (wroteAfterStop \/ phase = "stopped")
  /\ UNCHANGED <<secondEditRows, phase, run, firstRows, firstLanded, person, secondPerson, readAt, guarded, guardedAt, stoppedAt, keptFirst, keptPerson>>

\* A later row of the second run lands on a fresh read.
SecondWritesAgain ==
  /\ run = 2
  /\ phase = "running"
  /\ guarded = FALSE
  /\ secondRows = 1
  /\ readAt = Version
  /\ secondRows' = 2
  /\ claims' = readAt
  /\ claimRun' = 2
  /\ wroteAfterStop' = (wroteAfterStop \/ phase = "stopped")
  /\ UNCHANGED <<secondEditRows, phase, run, firstRows, firstLanded, person, secondPerson, readAt, guarded, guardedAt, stoppedAt, keptFirst, keptPerson>>

\* A later row of the second run lands on that run's own claim.
SecondKeepsClaim ==
  /\ run = 2
  /\ phase = "running"
  /\ guarded = FALSE
  /\ secondRows = 1
  /\ readAt = claims
  /\ readAt # Version
  /\ secondRows' = 2
  /\ wroteAfterStop' = (wroteAfterStop \/ phase = "stopped")
  /\ UNCHANGED <<secondEditRows, phase, run, firstRows, firstLanded, person, secondPerson, readAt, guarded, guardedAt, claims, claimRun, stoppedAt, keptFirst, keptPerson>>

\* A read after a person edit during the second run does not land, before or after that run has landed a row.
SecondRefusesProtected ==
  /\ run = 2
  /\ phase = "running"
  /\ guarded = TRUE
  /\ secondRows \in {0, 1}
  /\ \/ readAt = claims
     \/ readAt = Version
  /\ UNCHANGED vars

RunStops ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ stoppedAt' = Version
  /\ UNCHANGED <<run, firstRows, firstLanded, person, readAt, guarded, guardedAt, claims, claimRun, secondVars, wroteAfterStop>>

\* Undo of the first run hides its row and leaves the person row.
RunUndoes ==
  /\ run = 1
  /\ phase \in {"running", "stopped"}
  /\ phase' = "undone"
  /\ firstRows' = 0
  /\ UNCHANGED <<run, firstLanded, person, readAt, guarded, guardedAt, claims, claimRun, stoppedAt, secondVars, wroteAfterStop>>

\* Undo of the second run hides only that run's rows. The first run's row and every person row stay.
SecondUndoes ==
  /\ run = 2
  /\ phase \in {"running", "stopped"}
  /\ phase' = "undone"
  /\ secondRows' = 0
  /\ keptPerson' = person + secondPerson
  /\ UNCHANGED <<secondEditRows, run, firstRows, firstLanded, person, readAt, guarded, guardedAt, claims, claimRun, stoppedAt, secondPerson, keptFirst, wroteAfterStop>>

Done ==
  /\ phase = "undone"
  /\ run = 2
  /\ secondPerson = 1
  /\ UNCHANGED vars

Next ==
  PersonWrites \/ PersonWritesSecond \/ RunStarts \/ StartNext \/ AgentRereads \/ FirstWrites \/ SecondWrites \/ SecondWritesAgain \/ SecondKeepsClaim \/ SecondRefusesProtected \/ RunStops \/ RunUndoes \/ SecondUndoes \/ Done

Spec == Init /\ [][Next]_vars

\* A person edit made during the second run keeps that run from landing afterwards.
SecondRunStaysProtected == secondEditRows = -1 \/ secondRows <= secondEditRows

\* A new run never continues the claim of an earlier run. The claim on the register was made by the current run, or there is none.
NewRunNeverContinuesOldClaim ==
  /\ (claims = -1) = (claimRun = 0)
  /\ claimRun \in {0, run}

\* A guard comes only from a person edit during the current run. A new run starts unguarded.
GuardBelongsToThisRun ==
  /\ guarded = (guardedAt # -1)
  /\ guarded => (IF run = 1 THEN person = 1 ELSE secondPerson = 1)

\* No agent write of a stopped run lands, and a live run carries no stop mark.
StopFences ==
  /\ wroteAfterStop = FALSE
  /\ phase # "running" \/ stoppedAt = -1

\* Undo of the second run removes only that run's rows. The first run's row and the person rows stay.
SecondUndoKeepsOtherRows ==
  phase # "undone"
  \/ run = 1
  \/ (secondRows = 0 /\ firstRows = keptFirst /\ person + secondPerson >= keptPerson)

====
