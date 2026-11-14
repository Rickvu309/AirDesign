---- MODULE Index ----
EXTENDS Integers

\* An older build keeps an import index of two pages in a queue and sends one page at a time.
\* sent counts the pages handed to the server, acked is the queue's sent count kept in the browser.
\* A device at a higher format reads the stored format from its open answer and queues every page again, once.
\* The server builds those pages beside the stored index and swaps them in whole once both are stored.
\* A re-sent page whose opening values differ from the stored ones (drift) is refused, and the device drops that queue.
\* An answer advances the sent count only while the queue is the one its send loop read, so it cannot overwrite the re-send.

VARIABLES queued, sent, stored, acked, crashed, online, edited, revision, resent, flightOld, format, beside, drift, landed
vars == <<queued, sent, stored, acked, crashed, online, edited, revision, resent, flightOld, format, beside, drift, landed>>

Init ==
  /\ queued = 0 /\ sent = 0 /\ stored = 0 /\ acked = 0
  /\ crashed = FALSE /\ online = FALSE /\ edited = FALSE /\ revision = 0
  /\ resent = FALSE /\ flightOld = FALSE /\ format = 1 /\ beside = 0
  /\ drift = FALSE /\ landed = FALSE

QueueImport ==
  /\ queued = 0 /\ queued' = 2
  /\ UNCHANGED <<sent, stored, acked, crashed, online, edited, revision, resent, flightOld, format, beside, drift, landed>>

Connect ==
  /\ online' = ~online
  /\ UNCHANGED <<queued, sent, stored, acked, crashed, edited, revision, resent, flightOld, format, beside, drift, landed>>

Send ==
  /\ online /\ ~crashed /\ sent = acked /\ sent < queued
  /\ sent' = sent + 1
  /\ flightOld' = FALSE
  /\ landed' = FALSE
  /\ UNCHANGED <<queued, stored, acked, crashed, online, edited, revision, resent, format, beside, drift>>

\* appendIndex in packages/document/src/deck-index.ts. A page at the stored format appends or replays.
\* A page above it builds beside, refusing drift; the last page swaps the whole index in.
StoreOlder ==
  /\ stored' = IF sent > stored THEN sent ELSE stored
  /\ UNCHANGED <<format, beside>>

StoreNewer ==
  LET built == IF sent > beside THEN sent ELSE beside IN
  IF drift THEN UNCHANGED <<stored, format, beside>>
  ELSE /\ beside' = built
       /\ IF built = 2 THEN format' = 2 /\ stored' = built ELSE UNCHANGED <<stored, format>>

Store ==
  /\ online /\ ~crashed /\ sent > acked
  /\ IF resent /\ ~flightOld THEN StoreNewer ELSE StoreOlder
  /\ landed' = TRUE
  /\ UNCHANGED <<queued, sent, acked, crashed, online, edited, revision, resent, flightOld, drift>>

\* The server refuses every page of a drifted re-send, so the page that landed was refused.
Refused == resent /\ drift /\ ~flightOld

\* sendIndex swaps the queue slot only if it still holds the queue it sent from; otherwise it reads the new queue.
\* A refused page ends its queue, so the rows behind it still send.
Ack ==
  /\ online /\ ~crashed /\ sent > acked /\ landed
  /\ acked' = IF flightOld THEN acked ELSE IF Refused THEN queued ELSE sent
  /\ sent' = IF flightOld THEN acked ELSE IF Refused THEN queued ELSE sent
  /\ flightOld' = FALSE
  /\ UNCHANGED <<queued, stored, crashed, online, edited, revision, resent, format, beside, drift, landed>>

Crash ==
  /\ ~crashed /\ crashed' = TRUE /\ sent' = acked
  /\ flightOld' = FALSE
  /\ UNCHANGED <<queued, stored, acked, online, edited, revision, resent, format, beside, drift, landed>>

Resume ==
  /\ crashed /\ crashed' = FALSE
  /\ UNCHANGED <<queued, sent, stored, acked, online, edited, revision, resent, flightOld, format, beside, drift, landed>>

Edit ==
  /\ ~edited /\ edited' = TRUE /\ revision' = 1
  /\ UNCHANGED <<queued, sent, stored, acked, crashed, online, resent, flightOld, format, beside, drift, landed>>

\* keepIndex in packages/live/src/deck-index.ts replaces an older format's queue with sent 0. A page already in flight stays in flight.
\* It starts once the older index is complete, as on every deck stored before the format rose.
\* drift is a device whose reader gives the stored opening values differently, so the server refuses each of its pages.
Resend ==
  /\ queued = 2 /\ stored = 2 /\ ~resent /\ format = 1
  /\ resent' = TRUE
  /\ drift' \in BOOLEAN
  /\ acked' = 0
  /\ sent' = IF sent > acked THEN sent ELSE 0
  /\ flightOld' = (sent > acked)
  /\ UNCHANGED <<queued, stored, crashed, online, edited, revision, format, beside, landed>>

Next == QueueImport \/ Connect \/ Send \/ Store \/ Ack \/ Crash \/ Resume \/ Edit \/ Resend

TypeOK ==
  /\ queued \in {0, 2} /\ sent \in 0..2 /\ stored \in 0..2 /\ acked \in 0..2
  /\ crashed \in BOOLEAN /\ online \in BOOLEAN /\ edited \in BOOLEAN /\ revision \in 0..1
  /\ resent \in BOOLEAN /\ flightOld \in BOOLEAN /\ format \in {1, 2} /\ beside \in 0..2
  /\ drift \in BOOLEAN /\ landed \in BOOLEAN

Held == IF resent THEN beside ELSE stored

OnlyEditsChangeRevision == revision = IF edited THEN 1 ELSE 0
AcknowledgedIsStored == acked <= Held \/ (resent /\ drift)
PagesStayOrdered == sent <= queued /\ stored <= queued /\ acked <= sent

\* The server never holds part of a newer index as the stored one.
SwapIsWhole == format = 2 => stored = 2

\* A re-send that reads an opening value differently never reaches the server, beside the stored index or in it.
SwapKeepsOpening == (beside > 0 \/ format = 2) => ~drift

\* Once the re-sent queue is sent and acknowledged, the server holds the newer index.
ResendReachesServer == (resent /\ ~drift /\ acked = queued /\ sent = acked) => format = 2

\* The stored index is never deleted or rewritten in place: its pages only grow, and its format only rises by a whole swap.
StoredOnlyGrows ==
  [][/\ stored' >= stored
     /\ (format' = format \/ (format = 1 /\ format' = 2 /\ stored' = 2))]_vars

Spec == Init /\ [][Next]_vars
====
