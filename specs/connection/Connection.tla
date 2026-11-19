---- MODULE Connection ----
\* How the open editor follows the network and what its save status tells the person.
\* useDeckStatus in apps/web/src/editor/use-deck-status.ts keeps three flags: online, the browser's
\* navigator.onLine; offline, whether the last send found no server; and whether rows
\* wait on the device. pending has one owner: watchUnsent in packages/live/src/held.ts tells the
\* editor after every write and read of the deck's rows, so pending is rows and no send's answer
\* writes it. saveStatus turns them into Saved, Saving,
\* Offline or Unable to reach AirDesign. useNetwork in apps/web/src/editor/use-network.ts sets
\* offline on the browser's offline event, sends on its online event, and runs resendPending from
\* apps/web/src/deck-resend.ts while online, offline and pending all hold. Each send is
\* flushPending in apps/web/src/commit-edit.ts, and settle reads its outcome into offline.
\* The device's queue is one flag, rows: some rows wait on the device or none. Every send joins
\* one lane per deck (serial in packages/live/src/cache.ts) and the first in the lane is the only
\* one on the wire. It carries every row the device holds when it starts. It answers sent when no
\* rows remain after the send, kept when rows remain, and offline when it failed to reach the server.
\* The lane is a number whose digits are its sends, the first one first:
\* 1 the online event's, 2 the resend loop's, 3 an edit's or the deck's opening, 4 a send of a
\* resend loop that was stopped, whose answer nobody reads.
EXTENDS Integers

VARIABLES open, net, up, rows, fresh, offline, lane, started, carry, loop, flips, outages, edits

vars == <<open, net, up, rows, fresh, offline, lane, started, carry, loop, flips, outages, edits>>

Event == 1
Resend == 2
Edit == 3
Stopped == 4

RECURSIVE Length(_)
Length(n) == IF n = 0 THEN 0 ELSE 1 + Length(n \div 10)

RECURSIVE Power(_)
Power(n) == IF n = 0 THEN 1 ELSE 10 * Power(n - 1)

First(n) == n \div Power(Length(n) - 1)
Rest(n) == n % Power(Length(n) - 1)
Join(n, send) == n * 10 + send

RECURSIVE Has(_, _)
Has(n, send) == IF n = 0 THEN FALSE ELSE n % 10 = send \/ Has(n \div 10, send)

RECURSIVE Stop(_)
Stop(n) == IF n = 0 THEN 0 ELSE Stop(n \div 10) * 10 + (IF n % 10 = Resend THEN Stopped ELSE n % 10)

\* saveStatus, with no refusal from the server.
Status(n, p, o) == IF ~n THEN "offline" ELSE IF ~p THEN "saved" ELSE IF o THEN "unreached" ELSE "saving"

\* The effect in useNetwork starts resendPending when online, offline and pending all come to
\* hold, and its cleanup stops it when one of them goes or the editor closes. A stopped loop's
\* send stays in the lane. React runs the effect in the same step that changed the flags.
Unsent(o, n, f, p) == o /\ n /\ f /\ p
Looping(before, after, now) == IF after /\ ~before THEN "rest" ELSE IF before /\ ~after THEN "off" ELSE now
Stopping(before, after, now, l) == IF before /\ ~after /\ now = "wait" THEN Stop(l) ELSE l

TypeOK ==
  /\ open \in BOOLEAN
  /\ net \in BOOLEAN
  /\ up \in BOOLEAN
  /\ rows \in BOOLEAN
  /\ fresh \in BOOLEAN
  /\ offline \in BOOLEAN
  /\ lane \in 0..44444
  /\ started \in BOOLEAN
  /\ carry \in BOOLEAN
  /\ loop \in {"off", "rest", "wait"}
  /\ flips \in 0..2
  /\ outages \in 0..1
  /\ edits \in 0..2

\* The deck is open and online. Rows from an earlier visit may wait on the device, and the deck's
\* opening send (useDeckOpen's flushPending) is in the lane.
Init ==
  /\ open = TRUE
  /\ net = TRUE
  /\ up = TRUE
  /\ rows \in BOOLEAN
  /\ fresh = FALSE
  /\ offline = ~net
  /\ lane = IF rows THEN Edit ELSE 0
  /\ started = FALSE
  /\ carry = FALSE
  /\ loop = "off"
  /\ flips = 0
  /\ outages = 0
  /\ edits = IF rows THEN 1 ELSE 0

Was == Unsent(open, net, offline, rows)

\* The browser fires offline, and leftNetwork sets offline.
GoOffline ==
  /\ net
  /\ flips < 2
  /\ edits < 2
  /\ net' = FALSE
  /\ flips' = flips + 1
  /\ offline' = (open \/ offline)
  /\ loop' = Looping(Was, FALSE, loop)
  /\ lane' = Stopping(Was, FALSE, loop, lane)
  /\ UNCHANGED <<open, up, rows, fresh, started, carry, outages, edits>>

\* The browser fires online, and the open editor sends at once.
GoOnline ==
  /\ ~net
  /\ flips < 2
  /\ edits < 2
  /\ net' = TRUE
  /\ flips' = flips + 1
  /\ lane' = IF open THEN Join(lane, Event) ELSE lane
  /\ loop' = Looping(FALSE, Unsent(open, TRUE, offline, rows), loop)
  /\ UNCHANGED <<open, up, rows, fresh, offline, started, carry, outages, edits>>

ServerDown ==
  /\ up
  /\ outages < 1
  /\ edits < 2
  /\ up' = FALSE
  /\ outages' = outages + 1
  /\ UNCHANGED <<open, net, rows, fresh, offline, lane, started, carry, loop, flips, edits>>

ServerUp ==
  /\ ~up
  /\ up' = TRUE
  /\ UNCHANGED <<open, net, rows, fresh, offline, lane, started, carry, loop, flips, outages,
                 edits>>

\* The person edits: the device writes a row, and its send joins the lane.
\* A row written while a send is on the wire is not in that send.
EditRow ==
  /\ open
  /\ (edits < 1 \/ (edits = 1 /\ started /\ carry /\ flips = 0 /\ outages = 0))
  /\ edits' = edits + 1
  /\ rows' = TRUE
  /\ fresh' = (fresh \/ started)
  /\ lane' = Join(lane, Edit)
  /\ loop' = Looping(Was, Unsent(open, net, offline, TRUE), loop)
  /\ UNCHANGED <<open, net, up, offline, started, carry, flips, outages>>

\* The first send in the lane goes on the wire with every row the device holds.
Send ==
  /\ lane # 0
  /\ ~started
  /\ started' = TRUE
  /\ carry' = rows
  /\ fresh' = FALSE
  /\ UNCHANGED <<open, net, up, rows, offline, lane, loop, flips, outages, edits>>

\* Its answer comes and leaves the lane. Its caller settles it, unless the editor closed or the
\* loop that sent it was stopped. The resend loop ends on any outcome but offline, and rests
\* before the next try on offline.
Answer ==
  /\ started
  /\ LET reached == net /\ up
         remaining == IF carry /\ reached THEN fresh ELSE rows
         outcome == IF carry /\ ~reached THEN "offline" ELSE IF remaining THEN "kept" ELSE "sent"
         caller == First(lane)
         heard == (caller \in {Event, Edit} /\ open) \/ caller = Resend
         offline2 == IF heard THEN outcome = "offline" ELSE offline
         loop2 == IF caller = Resend THEN (IF outcome = "offline" THEN "rest" ELSE "off") ELSE loop
         after == Unsent(open, net, offline2, remaining)
     IN /\ rows' = remaining
        /\ fresh' = FALSE
        /\ started' = FALSE
        /\ carry' = FALSE
        /\ offline' = offline2
        /\ loop' = Looping(Was, after, loop2)
        /\ lane' = Stopping(Was, after, loop2, Rest(lane))
  /\ UNCHANGED <<open, net, up, flips, outages, edits>>

\* The resend loop's pause ends and it sends.
Retry ==
  /\ loop = "rest"
  /\ loop' = "wait"
  /\ lane' = Join(lane, Resend)
  /\ UNCHANGED <<open, net, up, rows, fresh, offline, started, carry, flips, outages, edits>>

\* The person leaves the deck while a resend loop runs. useNetwork's cleanup removes the
\* listeners and stops the loop.
Leave ==
  /\ open
  /\ loop # "off"
  /\ open' = FALSE
  /\ loop' = Looping(Was, FALSE, loop)
  /\ lane' = Stopping(Was, FALSE, loop, lane)
  /\ UNCHANGED <<net, up, rows, fresh, offline, started, carry, flips, outages, edits>>

Next == GoOffline \/ GoOnline \/ ServerDown \/ ServerUp \/ EditRow \/ Send \/ Answer \/ Retry \/ Leave

Spec == Init /\ [][Next]_vars /\ WF_vars(Send) /\ WF_vars(Answer) /\ WF_vars(Retry) /\ WF_vars(ServerUp)

Shown == Status(net, rows, offline)

\* The browser going offline reads Offline at once, with or without rows waiting.
TellsWhenOffline == open /\ ~net => Shown = "offline"

\* The editor reports Saved only after the server has every row.
SavedOnlyWhenLanded == open /\ Shown = "saved" => ~rows

\* Online, with nothing waiting, every send answered and no resend due, the status never says the
\* server was not reached.
Settled == open /\ net /\ ~rows /\ lane = 0 /\ loop = "off"
NoUnreachedWhenAnswered == Settled => Shown \notin {"offline", "unreached"}

\* And it says Saved.
SavedWhenSettled == Settled => Shown = "saved"

\* Once the editor closed, no resend loop runs and none of its sends is read.
StopsOnLeave == ~open => loop = "off" /\ ~Has(lane, Resend)

\* A resend loop's send in the lane is the one running loop's.
OneLoop == Has(lane, Resend) <=> loop = "wait"

\* Once the network stays back and the server answers, the rows go and the status says Saved.
SavesOnceAnswered == <>[](open /\ net) => <>[](~rows /\ Shown = "saved")

====
