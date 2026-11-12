---- MODULE SlideRun ----
\* One account's agent run r on one deck, after r added a slide.
\* The deck lives in deck.saved and the turn in session.agent_turn. Every MCP request is
\* admitted once, then settledCall in packages/mcp/src/server.ts runs up to three tries.
\* Each try loads the turn row, reads the deck and decides, and commitEdit writes the deck
\* only if deck.saved still has the revision that try read. A write lost to another one
\* sends the call back to load the turn and read the deck again. After the tries the
\* request saves the turn row under the upsert's rule and answers once that save is done.
\* An agent call (add_slide or read_deck) and the agent's stop_run of r are two such
\* requests, and their steps interleave. element says whether r also holds an element,
\* so that stopping it changes the deck and fences r. Run Undo is in the slide-undo model.
EXTENDS Integers

CONSTANT Tries

VARIABLES
  rev, shown, element, turn, turnRev, base,
  aPc, aKind, aTurn, aTurnRev, aRev, aOut, aOutRev, aTries, aLanded, calls,
  sPc, sTurn, sTurnRev, sRev, sOut, sOutRev, sTries, sLanded,
  stopped, stopTold, late, tools

vars == <<rev, shown, element, turn, turnRev, base,
          aPc, aKind, aTurn, aTurnRev, aRev, aOut, aOutRev, aTries, aLanded, calls,
          sPc, sTurn, sTurnRev, sRev, sOut, sOutRev, sTries, sLanded,
          stopped, stopTold, late, tools>>

Runs == {"r", "u", "none"}

TypeOK ==
  /\ rev \in 0..6
  /\ shown \in 1..3
  /\ element \in {"none", "running", "stopped"}
  /\ turn \in Runs
  /\ turnRev \in 0..6
  /\ base \in 0..6
  /\ aPc \in {"idle", "retry", "turn", "deck", "settle"}
  /\ aKind \in {"slide", "read"}
  /\ aTurn \in Runs
  /\ aTurnRev \in 0..6
  /\ aRev \in 0..6
  /\ aOut \in Runs
  /\ aOutRev \in 0..6
  /\ aTries \in 0..Tries
  /\ aLanded \in 0..2
  /\ calls \in 0..2
  /\ sPc \in {"idle", "retry", "turn", "deck", "settle", "done"}
  /\ sTurn \in Runs
  /\ sTurnRev \in 0..6
  /\ sRev \in 0..6
  /\ sOut \in Runs
  /\ sOutRev \in 0..6
  /\ sTries \in 0..Tries
  /\ sLanded \in 0..2
  /\ stopped \in BOOLEAN
  /\ stopTold \in BOOLEAN
  /\ late \in 0..2
  /\ tools \in 0..3

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
  /\ aOut = "none" /\ aOutRev = 0 /\ aTries = 0 /\ aLanded = 0 /\ calls = 0
  /\ sPc = "idle" /\ sTurn = "none" /\ sTurnRev = 0 /\ sRev = 0
  /\ sOut = "none" /\ sOutRev = 0 /\ sTries = 0 /\ sLanded = 0
  /\ stopped = FALSE /\ stopTold = FALSE /\ late = 0 /\ tools = 0

AgentVars == <<aPc, aKind, aTurn, aTurnRev, aRev, aOut, aOutRev, aTries, aLanded, calls>>
StopVars == <<sPc, sTurn, sTurnRev, sRev, sOut, sOutRev, sTries, sLanded>>
DeckVars == <<rev, shown, element>>
Ghosts == <<stopped, stopTold, late, tools>>

AgentEnds ==
  /\ aPc' = "idle" /\ aKind' = "slide" /\ aTurn' = "none" /\ aTurnRev' = 0
  /\ aRev' = 0 /\ aOut' = "none" /\ aOutRev' = 0 /\ aTries' = 0 /\ aLanded' = 0

\* A new call is admitted once and counted as one tool call. Each try's prepare then runs
\* turns.load, which reads the account's turn row for the deck.
AgentLoadsTurn ==
  /\ aPc \in {"idle", "retry"}
  /\ IF aPc = "idle"
     THEN /\ calls < 2
          /\ calls' = calls + 1
          /\ tools' = tools + 1
          /\ aTries' = 1
          /\ \E kind \in {"slide", "read"} : aKind' = kind
     ELSE /\ aTries' = aTries + 1
          /\ UNCHANGED <<calls, tools, aKind>>
  /\ aPc' = "turn"
  /\ aTurn' = turn
  /\ aTurnRev' = turnRev
  /\ UNCHANGED <<aRev, aOut, aOutRev, aLanded, DeckVars, turn, turnRev, base, StopVars,
                 stopped, stopTold, late>>

\* prepare's readSaved reads the deck, and callTool decides on it.
\* read_deck writes nothing, and the agent's next base is the revision it read. settleTurn
\* then saves the loaded turn again when it is live.
\* agentSlide checks the base, then runFence: a run that holds an element and has none
\* running is refused run-fenced. A run that holds no element passes, so r with no element
\* is never fenced. Otherwise the slide is added under the turn's run, or under the
\* caller's run u when no turn is live. A refused call ends and saves no turn.
\* slideTool with no live turn and a fresh base first stops every live run. That needs a
\* running element with no live turn, which NoTurnWhileRunning says this model never holds.
SlideRunOf == IF aTurn = "none" THEN "u" ELSE aTurn

Fenced == SlideRunOf = "r" /\ element = "stopped"

AgentLoadsDeck ==
  /\ aPc = "turn"
  /\ IF aKind = "read"
     THEN /\ base' = rev
          /\ IF aTurn = "none"
             THEN AgentEnds
             ELSE /\ aPc' = "settle"
                  /\ aOut' = aTurn
                  /\ aOutRev' = aTurnRev
                  /\ UNCHANGED <<aKind, aTurn, aTurnRev, aRev, aTries, aLanded>>
     ELSE /\ UNCHANGED base
          /\ IF base = rev /\ ~Fenced
             THEN /\ aPc' = "deck"
                  /\ aRev' = rev
                  /\ UNCHANGED <<aKind, aTurn, aTurnRev, aOut, aOutRev, aTries, aLanded>>
             ELSE AgentEnds
  /\ UNCHANGED <<calls, DeckVars, turn, turnRev, StopVars, Ghosts>>

\* commitEdit writes the slide only if deck.saved still has the revision this try read.
\* A lost write goes back for another try while tries are left, and is refused stale after.
AgentAddsSlide ==
  /\ aPc = "deck"
  /\ IF rev = aRev
     THEN /\ rev' = rev + 1
          /\ shown' = IF SlideRunOf = "r" THEN shown + 1 ELSE shown
          /\ late' = IF SlideRunOf = "r" /\ stopped THEN late + 1 ELSE late
          /\ aPc' = "settle"
          /\ aOut' = SlideRunOf
          /\ aOutRev' = rev + 1
          /\ aLanded' = aLanded + 1
          /\ UNCHANGED <<aKind, aTurn, aTurnRev, aRev, aTries>>
     ELSE /\ UNCHANGED <<rev, shown, late>>
          /\ IF aTries < Tries
             THEN /\ aPc' = "retry"
                  /\ UNCHANGED <<aKind, aTurn, aTurnRev, aRev, aOut, aOutRev, aTries, aLanded>>
             ELSE AgentEnds
  /\ UNCHANGED <<element, calls, turn, turnRev, base, StopVars, stopped, stopTold, tools>>

AgentSavesTurn ==
  /\ aPc = "settle"
  /\ Saves(aOut, aOutRev, aTurnRev)
  /\ AgentEnds
  /\ UNCHANGED <<calls, DeckVars, base, StopVars, Ghosts>>

StopEnds ==
  /\ sPc' = "done" /\ sTurn' = "none" /\ sTurnRev' = 0 /\ sRev' = 0
  /\ sOut' = "none" /\ sOutRev' = 0 /\ sTries' = 0 /\ sLanded' = 0

StopLoadsTurn ==
  /\ sPc \in {"idle", "retry"}
  /\ IF sPc = "idle"
     THEN /\ tools' = tools + 1
          /\ sTries' = 1
     ELSE /\ sTries' = sTries + 1
          /\ UNCHANGED tools
  /\ sPc' = "turn"
  /\ sTurn' = turn
  /\ sTurnRev' = turnRev
  /\ UNCHANGED <<sRev, sOut, sOutRev, sLanded, DeckVars, turn, turnRev, base, AgentVars,
                 stopped, stopTold, late>>

\* settleTurn clears the turn when the loaded turn held r, and otherwise saves it again.
StopSettles(answerRev) ==
  IF sTurn = "none"
  THEN /\ StopEnds /\ stopTold' = TRUE
  ELSE /\ sPc' = "settle"
       /\ sOut' = IF sTurn = "r" THEN "none" ELSE sTurn
       /\ sOutRev' = IF sTurn = "r" THEN answerRev ELSE sTurnRev
       /\ stopTold' = FALSE
       /\ UNCHANGED <<sTurn, sTurnRev, sRev, sTries, sLanded>>

\* prepare's readSaved reads the deck and endOnTouched decides on it. A run that holds a
\* running element is stopped on it, which changes the deck and waits for commitEdit.
\* A run that holds none has slide rows, so stop_run answers ok and the deck does not change.
StopLoadsDeck ==
  /\ sPc = "turn"
  /\ IF element = "running"
     THEN /\ sPc' = "deck"
          /\ sRev' = rev
          /\ UNCHANGED <<sTurn, sTurnRev, sOut, sOutRev, sTries, sLanded, stopped, stopTold>>
     ELSE /\ stopped' = TRUE
          /\ StopSettles(rev)
  /\ UNCHANGED <<DeckVars, turn, turnRev, base, AgentVars, late, tools>>

\* commitEdit writes the stop only if deck.saved still has the revision this try read.
StopCommits ==
  /\ sPc = "deck"
  /\ IF rev = sRev
     THEN /\ rev' = rev + 1
          /\ element' = "stopped"
          /\ stopped' = TRUE
          /\ sLanded' = sLanded + 1
          /\ IF sTurn = "none"
             THEN /\ sPc' = "done" /\ sTurn' = "none" /\ sTurnRev' = 0 /\ sRev' = 0
                  /\ sOut' = "none" /\ sOutRev' = 0 /\ sTries' = 0 /\ stopTold' = TRUE
             ELSE /\ sPc' = "settle"
                  /\ sOut' = IF sTurn = "r" THEN "none" ELSE sTurn
                  /\ sOutRev' = IF sTurn = "r" THEN rev + 1 ELSE sTurnRev
                  /\ stopTold' = FALSE
                  /\ UNCHANGED <<sTurn, sTurnRev, sRev, sTries>>
     ELSE /\ UNCHANGED <<rev, element, stopped>>
          /\ IF sTries < Tries
             THEN /\ sPc' = "retry"
                  /\ UNCHANGED <<sTurn, sTurnRev, sRev, sOut, sOutRev, sTries, sLanded, stopTold>>
             ELSE /\ StopEnds /\ stopTold' = FALSE
  /\ UNCHANGED <<shown, turn, turnRev, base, AgentVars, late, tools>>

StopSavesTurn ==
  /\ sPc = "settle"
  /\ Saves(sOut, sOutRev, sTurnRev)
  /\ StopEnds
  /\ stopTold' = TRUE
  /\ UNCHANGED <<DeckVars, base, AgentVars, stopped, late, tools>>

Done ==
  /\ aPc = "idle"
  /\ calls = 2
  /\ sPc = "done"
  /\ UNCHANGED vars

Next ==
  \/ AgentLoadsTurn \/ AgentLoadsDeck \/ AgentAddsSlide \/ AgentSavesTurn
  \/ StopLoadsTurn \/ StopLoadsDeck \/ StopCommits \/ StopSavesTurn
  \/ Done

Spec == Init /\ [][Next]_vars

\* Every slide of r lands on the revision the agent read.
SlideOnRead == [][rev' > rev /\ shown' > shown => base = rev]_vars

\* Every write lands on the revision its own try read, so a retried call is judged on the
\* deck as it is after the write it lost to.
WritesOnRead == [][rev' > rev => \/ aPc = "deck" /\ aRev = rev
                                 \/ sPc = "deck" /\ sRev = rev]_vars

\* A call changes the deck at most once, however many tries it took.
AppliesOnce == aLanded <= 1 /\ sLanded <= 1

\* A call counts as one tool call, however many tries it took.
CountsOnce == tools = calls + (IF sPc = "idle" THEN 0 ELSE 1)

\* A saved turn row never replaces one with a newer revision.
TurnNeverOlder == [][turnRev' >= turnRev]_vars

\* No slide of r lands once Stop took effect. late counts the ones that did.
StopFences == late = 0

\* The part of StopFences runFence keeps: no slide of a run that holds an element lands
\* once Stop took effect.
StopFencesHeldRun == element # "none" => late = 0

\* A turn row that names no run is saved only by a stop that already stopped r's element.
NoTurnWhileRunning == turn = "none" => element # "running"

\* After stop_run of r answered ok, the turn row no longer names r. serveMcp answers only
\* after the turn save, so the answer is the request's last step.
TurnStaysEnded == stopTold => turn # "r"
====
