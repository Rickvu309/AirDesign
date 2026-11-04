import re,subprocess,json
src=open('/tmp/strat/review2/mods.py').read(); exec(src.split('H=[')[0])
K=json.load(open('/tmp/strat/review2/copy_kit.json'))
def row(ind,title,sub,right,tile=None):
    sp=' '*ind
    o=[sp+'al(h,y(c),g(12),pad(12,0)) s(fill,hug) st[(#EAEAE7,w(1,0,0,0),pos(i))] "Module Row"']
    if tile and tile[0]=='aira':
        o+=[sp+'  al(h,x(c),y(c)) s(28,28) f[(#FFFFFF)] rd(7) st[(#EAEAE7,w(1),pos(i))] "Row Tile"',sp+'    fr s(16,16) "Aira Logo"',
            sp+'      v() path:d(M0,6.87L3.27,0M10,6.87L6.73,0) p(3,6.8) s(10,6.87) f[] st[(#4D94FB,w(1.4),dashcap(r))] "Aira Legs"',
            sp+'      v() path:d(M4,0c.43,2.37,1.63,3.57,4,4c-2.37,.43,-3.57,1.63,-4,4c-.43,-2.37,-1.63,-3.57,-4,-4c2.37,-.43,3.57,-1.63,4,-4z) p(5.33,1.07) s(5.33,5.33) f[(#4D94FB)] "Aira Spark"']
    elif tile:
        L=json.load(open('/tmp/strat/review2/logos.json'))
        o+=[sp+f'  al(h,x(c),y(c)) s(28,28) f[({tile[1]})] rd(7) "Row Tile"',sp+f'    v() path:d({L[tile[0]]}) s(16,16) f[(#FFFFFF)] "Logo"']
    o+=[sp+'  al(v,g(2)) s(fill,hug) "Row Text"',t(ind+4,title,14,'m',INK,True)]
    if sub: o.append(t(ind+4,sub,12,'r',MUT,True))
    o+=right(ind+2)
    return o
def toggle(ind,on=True):
    sp=' '*ind
    return [sp+'al(h,x(e),y(c),pad(2)) s(36,20) f[(#4D94FB)] rd(10) "Toggle On"',sp+'  fr s(16,16) f[(#FFFFFF)] rd(8) shadow(o(0.2),y(1),blur(2))']
def select(ind,val):
    sp=' '*ind
    return [sp+'al(h,x(sb),y(c),pad(0,10)) s(120,32) f[(#FFFFFF)] rd(8) st[(#D7D7D6,w(1),pos(i))] "Select"',t(ind+2,val,13,'r',INK),sp+'  v() path:d(M0,0L4,4L8,0) s(8,4) f[] st[(#666666,w(1.4),dashcap(r))]']
def link(ind,txt,col='#2D6FCD'): return [t(ind,txt,13,'m',col)]
def agents(ind):
    o=[card(ind,'Agents Module')]+head(ind+2,'Agents','Agents that can work on your decks.',None)
    o+=row(ind+2,'Aira','Built in. Uses your weekly usage faster.',lambda i:toggle(i),('aira','#FFFFFF'))
    o+=row(ind+2,'Claude','Connected',lambda i:btn(i,'Manage'),('claude','#D97757'))
    o+=row(ind+2,'Codex','Not connected',lambda i:btn(i,'Connect'),('openai','#111111'))
    o+=[card(ind,'MCP Module')]+head(ind+2,'MCP server','Add this address in Claude or Codex to connect.',None)
    sp=' '*(ind+2)
    o+=[sp+'al(h,x(sb),y(c),pad(0,0,0,12)) s(fill,40) f[(#F5F5F2)] rd(8) "Address Field"',t(ind+4,'https://mcp.airdesign.app/mcp',13,'r',INK)]+btn(ind+4,'Copy')
    o+=link(ind+2,'Setup guides for Claude and Codex')
    return o
def account(ind):
    o=[card(ind,'Profile Module')]+head(ind+2,'Profile','Ada Lovelace, ada@halden.com',[lambda i:btn(i,'Edit')])
    o+=[card(ind,'Preferences Module'),t(ind+2,'Preferences',15,'sb',INK,True)]
    o+=row(ind+2,'Language',None,lambda i:select(i,'English'))
    o+=row(ind+2,'Slide size','For new decks',lambda i:select(i,'16:9'))
    o+=[card(ind,'Account Module'),t(ind+2,'Account',15,'sb',INK,True)]
    o+=row(ind+2,'Signed in with email','ada@halden.com',lambda i:btn(i,'Sign out'))
    o+=row(ind+2,'Delete account','Removes your decks and credits for good.',lambda i:[' '*i+'al(h,x(c),y(c),pad(0,14)) s(hug,34) f[(#FFFFFF)] rd(8) st[(#D7D7D6,w(1),pos(i))] "Secondary Button"',t(i+2,'Delete account',13,'m','#D93F3F')])
    return o
env={'CANVAS':'Screens','PATH':'/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin'}
roots={}
for l in subprocess.run(['node','ls.mjs'],capture_output=True,text=True,cwd='/tmp/strat').stdout.split('\n'):
    m=re.match(r'([0-9a-f]{16}) (?!t\().*"(S\d\d\.\d\d) [^"]+"\s*$',l.strip())
    if m: roots[m.group(2)]=m.group(1)
out=[]
for code,fn in (('S81.02',agents),):
    r=roots[code]
    tx=subprocess.run(['node','check.mjs','read',r],capture_output=True,text=True,cwd='/tmp/strat',env=env).stdout.split('\n')
    bid=bi=None
    for l in tx:
        m=re.match(r'^(\s*)([0-9a-f]{16}) .*"(Settings Body|Agents Body|Account Body)"',l)
        if m: bid,bi=m.group(2),len(m.group(1)); break
    if not bid:
        print('no body',code); 
        for l in tx:
            if re.search(r'"Home Main"|Body|Section"',l): print(l[:120])
        continue
    start=[k for k,l in enumerate(tx) if bid in l][0]
    for l in tx[start+1:]:
        m=re.match(r'^(\s*)([0-9a-f]{16}) ',l)
        if not m: continue
        if len(m.group(1))<=bi: break
        if len(m.group(1))==bi+2: out.append(f'delete({m.group(2)})')
    out.append(f'{bid} al(v,g(16),pad(28,0,0,0))')
    lines=fn(2)
    out+=[(l.strip()+f' parent({bid})') if l.startswith('  al(v,g(14),pad(20))') else l[2:] for l in lines]
open('/tmp/strat/review2/mods2.bl','w').write('\n'.join(out)+'\n');print(len(out))
