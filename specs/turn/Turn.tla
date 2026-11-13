---- MODULE Turn ----

\* A turn belongs to one agent on a deck: a connected agent, named by its OAuth grant, or
\* Aira, named by the account. It starts with that agent's first edit or slide tool call
\* there and ends by a stop of its run or the idle window. Another agent of the account
\* has its own turn and runs; specs/agents models two agents.
\* stateX and stateY are what the stored row shows for an element:
\* idle, open (a run holds it), closed (a run holds it and a person edited it), or ended.
\* closedX and closedY record only that a person closed the element during this turn.
\* Only the end of a turn clears them, so they can disagree with a wrong stored row.
\* saved says whether the agent's stored turn row has caught up with the turn.
\* A call saves the row after its deck write, so a second call sent at the same
\* time can read the deck with the first call's run live and no row naming it.

VARIABLES turn, stateX, stateY, closedX, closedY, outcome, landedOn, saved

vars == <<turn, stateX, stateY, closedX, closedY, outcome, landedOn, saved>>

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
  /\ saved \in BOOLEAN

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
  /\ saved = TRUE

Ended(state) == IF state \in {"open", "closed"} THEN "ended" ELSE state

TurnStart ==
  \E e \in Elements :
    /\ turn = "none"
    /\ turn' = "live"
    /\ stateX' = IF e = "x" THEN "open" ELSE Ended(stateX)
    /\ stateY' = IF e = "y" THEN "open" ELSE Ended(stateY)
    /\ outcome' = "landed"
    /\ landedOn' = e
    /\ saved' \in BOOLEAN
    /\ UNCHANGED <<closedX, closedY>>

\* A call in a live turn joins its run, whether or not the turn's row is saved yet:
\* with no row naming it, the run live on the deck is the turn's own.
AgentEdit ==
  \E e \in Elements :
    /\ turn = "live"
    /\ IF State(e) = "closed"
       THEN /\ outcome' = "person-protected"
            /\ landedOn' = "none"
            /\ UNCHANGED <<turn, stateX, stateY, closedX, closedY, saved>>
       ELSE /\ outcome' = "landed"
            /\ landedOn' = e
            /\ stateX' = IF e = "x" THEN "open" ELSE stateX
            /\ stateY' = IF e = "y" THEN "open" ELSE stateY
            /\ saved' \in {saved, TRUE}
            /\ UNCHANGED <<turn, closedX, closedY>>

\* A slide tool call with no live turn ends the runs it finds and starts a turn. It opens no element.
SlideStart ==
  /\ turn = "none"
  /\ turn' = "live"
  /\ stateX' = Ended(stateX)
  /\ stateY' = Ended(stateY)
  /\ outcome' = "landed"
  /\ landedOn' = "none"
  /\ saved' \in BOOLEAN
  /\ UNCHANGED <<closedX, closedY>>

\* A slide tool call in a live turn joins its run and leaves every element as it was.
SlideInTurn ==
  /\ turn = "live"
  /\ outcome' = "landed"
  /\ landedOn' = "none"
  /\ saved' \in {saved, TRUE}
  /\ UNCHANGED <<turn, stateX, stateY, closedX, closedY>>

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
    /\ UNCHANGED <<turn, saved>>

EndRuns ==
  /\ turn' = "none"
  /\ stateX' = Ended(stateX)
  /\ stateY' = Ended(stateY)
  /\ closedX' = FALSE
  /\ closedY' = FALSE
  /\ landedOn' = "none"
  /\ saved' = TRUE

Stop ==
  /\ turn = "live"
  /\ outcome' = "ended"
  /\ EndRuns

\* Every row save lands long before the ten-minute idle window passes.
Idle ==
  /\ turn = "live"
  /\ turn' = "none"
  /\ saved' = TRUE
  /\ closedX' = FALSE
  /\ closedY' = FALSE
  /\ outcome' = "none"
  /\ landedOn' = "none"
  /\ UNCHANGED <<stateX, stateY>>

Refused ==
  /\ outcome' = "refused"
  /\ landedOn' = "none"
  /\ UNCHANGED <<turn, stateX, stateY, closedX, closedY, saved>>

Next ==
  \/ TurnStart
  \/ AgentEdit
  \/ SlideStart
  \/ SlideInTurn
  \/ PersonEdit
  \/ Stop
  \/ Idle
  \/ Refused

Spec == Init /\ [][Next]_vars

\* A refusal never ends a turn: a refused step leaves the turn and the closed flags as they were.
RefusalKeepsTurn ==
  [][outcome' \in {"refused", "person-protected"} => UNCHANGED <<turn, closedX, closedY>>]_vars

\* While a turn stays live, no step ends one of its runs: two calls of one turn,
\* even sent at the same time, never cost each other an element.
Running(state) == state \in {"open", "closed"}

TurnKeepsItsRuns ==
  [][turn = "live" /\ turn' = "live" =>
       \A e \in Elements : Running(State(e)) => Running((State(e))')]_vars

====
