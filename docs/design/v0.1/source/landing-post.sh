cd /tmp/strat
id=$(node ls.mjs | grep -F '"S11.01 ' | grep -v 't("' | awk '{print $1}')
python3 - "$id" <<'PX'
import sys,subprocess,os,re
rid=sys.argv[1];env=dict(os.environ,CANVAS='Screens')
out=subprocess.run(['node','check.mjs','read',rid],capture_output=True,text=True,cwd='/tmp/strat',env=env).stdout.split('\n')
PLATE='f[(dithering(#F5F5F200,#4D94FB,size(3),shape(6),ditherType(2),scale(1.1),frozen))]'
F={'Hero Plate':'f[(dithering(#F5F5F2,#2D6FCD,size(2),shape(0),ditherType(3),scale(0.6),frozen))]','Close Band':'f[(dithering(#F5F5F2,#4D94FB,size(2),shape(3),ditherType(2),scale(1.2),speed(0.05)))]'}
S4201,S4204,S6101,S8102,S8101='2d91d4ec9e9e541a','6cf84f06b14cd852','f3cd3d31461f35af','4b47bec3f067b229','82978a83ba54fd88'
CL={'Real Hero Slot':(S4201,-248,0),'Real Title Slot':(S4201,-280,-86),'Real Chart Slot':(S4204,-280,-68),'Real Composer Slot':(S4204,-1112,-662),'Real Source Slot':(S4201,-280,-352),'Real Notes Slot':(S4201,-1116,-60),'Real Export Slot':(S6101,-448,-296),'Real Agents Slot':(S8102,-430,-160),'Real Usage Slot':(S8101,-430,-160)}
rows=[]
for l in out:
    m=re.search(r'"([^"]+)"\s*$',l)
    if not m: continue
    n=m.group(1); i=l.strip()[:16]
    if n in F: rows.append(f'{i} {F[n]}')
    if n=='Headline Line Two': rows.append(f'{i} t("before you walk in.")\n  spans[("walk in.",i,#2D6FCD)]')
    if n in CL:
        src,x,y=CL[n]; rows.append(f'clone({src}) parent({i}) abs p({x},{y}) "Real {src}"')
rows.append(f'{rid} f[(#F5F5F2),(noiseGrain(amount(0.06),size(1),monochrome(mono),opacity(0.35)))]')
open('/tmp/strat/landing/v13.bl','w').write('\n'.join(rows)+'\n'); print('rows',len(rows))
PX
CANVAS=Screens node check.mjs edit landing/v13.bl
node review2/exp_canvas.mjs Screens landing/${1:-cur}.png $id 1 >/dev/null; echo $id
