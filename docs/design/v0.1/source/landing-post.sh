cd /tmp/strat
python3 landing/fixsel.py >/dev/null && CANVAS=Screens node check.mjs edit landing/fixsel.bl >/dev/null
id=$(node ls.mjs | grep -F '"S11.01 ' | grep -v 't("' | awk '{print $1}')
python3 - "$id" <<'PX'
import sys,subprocess,os,re
rid=sys.argv[1];env=dict(os.environ,CANVAS='Screens')
out=subprocess.run(['node','check.mjs','read',rid],capture_output=True,text=True,cwd='/tmp/strat',env=env).stdout.split('\n')
F={
 'Dither Band':'f[(dithering(#FFFFFF00,#93B8EF,size(2),shape(6),ditherType(2),scale(1.55),uvy(-0.2),speed(0.15))),(linear(180,stop(#FFFFFF00,0),stop(#FFFFFF00,0.3),stop(#FFFFFF,0.72)))]',
 'Hero Light':'f[(radial(cx(50),cy(15),r(65),stop(#E3EEFD,0),stop(#FFFFFF00,1))),(metaballs(#FFFFFF,#E8F1FE,#BFD6F8,scale(0.8),speed(0.1))),(linear(180,stop(#FFFFFF,0,o(0.78)),stop(#FFFFFF,0.45,o(0.9)),stop(#FFFFFF,0.75))),(noiseGrain(amount(0.08),size(1.2),monochrome(mono),opacity(0.4)))]',
 'Hero Horizon':'f[(dithering(#FFFFFF00,#93B8EF,size(2),shape(6),ditherType(2),scale(2.2),uvy(-0.3),speed(0.1))),(linear(180,stop(#FFFFFF00,0),stop(#FFFFFF00,0.6),stop(#FFFFFF,1)))]',
 'Tile Dither':'f[(dithering(#EEF4FE00,#4D94FB,size(2),shape(6),ditherType(2),scale(1.4),uvy(-0.25),speed(0.12))),(linear(180,stop(#EEF4FE00,0),stop(#EEF4FE00,0.55),stop(#EEF4FE,1)))]',
 'Headline Line Accent':'f[(linear(180,stop(#222222,0),stop(#1D4A7A,0.5),stop(#4D94FB,1)))]',
 'Nav Pill':'f[(glass(frost(16),tint(#FFFFFF,o(0.7))))]',
}
CL={'Real Hero Slot':('2d91d4ec9e9e541a',-262,0),'Real Composer Slot':('6cf84f06b14cd852',-1112,-660),'Real Export Slot':('f3cd3d31461f35af',-496,-344),'Real Agents Slot':('4b47bec3f067b229',-430,-160)}
rows=[]
for l in out:
    m=re.search(r'"([^"]+)"\s*$',l)
    if not m: continue
    n=m.group(1); i=l.strip()[:16]
    if n in F: rows.append(f'{i} {F[n]}')
    if n in CL:
        src,x,y=CL[n]; rows.append(f'clone({src}) parent({i}) abs p({x},{y}) "Real {src}"')
    if n=='Story Paragraph Text':
        txt=re.search(r't\("([^"]*)"',l).group(1)
        sents=re.findall(r'(\d\d) (.*?)(?= +\d\d |$)',txt)
        col={'01':'#222222','08':'#222222','03':'#555555','05':'#555555','06':'#555555'}
        nums=','.join(f'("{k:02d}",s(15),#B0B0B0)' for k in range(1,9))
        seen={};parts=[]
        for a,b in sents:
            if a not in col: continue
            k=seen.get(b,0);seen[b]=k+1
            parts.append(f'("{b}",{k},{col[a]})' if sum(1 for _,x in sents if x==b)>1 else f'("{b}",{col[a]})')
        rows.append(f'{i} t("{txt}")\n  spans[{nums},{",".join(parts)}]')
open('/tmp/strat/landing/v12.bl','w').write('\n'.join(rows)+'\n'); print('rows',len(rows))
PX
CANVAS=Screens node check.mjs edit landing/v12.bl
node review2/exp_canvas.mjs Screens landing/${1:-cur}.png $id 1 >/dev/null; echo $id
