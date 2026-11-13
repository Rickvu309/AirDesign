---- MODULE SlideSibling ----
\* One live turn of agent run r on one deck. The agent read the deck at Base and sent two
\* calls of the turn at once with that base: add_slide, and edit_deck of an element no
\* person edits. Both join r, the turn's run; the turn model covers how. A person may edit
\* another element once, at any time.
\* Each call is one MCP request. settledCall in packages/mcp/src/server.ts runs up to three
\* tries: each try reads the deck and decides, and commitEdit writes the deck only if
\* deck.saved still has the revision that try read. A lost write sends the call back to
\* read again. The person's edit is commitEdits in apps/api/src/saved.ts, one step, since it
\* reads and writes in its own compare-and-swap loop.
\* last is the deck's lastRun: the run whose calls wrote its latest revisions, or none once
\* a write that records no run, such as the person's, moved the revision. since is the
\* revision those calls began writing on. foreign is the latest revision a write other than
\* r's made.
EXTENDS Integers

CONSTANT Tries

VARIABLES rev, last, since, slides, edits, foreign, person,
          sPc, sRev, sTries, sOut, ePc, eRev, eTries, eOut

vars == <<rev, last, since, slides, edits, foreign, person,
          sPc, sRev, sTries, sOut, ePc, eRev, eTries, eOut>>

Base == 1

Pcs == {"idle", "write", "done"}

Outs == {"none", "landed", "stale"}

TypeOK ==
  /\ rev \in 1..5
  /\ last \in {"r", "none"}
  /\ since \in 0..5
  /\ slides \in 0..2
  /\ edits \in 0..2
  /\ foreign \in 0..5
  /\ person \in BOOLEAN
  /\ sPc \in Pcs /\ sRev \in 0..5 /\ sTries \in 0..Tries /\ sOut \in Outs
  /\ ePc \in Pcs /\ eRev \in 0..5 /\ eTries \in 0..Tries /\ eOut \in Outs

\* The base's revision is r's own earlier call, or another writer's.
Init ==
  /\ rev = Base
  /\ last \in {"r", "none"}
  /\ since = 0
  /\ slides = 0
  /\ edits = 0
  /\ foreign = IF last = "r" THEN 0 ELSE Base
  /\ person = FALSE
  /\ sPc = "idle" /\ sRev = 0 /\ sTries = 0 /\ sOut = "none"
  /\ ePc = "idle" /\ eRev = 0 /\ eTries = 0 /\ eOut = "none"

SlideVars == <<sPc, sRev, sTries, sOut>>
EditVars == <<ePc, eRev, eTries, eOut>>

\* landed in packages/engine/src/call.ts records r as the deck's lastRun, from the revision
\* its unbroken writes began on.
RWrites ==
  /\ rev' = rev + 1
  /\ last' = "r"
  /\ since' = IF last = "r" THEN since ELSE rev

\* readFresh in agentSlide: the base is the deck's revision, or the deck's lastRun is r and
\* began on the base or before it.
Fresh == Base = rev \/ (last = "r" /\ since <= Base)

SlideReads ==
  /\ sPc = "idle"
  /\ sTries < Tries
  /\ sTries' = sTries + 1
  /\ sRev' = rev
  /\ IF Fresh
     THEN sPc' = "write" /\ UNCHANGED sOut
     ELSE sPc' = "done" /\ sOut' = "stale"
  /\ UNCHANGED <<rev, last, since, slides, edits, foreign, person, EditVars>>

SlideWrites ==
  /\ sPc = "write"
  /\ IF rev = sRev
     THEN /\ RWrites
          /\ slides' = slides + 1
          /\ sPc' = "done"
          /\ sOut' = "landed"
          /\ UNCHANGED <<edits, foreign>>
     ELSE /\ IF sTries < Tries
             THEN sPc' = "idle" /\ UNCHANGED sOut
             ELSE sPc' = "done" /\ sOut' = "stale"
          /\ UNCHANGED <<rev, last, since, slides, edits, foreign>>
  /\ UNCHANGED <<person, sRev, sTries, EditVars>>

\* An edit decides on the element's version, not on the base, and no one else edits it.
EditReads ==
  /\ ePc = "idle"
  /\ eTries < Tries
  /\ eTries' = eTries + 1
  /\ eRev' = rev
  /\ ePc' = "write"
  /\ UNCHANGED <<rev, last, since, slides, edits, foreign, person, eOut, SlideVars>>

EditWrites ==
  /\ ePc = "write"
  /\ IF rev = eRev
     THEN /\ RWrites
          /\ edits' = edits + 1
          /\ ePc' = "done"
          /\ eOut' = "landed"
          /\ UNCHANGED <<slides, foreign>>
     ELSE /\ IF eTries < Tries
             THEN ePc' = "idle" /\ UNCHANGED eOut
             ELSE ePc' = "done" /\ eOut' = "stale"
          /\ UNCHANGED <<rev, last, since, slides, edits, foreign>>
  /\ UNCHANGED <<person, eRev, eTries, SlideVars>>

\* A person's edit records no run, so the deck's lastRun no longer reaches its revision.
PersonEdits ==
  /\ ~person
  /\ person' = TRUE
  /\ rev' = rev + 1
  /\ last' = "none"
  /\ since' = 0
  /\ foreign' = rev + 1
  /\ UNCHANGED <<slides, edits, SlideVars, EditVars>>

Done ==
  /\ sPc = "done"
  /\ ePc = "done"
  /\ person
  /\ UNCHANGED vars

Next == SlideReads \/ SlideWrites \/ EditReads \/ EditWrites \/ PersonEdits \/ Done

Spec == Init /\ [][Next]_vars

\* Calls of one live turn that touch different things both land, whatever order their reads
\* and writes take, when nothing but their run wrote after their base.
TurnCallsBothLand == sPc = "done" /\ ePc = "done" /\ foreign <= Base => sOut = "landed" /\ eOut = "landed"

\* The edit lands even when the person wrote: it touches another element.
EditLands == ePc = "done" => eOut = "landed"

\* A slide call is refused stale only when a write other than its run's landed after its base.
StaleOnlyForOthers == sOut = "stale" => foreign > Base

\* A slide lands only when nothing but its run wrote after its base, even when its run wrote
\* last. Harm if broken: the agent adds a slide to a deck a person changed since it read it.
SlideOnOwnRead == [][slides' > slides => foreign <= Base]_vars

\* A call changes the deck at most once, however many tries it took.
AppliesOnce == slides <= 1 /\ edits <= 1

\* Every write lands on the revision its own try read.
WritesOnRead ==
  [][rev' > rev /\ person' = person => \/ sPc = "write" /\ sRev = rev
                                       \/ ePc = "write" /\ eRev = rev]_vars
====
