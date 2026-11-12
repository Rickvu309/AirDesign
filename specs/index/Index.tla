---- MODULE Index ----
EXTENDS Integers

VARIABLES queued, sent, stored, acked, crashed, online, edited, revision
vars == <<queued, sent, stored, acked, crashed, online, edited, revision>>

Init ==
  /\ queued = 0 /\ sent = 0 /\ stored = 0 /\ acked = 0
  /\ crashed = FALSE /\ online = FALSE /\ edited = FALSE /\ revision = 0

QueueImport ==
  /\ queued = 0 /\ queued' = 2
  /\ UNCHANGED <<sent, stored, acked, crashed, online, edited, revision>>

Connect ==
  /\ online' = ~online
  /\ UNCHANGED <<queued, sent, stored, acked, crashed, edited, revision>>

Send ==
  /\ online /\ ~crashed /\ sent = acked /\ sent < queued
  /\ sent' = sent + 1
  /\ UNCHANGED <<queued, stored, acked, crashed, online, edited, revision>>

Store ==
  /\ online /\ ~crashed /\ sent > acked
  /\ stored' = IF sent > stored THEN sent ELSE stored
  /\ UNCHANGED <<queued, sent, acked, crashed, online, edited, revision>>

Ack ==
  /\ online /\ ~crashed /\ sent > acked /\ stored >= sent
  /\ acked' = sent
  /\ UNCHANGED <<queued, sent, stored, crashed, online, edited, revision>>

Crash ==
  /\ ~crashed /\ crashed' = TRUE /\ sent' = acked
  /\ UNCHANGED <<queued, stored, acked, online, edited, revision>>

Resume ==
  /\ crashed /\ crashed' = FALSE
  /\ UNCHANGED <<queued, sent, stored, acked, online, edited, revision>>

Edit ==
  /\ ~edited /\ edited' = TRUE /\ revision' = 1
  /\ UNCHANGED <<queued, sent, stored, acked, crashed, online>>

Next == QueueImport \/ Connect \/ Send \/ Store \/ Ack \/ Crash \/ Resume \/ Edit

TypeOK ==
  /\ queued \in {0, 2} /\ sent \in 0..2 /\ stored \in 0..2 /\ acked \in 0..2
  /\ crashed \in BOOLEAN /\ online \in BOOLEAN /\ edited \in BOOLEAN /\ revision \in 0..1

OnlyEditsChangeRevision == revision = IF edited THEN 1 ELSE 0
AcknowledgedIsStored == acked <= stored
PagesStayOrdered == sent <= queued /\ stored <= queued /\ acked <= sent
Spec == Init /\ [][Next]_vars
====
