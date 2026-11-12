---- MODULE Index ----
EXTENDS Integers

\* The browser keeps an import index of two pages in a queue and sends one page at a time.
\* sent counts the pages handed to the server, acked is the queue's sent count kept in the browser.
\* An upgrade queues the same pages again with their layouts, once, when a deck opens.
\* An answer writes the sent count its own send loop read, so it can overwrite the upgrade's reset.

VARIABLES queued, sent, stored, acked, crashed, online, edited, revision, upgraded, flightOld, layered
vars == <<queued, sent, stored, acked, crashed, online, edited, revision, upgraded, flightOld, layered>>

Init ==
  /\ queued = 0 /\ sent = 0 /\ stored = 0 /\ acked = 0
  /\ crashed = FALSE /\ online = FALSE /\ edited = FALSE /\ revision = 0
  /\ upgraded = FALSE /\ flightOld = FALSE /\ layered = FALSE

QueueImport ==
  /\ queued = 0 /\ queued' = 2
  /\ UNCHANGED <<sent, stored, acked, crashed, online, edited, revision, upgraded, flightOld, layered>>

Connect ==
  /\ online' = ~online
  /\ UNCHANGED <<queued, sent, stored, acked, crashed, edited, revision, upgraded, flightOld, layered>>

Send ==
  /\ online /\ ~crashed /\ sent = acked /\ sent < queued
  /\ sent' = sent + 1
  /\ flightOld' = FALSE
  /\ UNCHANGED <<queued, stored, acked, crashed, online, edited, revision, upgraded, layered>>

Store ==
  /\ online /\ ~crashed /\ sent > acked
  /\ stored' = IF sent > stored THEN sent ELSE stored
  /\ layered' = (layered \/ (upgraded /\ ~flightOld))
  /\ UNCHANGED <<queued, sent, acked, crashed, online, edited, revision, upgraded, flightOld>>

Ack ==
  /\ online /\ ~crashed /\ sent > acked /\ stored >= sent
  /\ acked' = sent
  /\ flightOld' = FALSE
  /\ UNCHANGED <<queued, sent, stored, crashed, online, edited, revision, upgraded, layered>>

Crash ==
  /\ ~crashed /\ crashed' = TRUE /\ sent' = acked
  /\ flightOld' = FALSE
  /\ UNCHANGED <<queued, stored, acked, online, edited, revision, upgraded, layered>>

Resume ==
  /\ crashed /\ crashed' = FALSE
  /\ UNCHANGED <<queued, sent, stored, acked, online, edited, revision, upgraded, flightOld, layered>>

Edit ==
  /\ ~edited /\ edited' = TRUE /\ revision' = 1
  /\ UNCHANGED <<queued, sent, stored, acked, crashed, online, upgraded, flightOld, layered>>

\* keepIndex in packages/live/src/deck-index.ts rewrites the queue to sent 0. A page already in flight stays in flight.
Upgrade ==
  /\ queued = 2 /\ ~upgraded
  /\ upgraded' = TRUE
  /\ acked' = 0
  /\ sent' = IF sent > acked THEN sent ELSE 0
  /\ flightOld' = (sent > acked)
  /\ UNCHANGED <<queued, stored, crashed, online, edited, revision, layered>>

Next == QueueImport \/ Connect \/ Send \/ Store \/ Ack \/ Crash \/ Resume \/ Edit \/ Upgrade

TypeOK ==
  /\ queued \in {0, 2} /\ sent \in 0..2 /\ stored \in 0..2 /\ acked \in 0..2
  /\ crashed \in BOOLEAN /\ online \in BOOLEAN /\ edited \in BOOLEAN /\ revision \in 0..1
  /\ upgraded \in BOOLEAN /\ flightOld \in BOOLEAN /\ layered \in BOOLEAN

OnlyEditsChangeRevision == revision = IF edited THEN 1 ELSE 0
AcknowledgedIsStored == acked <= stored
PagesStayOrdered == sent <= queued /\ stored <= queued /\ acked <= sent

\* Once the upgraded queue is sent and acknowledged, the server holds the layouts.
UpgradeReachesServer == (upgraded /\ acked = queued /\ sent = acked) => layered

Spec == Init /\ [][Next]_vars
====
