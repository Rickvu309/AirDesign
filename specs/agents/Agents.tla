---- MODULE Agents ----
\* Two agents of one account, a and b, edit one element x of one Doom deck. An agent is one
\* connected agent, named by its OAuth grant, or Aira, named by the account; the server
\* names it from the credential, never from the call, and writes that name as the author of
\* every edit the agent sends. Each tool call is one step here.
\* A run is one agent's: a1 and a2 are a's, b1 and b2 are b's, minted in that order. pa1,
\* pa2, pb1 and pb2 are each run's phase on the deck: idle before its start edit landed, then
\* running, then stopped. ver is x's version. readA and readB are the versions each agent last read or was
\* answered, which it sends as base; an agent's own write answers the new version, so a read
\* below ver means someone else wrote x since. out is the answer to the last call.
\* overwrote, mixed and stoppedOther record what the invariants forbid.
EXTENDS Integers, FiniteSets

CONSTANT MaxVer

VARIABLES pa1, pa2, pb1, pb2, ver, readA, readB, out, overwrote, mixed, stoppedOther

vars == <<pa1, pa2, pb1, pb2, ver, readA, readB, out, overwrote, mixed, stoppedOther>>

Agents == {"a", "b"}
Runs == {"a1", "a2", "b1", "b2"}
Phases == {"idle", "running", "stopped"}

OwnerOf(r) == IF r \in {"a1", "a2"} THEN "a" ELSE "b"
Owned(g) == {r \in Runs : OwnerOf(r) = g}
Phase(r) == CASE r = "a1" -> pa1 [] r = "a2" -> pa2 [] r = "b1" -> pb1 [] OTHER -> pb2
phase == [r \in Runs |-> Phase(r)]
SetPhases(f) == pa1' = f["a1"] /\ pa2' = f["a2"] /\ pb1' = f["b1"] /\ pb2' = f["b2"]
Read(g) == IF g = "a" THEN readA ELSE readB
Fresh(g) == IF g = "a" THEN IF phase["a1"] = "idle" THEN "a1" ELSE "a2"
            ELSE IF phase["b1"] = "idle" THEN "b1" ELSE "b2"
Named == {r \in Runs : phase[r] # "idle"}

TypeOK ==
  /\ phase \in [Runs -> Phases]
  /\ ver \in 0..MaxVer
  /\ readA \in 0..MaxVer /\ readB \in 0..MaxVer
  /\ out \in {"none", "landed", "stale", "run-fenced", "stopped", "already"}
  /\ overwrote \in BOOLEAN /\ mixed \in BOOLEAN /\ stoppedOther \in BOOLEAN

Init ==
  /\ pa1 = "idle" /\ pa2 = "idle" /\ pb1 = "idle" /\ pb2 = "idle"
  /\ ver = 0
  /\ readA = 0 /\ readB = 0
  /\ out = "none"
  /\ overwrote = FALSE /\ mixed = FALSE /\ stoppedOther = FALSE

Answer(o) == out' = o

SetRead(g, v) ==
  IF g = "a" THEN readA' = v /\ UNCHANGED readB ELSE readB' = v /\ UNCHANGED readA

Refused(o) ==
  /\ Answer(o)
  /\ UNCHANGED <<pa1, pa2, pb1, pb2, ver, readA, readB, overwrote, mixed, stoppedOther>>

\* The write of x lands in run r: x's version moves on, and the writer is answered it.
Lands(g, r, phases) ==
  /\ ver < MaxVer
  /\ SetPhases(phases)
  /\ ver' = ver + 1
  /\ SetRead(g, ver + 1)
  /\ overwrote' = (overwrote \/ Read(g) # ver)
  /\ mixed' = (mixed \/ OwnerOf(r) # g)
  /\ Answer("landed")
  /\ UNCHANGED stoppedOther

\* read_deck answers x's version.
AgentReads(g) ==
  /\ Read(g) # ver
  /\ SetRead(g, ver)
  /\ out' = "none"
  /\ UNCHANGED <<pa1, pa2, pb1, pb2, ver, overwrote, mixed, stoppedOther>>

\* edit_deck without runId: one edit starts a fresh run, writes x on the version the agent
\* holds, and stops every run of the same agent that is still running (guardRun in
\* packages/doom/src/apply-edit.ts). A stale write refuses the whole edit, start included.
AgentStarts(g) ==
  LET r == Fresh(g) IN
  /\ phase[r] = "idle"
  /\ IF Read(g) = ver
     THEN Lands(g, r, [s \in Runs |-> IF s = r THEN "running"
                                      ELSE IF OwnerOf(s) = g /\ phase[s] = "running" THEN "stopped"
                                      ELSE phase[s]])
     ELSE Refused("stale")

\* edit_deck with runId r, any run the deck has held, the agent's own or the other's. Only
\* the agent's own running run takes it; then its write must be on x's version.
AgentWrites(g, r) ==
  /\ r \in Named
  /\ CASE phase[r] # "running" \/ OwnerOf(r) # g -> Refused("run-fenced")
       [] Read(g) # ver -> Refused("stale")
       [] OTHER -> Lands(g, r, phase)

\* stop_run with run r. Another agent's run is refused and keeps running; the agent's own
\* running run stops; its own stopped run is answered as already stopped.
AgentStops(g, r) ==
  /\ r \in Named
  /\ CASE OwnerOf(r) # g -> Refused("run-fenced")
       [] phase[r] = "stopped" -> Refused("already")
       [] OTHER -> /\ SetPhases([phase EXCEPT ![r] = "stopped"])
                   /\ stoppedOther' = (stoppedOther \/ OwnerOf(r) # g)
                   /\ Answer("stopped")
                   /\ UNCHANGED <<ver, readA, readB, overwrote, mixed>>

Done ==
  /\ ver = MaxVer
  /\ UNCHANGED vars

Next ==
  \/ \E g \in Agents :
       \/ AgentReads(g)
       \/ AgentStarts(g)
       \/ \E r \in Runs : AgentWrites(g, r) \/ AgentStops(g, r)
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

\* Each agent has at most one running run on the deck, so a run an agent left open ends at
\* its next start. Harm: runs nobody stops stay running for good.
OneRunEach == \A g \in Agents : Cardinality({r \in Owned(g) : phase[r] = "running"}) <= 1
====
