# Canvas

How a layer moves and paints on the slide while a hand holds it.

## Language

**drag**:
Moving the selection with the pointer held down. It paints at most once a frame and lands as one box edit, one undo step, when the pointer comes up.
_Avoid_: move gesture, pointer move

**resting box**:
The box a layer has when no gesture holds it. During a drag the canvas shows the dragged box, while the filmstrip and the design panel keep the resting box and catch up once the drag lands. The design panel's X, Y, Width and Height follow the dragged box.
_Avoid_: settled box, committed box, saved box
