---- MODULE SlideRun ----
\* One account's agent run r on one deck, after r added a slide.
\* The deck lives in deck.saved and the turn in session.agent_turn. Every MCP request
\* loads the turn row, then reads the deck, decides, writes the deck only if deck.saved
\* still has the revision it read, and then saves the turn row under the upsert's rule.
\* An agent call (add_slide or read_deck) and the agent's stop_run of r are two such
\* requests, and their steps interleave. element says whether r also holds an element,
\* so that stopping it changes the deck. Run Undo is in the slide-undo model.
EXTENDS Integers

VARIABLES
  rev, shown, element, turn, turnRev, base,
  aPc, aKind, aTurn, aTurnRev, aRev, aOut, aOutRev, calls,
  sPc, sTurn, sTurnRev, sRev, sElem, sOut, sOutRev,
  stopped, stopTold, late

vars == <<rev, shown, element, turn, turnRev, base,
          aPc, aKind, aTurn, aTurnRev, aRev, aOut, aOutRev, calls,
          sPc, sTurn, sTurnRev, sRev, sElem, sOut, sOutRev,
          stopped, stopTold, late>>

Runs == {"r", "u", "none"}

TypeOK ==
  /\ rev \in 0..6
  /\ shown \in 1..3
  /\ element \in {"none", "running", "stopped"}
  /\ turn \in Runs
  /\ turnRev \in 0..6
  /\ base \in 0..6
  /\ aPc \in {"idle", "turn", "deck", "settle"}
  /\ aKind \in {"slide", "read"}
  /\ aTurn \in Runs
  /\ aTurnRev \in 0..6
  /\ aRev \in 0..6
  /\ aOut \in Runs
  /\ aOutRev \in 0..6
  /\ calls \in 0..2
  /\ sPc \in {"idle", "turn", "deck", "settle", "done"}
  /\ sTurn \in Runs
  /\ sTurnRev \in 0..6
  /\ sRev \in 0..6
  /\ sElem \in {"none", "running", "stopped"}
  /\ sOut \in Runs
  /\ sOutRev \in 0..6
  /\ stopped \in BOOLEAN
  /\ stopTold \in BOOLEAN
  /\ late \in 0..2

\* The insert ... on conflict update in storedTurns: it replaces the row when the row's
\* revision is not newer than the one saved, or is still the revision this request loaded.
Saves(run, runRev, loadedRev) ==
  IF turnRev <= runRev \/ turnRev = loadedRev
  THEN /\ turn' = run /\ turnRev' = runRev
  ELSE UNCHANGED <<turn, turnRev>>

Init ==
  /\ rev = 1
  /\ shown = 1
  /\ element \in {"none", "running"}
  /\ turn = "r"
  /\ turnRev = 1
  /\ base = 1
  /\ aPc = "idle" /\ aKind = "slide" /\ aTurn = "none" /\ aTurnRev = 0 /\ aRev = 0
  /\ aOut = "none" /\ aOutRev = 0 /\ calls = 0
  /\ sPc = "idle" /\ sTurn = "none" /\ sTurnRev = 0 /\ sRev = 0 /\ sElem = "none"
  /\ sOut = "none" /\ sOutRev = 0
  /\ stopped = FALSE /\ stopTold = FALSE /\ late = 0

AgentVars == <<aPc, aKind, aTurn, aTurnRev, aRev, aOut, aOutRev, calls>>
StopVars == <<sPc, sTurn, sTurnRev, sRev, sElem, sOut, sOutRev>>
DeckVars == <<rev, shown, element>>
Ghosts == <<stopped, stopTold, late>>

AgentEnds ==
  /\ aPc' = "idle" /\ aKind' = "slide" /\ aTurn' = "none" /\ aTurnRev' = 0
  /\ aRev' = 0 /\ aOut' = "none" /\ aOutRev' = 0

\* prepare: turns.load reads the account's turn row for the deck.
AgentLoadsTurn ==
  /\ aPc = "idle"
  /\ calls < 2
  /\ \E kind \in {"slide", "read"} : aKind' = kind
  /\ aPc' = "turn"
  /\ aTurn' = turn
  /\ aTurnRev' = turnRev
  /\ calls' = calls + 1
  /\ UNCHANGED <<aRev, aOut, aOutRev, DeckVars, turn, turnRev, base, StopVars, Ghosts>>

\* prepare: readSaved reads the deck.
AgentLoadsDeck ==
  /\ aPc = "turn"
  /\ aPc' = "deck"
  /\ aRev' = rev
  /\ UNCHANGED <<aKind, aTurn, aTurnRev, aOut, aOutRev, calls, DeckVars, turn, turnRev, base, StopVars, Ghosts>>

\* read_deck writes nothing, and the agent's next base is the revision it read.
\* settleTurn then saves the loaded turn again when it is live.
AgentReads ==
  /\ aPc = "deck"
  /\ aKind = "read"
  /\ base' = aRev
  /\ IF aTurn = "none"
     THEN AgentEnds
     ELSE /\ aPc' = "settle"
          /\ aOut' = aTurn
          /\ aOutRev' = aTurnRev
          /\ UNCHANGED <<aKind, aTurn, aTurnRev, aRev>>
  /\ UNCHANGED <<calls, DeckVars, turn, turnRev, StopVars, Ghosts>>

\* slideTool decides on the loaded deck. With no live turn it first stops every live run,
\* which raises the deck's revision past the agent's base, so the call is refused stale.
\* agentSlide checks the base and lands the slide under the turn's run, with no check of
\* that run. commitEdit writes it only if deck.saved still has the loaded revision.
SlideRunOf == IF aTurn = "none" THEN "u" ELSE aTurn

SlideLands ==
  /\ rev = aRev
  /\ base = aRev
  /\ ~(aTurn = "none" /\ element = "running")

AgentAddsSlide ==
  /\ aPc = "deck"
  /\ aKind = "slide"
  /\ IF SlideLands
     THEN /\ rev' = rev + 1
          /\ shown' = IF SlideRunOf = "r" THEN shown + 1 ELSE shown
          /\ late' = IF SlideRunOf = "r" /\ stopped THEN late + 1 ELSE late
          /\ aPc' = "settle"
          /\ aOut' = SlideRunOf
          /\ aOutRev' = rev + 1
          /\ UNCHANGED <<aKind, aTurn, aTurnRev, aRev>>
     ELSE /\ AgentEnds
          /\ UNCHANGED <<rev, shown, late>>
  /\ UNCHANGED <<element, calls, turn, turnRev, base, StopVars, stopped, stopTold>>

AgentSavesTurn ==
  /\ aPc = "settle"
  /\ Saves(aOut, aOutRev, aTurnRev)
  /\ AgentEnds
  /\ UNCHANGED <<calls, DeckVars, base, StopVars, Ghosts>>

StopEnds ==
  /\ sPc' = "done" /\ sTurn' = "none" /\ sTurnRev' = 0 /\ sRev' = 0
  /\ sElem' = "none" /\ sOut' = "none" /\ sOutRev' = 0

StopLoadsTurn ==
  /\ sPc = "idle"
  /\ sPc' = "turn"
  /\ sTurn' = turn
  /\ sTurnRev' = turnRev
  /\ UNCHANGED <<sRev, sElem, sOut, sOutRev, DeckVars, turn, turnRev, base, AgentVars, Ghosts>>

StopLoadsDeck ==
  /\ sPc = "turn"
  /\ sPc' = "deck"
  /\ sRev' = rev
  /\ sElem' = element
  /\ UNCHANGED <<sTurn, sTurnRev, sOut, sOutRev, DeckVars, turn, turnRev, base, AgentVars, Ghosts>>

\* settleTurn clears the turn when the loaded turn held r, and otherwise saves it again.
StopSettles(answerRev) ==
  IF sTurn = "none"
  THEN /\ StopEnds /\ stopTold' = TRUE
  ELSE /\ sPc' = "settle"
       /\ sOut' = IF sTurn = "r" THEN "none" ELSE sTurn
       /\ sOutRev' = IF sTurn = "r" THEN answerRev ELSE sTurnRev
       /\ stopTold' = FALSE
       /\ UNCHANGED <<sTurn, sTurnRev, sRev, sElem>>

\* endOnTouched stops r on the element it holds, which changes the deck. A run that holds
\* no running element has slide rows, so stop_run answers ok and the deck does not change.
\* A changed deck is written only if deck.saved still has the loaded revision.
StopCommits ==
  /\ sPc = "deck"
  /\ IF sElem = "running"
     THEN IF rev = sRev
          THEN /\ rev' = rev + 1
               /\ element' = "stopped"
               /\ stopped' = TRUE
               /\ StopSettles(rev + 1)
          ELSE /\ StopEnds
               /\ stopTold' = FALSE
               /\ UNCHANGED <<rev, element, stopped>>
     ELSE /\ stopped' = TRUE
          /\ StopSettles(sRev)
          /\ UNCHANGED <<rev, element>>
  /\ UNCHANGED <<shown, turn, turnRev, base, AgentVars, late>>

StopSavesTurn ==
  /\ sPc = "settle"
  /\ Saves(sOut, sOutRev, sTurnRev)
  /\ StopEnds
  /\ stopTold' = TRUE
  /\ UNCHANGED <<DeckVars, base, AgentVars, stopped, late>>

Done ==
  /\ aPc = "idle"
  /\ calls = 2
  /\ sPc = "done"
  /\ UNCHANGED vars

Next ==
  \/ AgentLoadsTurn \/ AgentLoadsDeck \/ AgentReads \/ AgentAddsSlide \/ AgentSavesTurn
  \/ StopLoadsTurn \/ StopLoadsDeck \/ StopCommits \/ StopSavesTurn
  \/ Done

Spec == Init /\ [][Next]_vars

\* Every slide of r lands on the revision the agent read.
SlideOnRead == [][rev' > rev /\ shown' > shown => base = rev]_vars

\* A saved turn row never replaces one with a newer revision.
TurnNeverOlder == [][turnRev' >= turnRev]_vars

\* No slide of r lands once Stop took effect. late counts the ones that did.
StopFences == late = 0

\* After stop_run of r answered ok, the turn row no longer names r.
TurnStaysEnded == stopTold => turn # "r"
====
