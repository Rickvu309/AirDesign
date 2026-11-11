---- MODULE Turn ----

\* A turn belongs to an account on a deck. It starts with that account's first
\* edit there and ends by a stop, an undo of its run, or the idle window.
\* stateX and stateY are what the stored row shows for an element:
\* idle, open (a run holds it), closed (a run holds it and a person edited it), or ended.
\* closedX and closedY record only that a person closed the element during this turn.
\* Only the end of a turn clears them, so they can disagree with a wrong stored row.

VARIABLES turn, stateX, stateY, closedX, closedY, outcome, landedOn

vars == <<turn, stateX, stateY, closedX, closedY, outcome, landedOn>>

Elements == {"x", "y"}
States == {"idle", "open", "closed", "ended"}

State(e) == IF e = "x" THEN stateX ELSE stateY
Closed(e) == IF e = "x" THEN closedX ELSE closedY

TypeOK ==
  /\ turn \in {"none", "live"}
  /\ stateX \in States
  /\ stateY \in States
  /\ closedX \in BOOLEAN
  /\ closedY \in BOOLEAN
  /\ outcome \in {"none", "landed", "person-protected", "refused", "ended"}
  /\ landedOn \in Elements \cup {"none"}

\* A person's edit on an element the turn holds closes that element to agent
\* writes until the turn ends, and only the end of a turn reopens it.
ClosedUntilTurnEnds ==
  /\ \A e \in Elements : Closed(e) => State(e) = "closed"
  /\ landedOn # "none" => ~Closed(landedOn)

Init ==
  /\ turn = "none"
  /\ stateX = "idle"
  /\ stateY = "idle"
  /\ closedX = FALSE
  /\ closedY = FALSE
  /\ outcome = "none"
  /\ landedOn = "none"

Ended(state) == IF state \in {"open", "closed"} THEN "ended" ELSE state

TurnStart ==
  \E e \in Elements :
    /\ turn = "none"
    /\ turn' = "live"
    /\ stateX' = IF e = "x" THEN "open" ELSE Ended(stateX)
    /\ stateY' = IF e = "y" THEN "open" ELSE Ended(stateY)
    /\ outcome' = "landed"
    /\ landedOn' = e
    /\ UNCHANGED <<closedX, closedY>>

AgentEdit ==
  \E e \in Elements :
    /\ turn = "live"
    /\ IF State(e) = "closed"
       THEN /\ outcome' = "person-protected"
            /\ landedOn' = "none"
            /\ UNCHANGED <<turn, stateX, stateY, closedX, closedY>>
       ELSE /\ outcome' = "landed"
            /\ landedOn' = e
            /\ stateX' = IF e = "x" THEN "open" ELSE stateX
            /\ stateY' = IF e = "y" THEN "open" ELSE stateY
            /\ UNCHANGED <<turn, closedX, closedY>>

PersonEdit ==
  \E e \in Elements :
    /\ IF State(e) \in {"open", "closed"}
       THEN /\ stateX' = IF e = "x" THEN "closed" ELSE stateX
            /\ stateY' = IF e = "y" THEN "closed" ELSE stateY
            /\ closedX' = IF e = "x" THEN closedX \/ turn = "live" ELSE closedX
            /\ closedY' = IF e = "y" THEN closedY \/ turn = "live" ELSE closedY
       ELSE UNCHANGED <<stateX, stateY, closedX, closedY>>
    /\ outcome' = "none"
    /\ landedOn' = "none"
    /\ UNCHANGED turn

EndRuns ==
  /\ turn' = "none"
  /\ stateX' = Ended(stateX)
  /\ stateY' = Ended(stateY)
  /\ closedX' = FALSE
  /\ closedY' = FALSE
  /\ landedOn' = "none"

Stop ==
  /\ turn = "live"
  /\ outcome' = "ended"
  /\ EndRuns

Undo ==
  /\ turn = "live"
  /\ outcome' = "ended"
  /\ EndRuns

Idle ==
  /\ turn = "live"
  /\ turn' = "none"
  /\ closedX' = FALSE
  /\ closedY' = FALSE
  /\ outcome' = "none"
  /\ landedOn' = "none"
  /\ UNCHANGED <<stateX, stateY>>

Refused ==
  /\ outcome' = "refused"
  /\ landedOn' = "none"
  /\ UNCHANGED <<turn, stateX, stateY, closedX, closedY>>

Next ==
  \/ TurnStart
  \/ AgentEdit
  \/ PersonEdit
  \/ Stop
  \/ Undo
  \/ Idle
  \/ Refused

Spec == Init /\ [][Next]_vars

====
