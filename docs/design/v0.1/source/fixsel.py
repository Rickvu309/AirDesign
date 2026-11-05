import re,subprocess
env={'CANVAS':'Screens','PATH':'/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin'}
rid=[l[:16] for l in subprocess.run(['node','ls.mjs'],capture_output=True,text=True,cwd='/tmp/strat').stdout.split('\n') if '"S11.01 ' in l and ' t("' not in l][0]
t=subprocess.run(['node','check.mjs','read',rid],capture_output=True,text=True,cwd='/tmp/strat',env=env).stdout
o=[]
for l in t.split('\n'):
    m=re.match(r'\s*([0-9a-f]{16}) al\(v\) s\(fill,hug:([0-9.]+)\) ext\(([0-9.]+),\).*sp\(1\),id\(([0-9a-f]+)\)\).*"Slide Title Wrap"',l)
    if not m: continue
    i,h,w,sid=m.group(1),float(m.group(2)),float(m.group(3)),m.group(4)
    o.append(f'{i} st[(#4D94FB,w(1),pos(o))] shadow(o(0),y(0),blur(0),id({sid}))')
    for n,(x,y) in zip(('TL','TR','BL','BR'),((-3.5,-3.5),(w-3.5,-3.5),(-3.5,h-3.5),(w-3.5,h-3.5))):
        o.append(f'fr p({x},{y}) s(7,7) f[(#FFFFFF)] st[(#4D94FB,w(1),pos(i))] abs parent({i}) "Handle {n}"')
open('/tmp/strat/landing/fixsel.bl','w').write('\n'.join(o)+'\n');print(len(o))
