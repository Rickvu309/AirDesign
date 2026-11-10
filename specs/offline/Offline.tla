---- MODULE Offline ----
EXTENDS Integers

VARIABLES
  queued1,
  queued2,
  sent1,
  sent2,
  acked1,
  landed1,
  landed2,
  priorAck,
  version,
  stale,
  skipped,
  landedStale,
  wiped,
  crashed,
  kept1,
  kept2,
  keptStale,
  undone

vars == <<
  queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version,
  stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone
>>

TypeOK ==
  /\ queued1 \in BOOLEAN
  /\ queued2 \in BOOLEAN
  /\ sent1 \in BOOLEAN
  /\ sent2 \in BOOLEAN
  /\ acked1 \in BOOLEAN
  /\ landed1 \in BOOLEAN
  /\ landed2 \in BOOLEAN
  /\ priorAck \in BOOLEAN
  /\ version \in {0, 1, 2}
  /\ stale \in BOOLEAN
  /\ skipped \in BOOLEAN
  /\ landedStale \in BOOLEAN
  /\ wiped \in BOOLEAN
  /\ crashed \in BOOLEAN
  /\ kept1 \in BOOLEAN
  /\ kept2 \in BOOLEAN
  /\ keptStale \in BOOLEAN
  /\ undone \in BOOLEAN

Init ==
  /\ queued1 = FALSE
  /\ queued2 = FALSE
  /\ sent1 = FALSE
  /\ sent2 = FALSE
  /\ acked1 = FALSE
  /\ landed1 = FALSE
  /\ landed2 = FALSE
  /\ priorAck = FALSE
  /\ version = 0
  /\ stale = FALSE
  /\ skipped = FALSE
  /\ landedStale = FALSE
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ kept1 = FALSE
  /\ kept2 = FALSE
  /\ keptStale = FALSE
  /\ undone = FALSE

QueueFirst ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = FALSE
  /\ queued1' = TRUE
  /\ UNCHANGED <<queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

QueueSecond ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = TRUE
  /\ queued2 = FALSE
  /\ queued2' = TRUE
  /\ UNCHANGED <<queued1, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

Send ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = TRUE
  /\ sent1 = FALSE
  /\ sent1' = TRUE
  /\ UNCHANGED <<queued1, queued2, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

SendNext ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued2 = TRUE
  /\ sent1 = TRUE
  /\ sent2 = FALSE
  /\ sent2' = TRUE
  /\ UNCHANGED <<queued1, queued2, sent1, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

Ack ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ sent1 = TRUE
  /\ acked1 = FALSE
  /\ acked1' = TRUE
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

Land ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = TRUE
  /\ acked1 = FALSE
  /\ landed1 = FALSE
  /\ version = 0
  /\ landed1' = TRUE
  /\ priorAck' = acked1
  /\ version' = 1
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed2, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

LandNext ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued2 = TRUE
  /\ landed2 = FALSE
  /\ version = 1
  /\ landed2' = TRUE
  /\ version' = 2
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed1, priorAck, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

QueueStale ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ version = 1
  /\ stale = FALSE
  /\ stale' = TRUE
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone>>

Skip ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ stale = TRUE
  /\ skipped = FALSE
  /\ version # 0
  /\ skipped' = TRUE
  /\ landedStale' = FALSE
  /\ version' = version
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, stale, wiped, crashed, kept1, kept2, keptStale, undone>>

LandStale ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ stale = TRUE
  /\ landedStale = FALSE
  /\ skipped = FALSE
  /\ version = 0
  /\ landedStale' = TRUE
  /\ version' = version + 1
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, stale, skipped, wiped, crashed, kept1, kept2, keptStale, undone>>

Crash ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ crashed' = TRUE
  /\ kept1' = (queued1 /\ ~acked1)
  /\ kept2' = queued2
  /\ keptStale' = (stale /\ ~skipped /\ ~landedStale)
  /\ queued1' = queued1
  /\ queued2' = queued2
  /\ stale' = stale
  /\ UNCHANGED <<sent1, sent2, acked1, landed1, landed2, priorAck, version, skipped, landedStale, wiped, undone>>

Wipe ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ wiped' = TRUE
  /\ queued1' = acked1
  /\ queued2' = FALSE
  /\ stale' = FALSE
  /\ UNCHANGED <<sent1, sent2, acked1, landed1, landed2, priorAck, version, skipped, landedStale, crashed, kept1, kept2, keptStale, undone>>

Undo ==
  /\ FALSE
  /\ undone = FALSE
  /\ undone' = TRUE
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale>>

Rest == UNCHANGED vars

Next ==
  QueueFirst \/ QueueSecond \/ Send \/ SendNext \/ Ack \/ Land \/ LandNext \/ QueueStale \/ Skip \/ LandStale \/ Crash \/ Wipe \/ Undo \/ Rest

Spec == Init /\ [][Next]_vars

SentInOrder == sent2 = FALSE \/ sent1 = TRUE

AckedOnce == priorAck = FALSE

StaleSkips == landedStale = FALSE /\ (skipped = FALSE \/ version # 0)

CrashKeepsUnsent ==
  \/ crashed = FALSE
  \/ /\ kept1 = (queued1 /\ ~acked1)
     /\ kept2 = queued2
     /\ keptStale = (stale /\ ~skipped /\ ~landedStale)

WipeClears ==
  \/ wiped = FALSE
  \/ /\ (queued1 => acked1)
     /\ queued2 = FALSE
     /\ stale = FALSE

UndoWaits == undone = FALSE

====
