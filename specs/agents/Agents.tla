---- MODULE Agents ----
\* Two agents of one account, a and b, edit one element x of one Doom deck. An agent is one
\* connected agent, named by its OAuth grant, or Aira, named by the account; the server
\* names it from the credential, never from the call, and writes that name as the author of
\* every edit the agent sends. Each tool call is one step here.
\* A run is one agent's: a1 and a2 are a's, b1 and b2 are b's, minted in that order. pa1,
\* pa2, pb1 and pb2 are each run's phase on the deck: idle before its start edit landed, then
\* running, then stopped. ver is x's version. A call of airdesign_execute reads the deck as it
\* stands when the call starts and sends no version from an earlier call, so a script can write
\* over a change made since its agent's last call, and this model has no silent overwrite rule.
\* A change to the same text or paint that lands while the call runs makes Doom refuse the
\* call's write as stale (a write's base, write in packages/doom/src/apply-edit.ts).
\* out is the answer to the last call.
\* mixed and stoppedOther record what the invariants forbid.
EXTENDS Integers, FiniteSets

CONSTANT MaxVer

VARIABLES pa1, pa2, pb1, pb2, ver, out, mixed, stoppedOther

vars == <<pa1, pa2, pb1, pb2, ver, out, mixed, stoppedOther>>

Agents == {"a", "b"}
Runs == {"a1", "a2", "b1", "b2"}
Phases == {"idle", "running", "stopped"}

OwnerOf(r) == IF r \in {"a1", "a2"} THEN "a" ELSE "b"
Owned(g) == {r \in Runs : OwnerOf(r) = g}
Phase(r) == CASE r = "a1" -> pa1 [] r = "a2" -> pa2 [] r = "b1" -> pb1 [] OTHER -> pb2
phase == [r \in Runs |-> Phase(r)]
SetPhases(f) == pa1' = f["a1"] /\ pa2' = f["a2"] /\ pb1' = f["b1"] /\ pb2' = f["b2"]
Fresh(g) == IF g = "a" THEN IF phase["a1"] = "idle" THEN "a1" ELSE "a2"
            ELSE IF phase["b1"] = "idle" THEN "b1" ELSE "b2"
Named == {r \in Runs : phase[r] # "idle"}

TypeOK ==
  /\ phase \in [Runs -> Phases]
  /\ ver \in 0..MaxVer
  /\ out \in {"none", "landed", "run-fenced", "stopped", "already"}
  /\ mixed \in BOOLEAN /\ stoppedOther \in BOOLEAN

Init ==
  /\ pa1 = "idle" /\ pa2 = "idle" /\ pb1 = "idle" /\ pb2 = "idle"
  /\ ver = 0
  /\ out = "none"
  /\ mixed = FALSE /\ stoppedOther = FALSE

Answer(o) == out' = o

Refused(o) ==
  /\ Answer(o)
  /\ UNCHANGED <<pa1, pa2, pb1, pb2, ver, mixed, stoppedOther>>

\* The write of x lands in run r: x's version moves on.
Lands(g, r, phases) ==
  /\ ver < MaxVer
  /\ SetPhases(phases)
  /\ ver' = ver + 1
  /\ mixed' = (mixed \/ OwnerOf(r) # g)
  /\ Answer("landed")
  /\ UNCHANGED stoppedOther

\* execute without runId: one call starts a fresh run, writes x, and stops every run of the
\* same agent that is still running (guardRun in packages/doom/src/apply-edit.ts).
AgentStarts(g) ==
  LET r == Fresh(g) IN
  /\ phase[r] = "idle"
  /\ Lands(g, r, [s \in Runs |-> IF s = r THEN "running"
                                   ELSE IF OwnerOf(s) = g /\ phase[s] = "running" THEN "stopped"
                                   ELSE phase[s]])

\* execute with runId r, any run the deck has held, the agent's own or the other's. Only
\* the agent's own running run takes it.
AgentWrites(g, r) ==
  /\ r \in Named
  /\ CASE phase[r] # "running" \/ OwnerOf(r) # g -> Refused("run-fenced")
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
                   /\ UNCHANGED <<ver, mixed>>

Done ==
  /\ ver = MaxVer
  /\ UNCHANGED vars

Next ==
  \/ \E g \in Agents :
       \/ AgentStarts(g)
       \/ \E r \in Runs : AgentWrites(g, r) \/ AgentStops(g, r)
  \/ Done

Spec == Init /\ [][Next]_vars

\* A run holds the writes of one agent only, so a person's Undo of that run takes back only
\* that agent's work. Harm: Undo removes another agent's edits.
RunsAreOwn == ~mixed

\* An agent's Stop never ends another agent's run. Harm: one agent stops another's work.
StopsOnlyOwn == ~stoppedOther

\* Each agent has at most one running run on the deck, so a run an agent left open ends at
\* its next start. Harm: runs nobody stops stay running for good.
OneRunEach == \A g \in Agents : Cardinality({r \in Owned(g) : phase[r] = "running"}) <= 1
====
