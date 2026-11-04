import re,subprocess,json
env={'CANVAS':'Screens','PATH':'/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin'}
INK,MUT,SUB='#222222','#666666','#909090'
def t(ind,txt,size=13,w='r',col=INK,fill=False,name=''):
    return ' '*ind+f't("{txt}",Geist,{size},{w}) s({"fill" if fill else "hug"},hug) f[({col})]'+(f' "{name}"' if name else '')
def btn(ind,label,primary=False,ext=False):
    sp=' '*ind
    if primary: o=[sp+'al(h,x(c),y(c),g(6),pad(0,14)) s(hug,34) f[(linear(180,#93B8EF,#4D94FB))] rd(8) st[(#2D6FCD,w(1),pos(i))] "Primary Button"',t(ind+2,label,13,'m','#FFFFFF')]
    else: o=[sp+'al(h,x(c),y(c),g(6),pad(0,14)) s(hug,34) f[(#FFFFFF)] rd(8) st[(#D7D7D6,w(1),pos(i))] "Secondary Button"',t(ind+2,label,13,'m',INK)]
    if ext: o.append(sp+f'  v() path:d(M0,7L7,0M2,0L7,0L7,5) s(7,7) f[] st[({"#FFFFFF" if primary else INK},w(1.4),dashcap(r))] "External Icon"')
    return o
def card(ind,name): return ' '*ind+f'al(v,g(14),pad(20)) s(fill,hug) f[(#FFFFFF)] rd(12) st[(#EAEAE7,w(1),pos(i))] "{name}"'
def head(ind,title,sub,actions):
    sp=' '*ind
    o=[sp+'al(h,x(sb),y(c),g(16)) s(fill,hug) "Module Head"',sp+'  al(v,g(4)) s(fill,hug) "Module Text"',t(ind+4,title,15,'sb',INK,True,'Module Title')]
    if sub: o.append(t(ind+4,sub,13,'r',MUT,True,'Module Sub'))
    if actions: o+=[sp+'  al(h,y(c),g(8)) s(hug,hug) "Module Actions"']+[l for a in actions for l in a(ind+4)]
    return o
def usage(ind,pct=62):
    o=[card(ind,'Usage Module')]+head(ind+2,'Weekly usage','Resets Monday at 8:00 AM',[lambda i:btn(i,'Reset')])
    sp=' '*(ind+2)
    o+=[sp+'al(h,y(c),g(12)) s(fill,hug) "Usage Bar"',sp+'  al(h) s(fill,8) f[(#EAEAE7)] rd(4) "Track"',sp+f'    fr s({int(6.2*pct)},8) f[(#4D94FB)] rd(4) "Fill"',t(ind+4,f'{pct}% used',13,'r',MUT)]
    return o
def credits(ind,bal='$15.00',pending=None):
    sp=' '*(ind+2)
    o=[card(ind,'Credits Module'),sp+'al(h,x(sb),y(e),g(16)) s(fill,hug) "Module Head"',sp+'  al(v,g(4)) s(fill,hug) "Module Text"',t(ind+6,'Credits',15,'sb',INK,True),t(ind+6,bal,30,'sb',INK,True,'Balance'),t(ind+6,'Each reset is $5. Credits never expire.',13,'r',MUT,True)]
    o+=[sp+'  al(h,y(c),g(8)) s(hug,hug) "Module Actions"']+btn(ind+6,'Add credits',True)
    if pending:
        o+=[sp+'al(h,y(c),x(sb),pad(10,12)) s(fill,hug) f[(#EEF4FE)] rd(8) "Pending Payment"',sp+'  al(h,y(c),g(10)) s(fill,hug)',sp+'    al(h) s(16,16) rd(8) st[(#4D94FB,w(2),dash(14,30),pos(i))] "Spinner"',
            t(ind+6,f'Waiting for your {pending} payment. Finish in the new tab.',13,'m','#2D6FCD',True),sp+'  al(h,y(c),g(14)) s(hug,hug)',t(ind+6,'Open payment page',13,'m','#2D6FCD'),t(ind+6,'Cancel',13,'m',MUT)]
    o+=[sp+'al(h,x(sb),y(c),g(16),pad(14,0,0,0)) s(fill,hug) st[(#EAEAE7,w(1,0,0,0),pos(i))] "Auto Reset Row"',sp+'  al(v,g(2)) s(fill,hug)',t(ind+6,'Auto reset',14,'m',INK,True),t(ind+6,'When usage runs out, reset for $5 from your credits.',13,'r',MUT,True),
        sp+'  al(h,x(e),y(c),pad(2)) s(36,20) f[(#4D94FB)] rd(10) "Toggle On"',sp+'    fr s(16,16) f[(#FFFFFF)] rd(8) shadow(o(0.2),y(1),blur(2))']
    return o
def billing(ind):
    return [card(ind,'Billing Module')]+head(ind+2,'Billing',"Payment methods and receipts are kept on our payment partner's secure page.",[lambda i:btn(i,'Open billing',False,True)])
def history(ind,rows):
    sp=' '*(ind+2)
    o=[card(ind,'History Module'),t(ind+2,'History',15,'sb',INK,True),sp+'al(v) s(fill,hug) "History List"']
    for d,w,a,st in rows:
        o+=[sp+'  al(h,y(c),g(16),pad(10,0)) s(fill,hug) st[(#EAEAE7,w(0,0,1,0),pos(i))] "History Row"',t(ind+6,d,13,'r',MUT)[:-0] if False else ' '*(ind+6)+f't("{d}",Geist,13,r) s(64,hug) f[({MUT})]',t(ind+6,w,13,'r',INK,True),' '*(ind+6)+f't("{a}",Geist,13,m,align(trailing)) s(80,hug) f[({INK})]']
        if st: o.append(' '*(ind+6)+f't("{st}",Geist,12,r,align(trailing)) s(64,hug) f[({SUB})]')
    return o
H=[('Nov 3','Usage reset','-$5.00',None),('Oct 28','Credits added','+$20.00',None)]
def page(ind,bal='$15.00',pending=None,hist=H):
    return usage(ind)+credits(ind,bal,pending)+history(ind,hist)
V={'S81.01':{},'S91.01':{},'S91.02':{'pending':'$25.00'},'S91.03':{'bal':'$40.00','hist':[('Nov 4','Credits added','+$25.00',None)]+H},'S99.01':{},'S99.02':{}}
roots={}
for l in open('/tmp/strat/review2/ls11.txt'):
    m=re.match(r'([0-9a-f]{16}) (?!t\().*"(S\d\d\.\d\d) [^"]+"\s*$',l.strip())
    if m: roots[m.group(2)]=m.group(1)
out=[]
for code,kw in V.items():
    r=roots[code]
    tx=subprocess.run(['node','check.mjs','read',r],capture_output=True,text=True,cwd='/tmp/strat',env=env).stdout.split('\n')
    body=None
    for k,l in enumerate(tx):
        m=re.match(r'^(\s*)([0-9a-f]{16}) .*"Settings Body"',l)
        if m: body=(m.group(2),len(m.group(1)))
    assert body,code
    bid,bi=body
    for l in tx:
        m=re.match(r'^(\s*)([0-9a-f]{16}) ',l)
        if m and len(m.group(1))==bi+2:
            # only children inside body block
            pass
    # collect direct children after body line
    start=[k for k,l in enumerate(tx) if bid in l][0]
    for l in tx[start+1:]:
        m=re.match(r'^(\s*)([0-9a-f]{16}) ',l)
        if not m: continue
        if len(m.group(1))<=bi: break
        if len(m.group(1))==bi+2: out.append(f'delete({m.group(2)})')
    out.append(f'{bid} al(v,g(16),pad(28,0,0,0))')
    lines=page(2,**kw)
    lines[0]=lines[0]+f' parent({bid})'
    # each top-level module needs parent
    out+= [ (l.strip()+f' parent({bid})') if (l.startswith('  al(v,g(14),pad(20))') ) else l[2:] if l.startswith('  ') else l for l in lines]
open('/tmp/strat/review2/mods.bl','w').write('\n'.join(out)+'\n');print(len(out))
