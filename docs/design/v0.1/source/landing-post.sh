cd /tmp/strat
python3 landing/fixsel.py >/dev/null && CANVAS=Screens node check.mjs edit landing/fixsel.bl >/dev/null
id=$(node ls.mjs | grep -F '"S11.01 ' | grep -v 't("' | awk '{print $1}')
did=$(CANVAS=Screens node check.mjs read $id | grep '"Dither Band"' | awk '{print $1}')
echo "$did f[(dithering(#0F2433,#4D94FB,size(2),shape(6),ditherType(2),scale(1.55),uvy(-0.2),speed(0.15))),(linear(180,stop(#0F243300,0),stop(#0F243300,0.3),stop(#0F2433,0.72)))]" > landing/dither.bl
CANVAS=Screens node check.mjs edit landing/dither.bl >/dev/null
sid=$(CANVAS=Screens node check.mjs read $id | grep '"Story Paragraph Text"' | awk '{print $1}')
python3 - "$sid" <<'PX'
import sys,subprocess,re,os
sid=sys.argv[1];env=dict(os.environ,CANVAS='Screens')
out=subprocess.run(['node','check.mjs','read',sid],capture_output=True,text=True,cwd='/tmp/strat',env=env).stdout
line=[l for l in out.split('\n') if l.strip().startswith(sid)][0]
txt=re.search(r't\("([^"]*)"',line).group(1)
nums=','.join(f'("{i:02d}",s(15),#7F93A6)' for i in range(1,9))
sents=re.findall(r'(\d\d) (.*?)(?= \d\d |$)',txt)
col={'01':'#FFFFFF','08':'#FFFFFF','03':'#E3EAF1','05':'#E3EAF1','06':'#E3EAF1'}
seen={};parts=[]
for a,b in sents:
    if a not in col: continue
    k=seen.get(b,0);seen[b]=k+1
    parts.append(f'("{b}",{k},{col[a]})' if sum(1 for _,x in sents if x==b)>1 else f'("{b}",{col[a]})')
sp=','.join(parts)
open('/tmp/strat/landing/spans.bl','w').write(f'{sid} t("{txt}")\n  spans[{nums},{sp}]\n')
PX
CANVAS=Screens node check.mjs edit landing/spans.bl
node review2/exp_canvas.mjs Screens landing/${1:-cur}.png $id 1 >/dev/null; echo $id
python3 - "$id" <<'PX'
import sys,subprocess,os,re
rid=sys.argv[1];env=dict(os.environ,CANVAS='Screens')
out=subprocess.run(['node','check.mjs','read',rid],capture_output=True,text=True,cwd='/tmp/strat',env=env).stdout.split('\n')
rows=[]
def idof(l): return l.strip()[:16]
for i,l in enumerate(out):
    if re.search(r'"(Rewrite Section|Story Section|Wordmark Band|Footer)"\s*$',l):
        rows.append(f'{idof(l)} f[(#0F2433),(noiseGrain(amount(0.12),size(1.2),monochrome(mono),opacity(0.5)))]')
    if re.search(r'"Answer Field"\s*$',l):
        for m in out[i+1:i+40]:
            if re.search(r'"Primary Button"\s*$',m):
                rows.append(f'{idof(m)} st[(metal(#FFFFFF,#4D94FB,scale(3),speed(0.3)),w(1.5),pos(o))]'); break
    if re.search(r'"Nav Pill"\s*$',l):
        rows.append(f'{idof(l)} f[(glass(frost(14),tint(#FFFFFF,o(0.55))))]')
open('/tmp/strat/landing/elite.bl','w').write('\n'.join(rows)+'\n'); print(len(rows))
PX
CANVAS=Screens node check.mjs edit landing/elite.bl
