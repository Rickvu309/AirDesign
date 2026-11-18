---- MODULE Offline ----
EXTENDS Integers

VARIABLES
  lands1, lands2,
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
  undone,
  typed,
  journaled,
  joined,
  sentJoined,
  newer,
  lateTyped

vars == <<
  lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version,
  stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled,
  joined, sentJoined, newer, lateTyped
>>

TypeOK ==
  /\ lands1 \in 0..2
  /\ lands2 \in 0..2
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
  /\ typed \in BOOLEAN
  /\ journaled \in BOOLEAN
  /\ joined \in BOOLEAN
  /\ sentJoined \in BOOLEAN
  /\ newer \in BOOLEAN
  /\ lateTyped \in BOOLEAN

Init ==
  /\ lands1 = 0
  /\ lands2 = 0
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
  /\ typed \in BOOLEAN
  /\ journaled = typed
  /\ joined = FALSE
  /\ sentJoined = FALSE
  /\ newer = FALSE
  /\ lateTyped = FALSE

QueueFirst ==
  /\ newer = FALSE
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = FALSE
  /\ queued1' = TRUE
  /\ journaled' = FALSE
  /\ UNCHANGED <<lands1, lands2, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, joined, sentJoined, newer, lateTyped>>

QueueSecond ==
  /\ newer = FALSE
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = TRUE
  /\ queued2 = FALSE
  /\ queued2' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

Send ==
  /\ newer = FALSE
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = TRUE
  /\ acked1 = FALSE
  /\ sent1' = TRUE
  /\ sentJoined' = joined
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, newer, lateTyped>>

SendNext ==
  /\ newer = FALSE
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued2 = TRUE
  /\ sent1 = TRUE
  /\ sent2 = FALSE
  /\ sent2' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

Ack ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ sent1 = TRUE
  /\ acked1 = FALSE
  /\ acked1' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

Land ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = TRUE
  /\ acked1 = FALSE
  /\ landed1 = FALSE
  /\ version = 0
  /\ lands1' = lands1 + 1
  /\ lands2' = lands2
  /\ landed1' = TRUE
  /\ priorAck' = acked1
  /\ version' = 1
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed2, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

LandNext ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued2 = TRUE
  /\ landed2 = FALSE
  /\ version = 1
  /\ lands2' = lands2 + 1
  /\ lands1' = lands1
  /\ landed2' = TRUE
  /\ version' = 2
  /\ UNCHANGED <<queued1, queued2, sent1, sent2, acked1, landed1, priorAck, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

QueueStale ==
  /\ newer = FALSE
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ version = 1
  /\ stale = FALSE
  /\ stale' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

Skip ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ stale = TRUE
  /\ skipped = FALSE
  /\ version # 0
  /\ skipped' = TRUE
  /\ landedStale' = FALSE
  /\ version' = version
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, stale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

LandStale ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ stale = TRUE
  /\ landedStale = FALSE
  /\ skipped = FALSE
  /\ version = 0
  /\ landedStale' = TRUE
  /\ version' = version + 1
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, stale, skipped, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

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
  /\ UNCHANGED <<lands1, lands2, sent1, sent2, acked1, landed1, landed2, priorAck, version, skipped, landedStale, wiped, undone, typed, journaled, joined, sentJoined, newer, lateTyped>>

Wipe ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ wiped' = TRUE
  /\ queued1' = acked1
  /\ queued2' = FALSE
  /\ stale' = FALSE
  /\ typed' = FALSE
  /\ journaled' = FALSE
  /\ UNCHANGED <<lands1, lands2, sent1, sent2, acked1, landed1, landed2, priorAck, version, skipped, landedStale, crashed, kept1, kept2, keptStale, undone, joined, sentJoined, newer, lateTyped>>

Undo ==
  /\ FALSE
  /\ undone = FALSE
  /\ undone' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, typed, journaled, joined, sentJoined, newer, lateTyped>>

Join ==
  /\ newer = FALSE
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ queued1 = TRUE
  /\ queued2 = FALSE
  /\ stale = FALSE
  /\ sent1 = FALSE
  /\ joined = FALSE
  /\ joined' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, sentJoined, newer, lateTyped>>

\* A build this device cannot read writes its store: a newer build opens IndexedDB, or leaves a
\* row or an unsent entry this build cannot read. The device keeps every row and entry, and its
\* writes and sends wait until a reload brings the newer build (readStoredRows, recoverUnsaved).
MeetNewer ==
  /\ wiped = FALSE
  /\ crashed = FALSE
  /\ newer = FALSE
  /\ sent1 = FALSE
  /\ stale = FALSE
  /\ joined = FALSE
  /\ newer' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, journaled, joined, sentJoined, lateTyped>>

\* The person types after that. The page still paints it, and the journal keeps it for the newer
\* build to send (keptIfNewer in packages/live/src/cache.ts).
TypeLate ==
  /\ newer = TRUE
  /\ wiped = FALSE
  /\ lateTyped = FALSE
  /\ lateTyped' = TRUE
  /\ journaled' = TRUE
  /\ UNCHANGED <<lands1, lands2, queued1, queued2, sent1, sent2, acked1, landed1, landed2, priorAck, version, stale, skipped, landedStale, wiped, crashed, kept1, kept2, keptStale, undone, typed, joined, sentJoined, newer>>

Rest == UNCHANGED vars

Next ==
  QueueFirst \/ QueueSecond \/ Join \/ Send \/ SendNext \/ Ack \/ Land \/ LandNext \/ QueueStale \/ Skip \/ LandStale \/ Crash \/ Wipe \/ Undo \/ MeetNewer \/ TypeLate \/ Rest

Spec == Init /\ [][Next]_vars

SentInOrder == sent2 = FALSE \/ sent1 = TRUE

AckedOnce == priorAck = FALSE

BatchLandsOnce == lands1 <= 1 /\ lands2 <= 1

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

PaintedEditKept == typed = FALSE \/ queued1 = TRUE \/ journaled = TRUE

UndoWaits == undone = FALSE

JoinedTextSent == (joined /\ sent1) => sentJoined

\* Harm if broken: an old tab sends or rewrites what a newer build stored, or a newer build's
\* rows reach the server through a tab that cannot read them.
NewerSendsNothing == newer = FALSE \/ (sent1 = FALSE /\ sent2 = FALSE)

\* Harm if broken: what a person typed after a newer build took the deck is gone on reload.
LateTypingKept == lateTyped = FALSE \/ journaled = TRUE \/ wiped = TRUE

====
