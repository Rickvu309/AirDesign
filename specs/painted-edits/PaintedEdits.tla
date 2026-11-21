---- MODULE PaintedEdits ----
EXTENDS Integers

VARIABLES mode, painted, stored, requested, copied
vars == <<mode, painted, stored, requested, copied>>

Init ==
  /\ mode \in {"panel", "type", "move"}
  /\ painted = 0
  /\ stored = 0
  /\ requested = 0
  /\ copied = -1

PaintFirst ==
  /\ painted = 0
  /\ painted' = 1
  /\ UNCHANGED <<mode, stored, requested, copied>>

PaintLayerEdit ==
  /\ mode # "panel"
  /\ painted = 1
  /\ painted' = 3
  /\ UNCHANGED <<mode, stored, requested, copied>>

StoreFirst ==
  /\ painted % 2 = 1
  /\ stored % 2 = 0
  /\ stored' = stored + 1
  /\ UNCHANGED <<mode, painted, requested, copied>>

StoreLayerEdit ==
  /\ mode # "panel"
  /\ painted = 3
  /\ stored = 1
  /\ stored' = stored + 2
  /\ UNCHANGED <<mode, painted, requested, copied>>

AskExport ==
  /\ requested = 0
  /\ painted > 0
  /\ requested' = painted
  /\ UNCHANGED <<mode, painted, stored, copied>>

Has(edits, wanted) == edits % 2 >= wanted % 2 /\ edits \div 2 >= wanted \div 2

Export ==
  /\ requested > 0
  /\ Has(stored, requested)
  /\ copied = -1
  /\ copied' = stored
  /\ UNCHANGED <<mode, painted, stored, requested>>

Next == PaintFirst \/ PaintLayerEdit \/ StoreFirst \/ StoreLayerEdit \/ AskExport \/ Export
Spec == Init /\ [][Next]_vars /\ WF_vars(StoreFirst) /\ WF_vars(StoreLayerEdit) /\ WF_vars(Export)

ExportIncludesPaintedEdits == copied # -1 => Has(copied, requested)
LayerEditFollowsInsert == mode # "panel" /\ stored \div 2 = 1 => stored % 2 = 1
ExportFinishes == requested > 0 ~> copied # -1
====
