# After pushing the landing (ed47) and the run frames (ed51 to ed55) to the Screens canvas.
cd /tmp/strat
S4201=2d91d4ec9e9e541a
S1201_CARD=8cee2084d75063ed
for r in $(node ls.mjs | grep '"Run 0' | awk '{print $1}'); do
  shot=$(CANVAS=Screens node check.mjs read $r | grep '"Shot"' | awk '{print $1}')
  echo "clone($S4201) parent($shot) abs p(0,0) \"Real S42.01\""
done > landing/shots.bl
CANVAS=Screens node check.mjs edit landing/shots.bl
land=$(node ls.mjs | grep '"S11.01 Discover / Landing' | awk '{print $1}')
tree=$(CANVAS=Screens node check.mjs read $land)
slot=$(echo "$tree" | grep '"Real Running Slot"' | awk '{print $1}')
card=$(echo "$tree" | grep '"Price Card Slot"' | awk '{print $1}')
run4=$(node ls.mjs | grep '"Run 04' | awk '{print $1}')
cat > landing/post.bl <<BL
clone($run4) parent($slot) abs p(0,0) "Run frame" #rf
#rf scaleTo(w,1248)
#rf p(0,0)
clone($S1201_CARD) parent($card) abs p(0,0) "Price Card"
BL
CANVAS=Screens node check.mjs edit landing/post.bl
aira=$(CANVAS=Screens node check.mjs read $card | grep 't("Aira built in"' | awk '{print $1}')
echo "$aira t(\"Built-in agent\")" > landing/aira.bl && CANVAS=Screens node check.mjs edit landing/aira.bl
node review2/exp_canvas.mjs Screens landing/${1:-cur}.png $land 1 >/dev/null; echo $land
