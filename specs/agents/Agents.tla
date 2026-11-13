---- MODULE Agents ----
\* Two agents of one account, a and b, edit one element x of one deck. An agent is one
\* connected agent, named by its OAuth grant, or Aira, named by the account; the server
\* names it from the credential, never from the call. Each call is one step here: one
\* agent's calls that interleave are slide-run's and slide-sibling's.
\* A run is one agent's: a1 and a2 are a's, b1 and b2 are b's, minted in that order, so an
\* agent owns a run exactly when the run id starts with the agent's key. holder is the run x
\* is running under, or none. turnA and turnB are each agent's session.agent_turn row: the
\* run it names, or none after a stop. liveA and liveB say whether that row's last call is
\* inside the ten-minute idle window. usedA and usedB count the runs each agent minted.
\* ver is x's version. readA and readB are the versions each agent last read or was
\* answered, which it sends as readAt; an agent's own write answers the new version, so a
\* read below ver means someone else wrote x since. out is the answer to the last edit or
\* stop_run naming another agent's run, and who sent it. overwrote, mixed and stoppedOther
\* record what the invariants forbid.
EXTENDS Integers

CONSTANT MaxVer

VARIABLES holder, turnA, turnB, liveA, liveB, usedA, usedB, ver, readA, readB,
          out, who, overwrote, mixed, stoppedOther

vars == <<holder, turnA, turnB, liveA, liveB, usedA, usedB, ver, readA, readB,
          out, who, overwrote, mixed, stoppedOther>>

Agents == {"a", "b"}
Runs == {"a1", "a2", "b1", "b2"}

Other(g) == IF g = "a" THEN "b" ELSE "a"
OwnerOf(r) == IF r \in {"a1", "a2"} THEN "a" ELSE "b"
Turn(g) == IF g = "a" THEN turnA ELSE turnB
Live(g) == IF g = "a" THEN liveA ELSE liveB
Used(g) == IF g = "a" THEN usedA ELSE usedB
Read(g) == IF g = "a" THEN readA ELSE readB
Old(g) == Read(g) # ver
Minted(g) == IF g = "a" THEN IF usedA = 0 THEN "a1" ELSE "a2" ELSE IF usedB = 0 THEN "b1" ELSE "b2"

TypeOK ==
  /\ holder \in Runs \cup {"none"}
  /\ turnA \in {"none", "a1", "a2"}
  /\ turnB \in {"none", "b1", "b2"}
  /\ liveA \in BOOLEAN /\ liveB \in BOOLEAN
  /\ usedA \in 0..2 /\ usedB \in 0..2
  /\ ver \in 0..MaxVer
  /\ readA \in 0..MaxVer /\ readB \in 0..MaxVer
  /\ out \in {"none", "landed", "stale", "held", "run-fenced"}
  /\ who \in Agents \cup {"none"}
  /\ overwrote \in BOOLEAN /\ mixed \in BOOLEAN /\ stoppedOther \in BOOLEAN

Init ==
  /\ holder = "none"
  /\ turnA = "none" /\ turnB = "none"
  /\ liveA = FALSE /\ liveB = FALSE
  /\ usedA = 0 /\ usedB = 0
  /\ ver = 0
  /\ readA = 0 /\ readB = 0
  /\ out = "none" /\ who = "none"
  /\ overwrote = FALSE /\ mixed = FALSE /\ stoppedOther = FALSE

\* liveTurn in packages/mcp/src/turn.ts: the agent's own row names a run inside the idle
\* window, and runFenced does not end it. A run here writes only x, so it is fenced once x
\* no longer runs under it.
LiveTurn(g) == Turn(g) # "none" /\ Live(g) /\ holder = Turn(g)

\* freed in packages/mcp/src/run.ts: x runs under another agent's run, and that agent's
\* row names the run inside the idle window.
HeldElsewhere(g) == holder # "none" /\ OwnerOf(holder) # g /\ Turn(Other(g)) = holder /\ Live(Other(g))

Answer(g, o) == out' = o /\ who' = g

SetAgent(g, turn, live, used, read) ==
  IF g = "a"
  THEN turnA' = turn /\ liveA' = live /\ usedA' = used /\ readA' = read
       /\ UNCHANGED <<turnB, liveB, usedB, readB>>
  ELSE turnB' = turn /\ liveB' = live /\ usedB' = used /\ readB' = read
       /\ UNCHANGED <<turnA, liveA, usedA, readA>>

\* The write lands: x's version moves on, and the writer is answered the new version.
Lands(g, run, used) ==
  /\ ver < MaxVer
  /\ holder' = run
  /\ ver' = ver + 1
  /\ SetAgent(g, run, TRUE, used, ver + 1)
  /\ overwrote' = (overwrote \/ Old(g))
  /\ mixed' = (mixed \/ OwnerOf(run) # g)
  /\ Answer(g, "landed")
  /\ UNCHANGED stoppedOther

Refused(g, o) ==
  /\ Answer(g, o)
  /\ UNCHANGED <<holder, turnA, turnB, liveA, liveB, usedA, usedB, ver, readA, readB,
                 overwrote, mixed, stoppedOther>>

\* read_deck answers x's version.
AgentReads(g) ==
  /\ Read(g) # ver
  /\ out' = "none" /\ who' = "none"
  /\ SetAgent(g, Turn(g), Live(g), Used(g), ver)
  /\ UNCHANGED <<holder, ver, overwrote, mixed, stoppedOther>>

\* edit_deck of x with the version the agent holds as readAt. In its live turn the call
\* joins its own run; x runs under it, and its readAt must be the version. With no live
\* turn the call opens a run: it stops the agent's own earlier runs and any run whose
\* agent's turn has ended, then starts a new run, whose readAt must be the version too.
\* Either way an element another agent's live turn holds refuses it as held.
AgentEdits(g) ==
  CASE HeldElsewhere(g) -> Refused(g, "held")
    [] LiveTurn(g) -> IF Read(g) = ver THEN Lands(g, Turn(g), Used(g)) ELSE Refused(g, "stale")
    [] OTHER -> /\ Used(g) < 2
                /\ IF Read(g) = ver THEN Lands(g, Minted(g), Used(g) + 1) ELSE Refused(g, "stale")

\* stop_run with the run the agent's own turn names: x stops if it runs under that run, and
\* the row then names none.
AgentStops(g) ==
  /\ Turn(g) # "none"
  /\ holder' = IF holder = Turn(g) THEN "none" ELSE holder
  /\ SetAgent(g, "none", Live(g), Used(g), Read(g))
  /\ stoppedOther' = (stoppedOther \/ (holder = Turn(g) /\ OwnerOf(holder) # g))
  /\ out' = "none" /\ who' = "none"
  /\ UNCHANGED <<ver, overwrote, mixed>>

\* stop_run naming the other agent's run is refused, and nothing changes.
AgentStopsOther(g) ==
  /\ Turn(Other(g)) # "none"
  /\ Refused(g, "run-fenced")

\* Ten minutes pass with no call from g. Its row stays; only the window closes.
Idle(g) ==
  /\ Turn(g) # "none"
  /\ Live(g)
  /\ IF g = "a" THEN liveA' = FALSE /\ UNCHANGED liveB ELSE liveB' = FALSE /\ UNCHANGED liveA
  /\ out' = "none" /\ who' = "none"
  /\ UNCHANGED <<holder, turnA, turnB, usedA, usedB, ver, readA, readB, overwrote, mixed, stoppedOther>>

Done ==
  /\ ver = MaxVer
  /\ UNCHANGED vars

Next ==
  \/ \E g \in Agents : AgentReads(g) \/ AgentEdits(g) \/ AgentStops(g) \/ AgentStopsOther(g) \/ Idle(g)
  \/ Done

Spec == Init /\ [][Next]_vars

\* An agent's edit never replaces another agent's edit of x that it had not read. Harm: an
\* agent's change is lost with no refusal, and no one is told.
NoSilentOverwrite == ~overwrote

\* A run holds the writes of one agent only, so a person's Undo of that run takes back only
\* that agent's work. Harm: Undo removes another agent's edits.
RunsAreOwn == ~mixed

\* An agent's Stop never ends another agent's run. Harm: one agent stops another's work.
StopsOnlyOwn == ~stoppedOther

\* An element is refused as held only while the other agent's live turn holds it, so no
\* hold outlives a turn. Harm: an agent is locked out of an element no one is working on.
HeldOnlyWhileLive == out = "held" => holder # "none" /\ OwnerOf(holder) = Other(who) /\ Live(Other(who))
====
