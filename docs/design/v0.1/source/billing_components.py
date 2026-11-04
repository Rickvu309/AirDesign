# Reusable billing components rendered as Brilliant blueprint rows.
INK,MUT,SUB='#222222','#666666','#909090'
def t(ind,txt,size=13,w='r',col=INK,fill=False,name='',extra=''):
    return ' '*ind+f't("{txt}",Geist,{size},{w}{extra}) s({"fill" if fill else "hug"},hug) f[({col})]'+(f' "{name}"' if name else '')
def button(ind,label,kind='secondary',external=False):
    sp=' '*ind
    if kind=='primary': o=[sp+'al(h,x(c),y(c),g(6),pad(0,16)) s(hug,36) f[(linear(180,#93B8EF,#4D94FB))] rd(8) st[(#2D6FCD,w(1),pos(i))] "Primary Button"',t(ind+2,label,14,'m','#FFFFFF')]
    else: o=[sp+'al(h,x(c),y(c),g(6),pad(0,16)) s(hug,36) f[(#FFFFFF)] rd(8) st[(#D7D7D6,w(1),pos(i))] "Secondary Button"',t(ind+2,label,14,'m',INK)]
    if external: o.append(sp+f'  v() path:d(M0,8L8,0M2.5,0L8,0L8,5.5) s(8,8) f[] st[({"#FFFFFF" if kind=="primary" else INK},w(1.5),dashcap(r))] "External Icon"')
    return o
def close_button(ind):
    sp=' '*ind
    return [sp+'al(h,x(c),y(c)) s(28,28) rd(6) "Close Button"',sp+'  v() path:d(M0,0L10,10M10,0L0,10) s(10,10) f[] st[(#666666,w(1.5),dashcap(r))] "Close Icon"']
def summary(ind,rows):
    sp=' '*ind;o=[sp+'al(v,g(10),pad(14)) s(fill,hug) f[(#F5F5F2)] rd(10) "Summary"']
    for k,v,b in rows: o+=[sp+'  al(h,x(sb),y(c)) s(fill,hug) "Summary Row"',t(ind+4,k,13,'r',MUT),t(ind+4,v,13,'sb' if b else 'r',INK)]
    return o
def scrim(root):
    return [f'al(h,x(c),y(c)) p(0,0) s(1470,923) f[(solid(#000000,o(0.25)))] abs parent({root}) "Dialog Scrim"']
def amount_field(ind,value='10',presets=('$10','$25','$50'),selected='$10'):
    sp=' '*ind
    o=[sp+'al(v,g(10)) s(fill,hug) "Amount"',t(ind+2,'Amount',12,'m',MUT),sp+'  al(h,y(c),g(8)) s(fill,hug) "Amount Row"',
       sp+'    al(h,y(c),g(4),pad(0,12)) s(fill,44) f[(#FFFFFF)] rd(8) st[(#4D94FB,w(2),pos(i))] "Amount Input"',t(ind+6,'$',16,'r',MUT),t(ind+6,value,16,'sb',INK),sp+'      fr s(1.5,20) f[(#4D94FB)] "Caret"']
    for a in presets:
        on=a==selected
        o+=[sp+'    al(h,x(c),y(c),pad(0,12)) s(hug,44) f[('+('#EEF4FE' if on else '#FFFFFF')+')] rd(8) st[('+('#4D94FB,w(1)' if on else '#D7D7D6,w(1)')+',pos(i))] "Preset"',t(ind+6,a,13,'m','#2D6FCD' if on else INK)]
    o.append(t(ind+2,'Minimum $10.',12,'r',MUT))
    return o
def add_credits_dialog(root,balance=15.0,adding=10.0):
    """One Add credits dialog for every entry point. Only the numbers change."""
    o=scrim(root)+['  al(v,g(20),pad(24)) s(440,hug) f[(#FFFFFF)] rd(16) shadow(o(0.16),y(24),blur(48)) st[(#00000014,w(1),pos(i))] "Add Credits Dialog"',
       '    al(h,x(sb),y(c)) s(fill,hug) "Dialog Head"',t(6,'Add credits',17,'sb',INK,name='Dialog Title')]+close_button(6)
    o.append(t(4,'Each reset is $5. Credits never expire.',13,'r',MUT,True,'Context Line',',lh(1.5)'))
    o+=amount_field(4,str(int(adding)),selected=f'${int(adding)}')
    o+=summary(4,[('Current balance',f'${balance:.2f}',0),('Adding',f'${adding:.2f}',0),('New balance',f'${balance+adding:.2f}',1)])
    o+=['    al(h,x(e),y(c),g(8)) s(fill,hug) "Dialog Foot"']+button(6,'Cancel')+button(6,'Continue to payment','primary',True)
    o.append(t(4,'Opens a secure page in a new tab.',12,'r',SUB,True,'Foot Note',',align(r)'))
    return o

import json as _json
K=_json.load(open('/tmp/strat/review2/copy_kit.json'))
def _tile(top,bot,edge):
    return f'al(h,x(c),y(c)) s(40,40) f[(linear(180,{top},{bot}))] rd(12) st[({edge},w(1),pos(i))] shadow(#FFFFFF,o(0.35),y(1),blur(0)) shadow(o(0.14),y(2),blur(6)) "Alert Icon"'
ICON={
 'ok':[_tile('#93B8EF','#4D94FB','#2D6FCD'),'  v() path:d(M0,4.5L3.6,8L11,0) s(11,8) f[] st[(#FFFFFF,w(2.2),dashcap(r))]'],
 'money':[_tile('#93B8EF','#4D94FB','#2D6FCD'),'  t("$",Geist,18,sb) s(hug,hug) f[(#FFFFFF)]'],
 'fail':[_tile('#F29A9A','#D93F3F','#B92F2F'),'  al(v,x(c),g(3)) s(hug,hug)','    v() path:d(M0,0L0,8) s(0,8) f[] st[(#FFFFFF,w(2.4),dashcap(r))]','    fr s(2.6,2.6) f[(#FFFFFF)] rd(1.3)'],
 'exp':[_tile('#D9D9D7','#A8A8A6','#8F8F8D'),'  fr s(18,18) rd(9) st[(#FFFFFF,w(2),pos(i))]','    v() path:d(M0,0L0,4.5L3,6.5) p(9,4) s(3,6.5) f[] st[(#FFFFFF,w(2),dashcap(r))]'],
}
def danger_button(ind,label):
    sp=' '*ind
    return [sp+'al(h,x(c),y(c),pad(0,16)) s(hug,36) f[(#D93F3F)] rd(8) st[(#B92F2F,w(1),pos(i))] "Danger Button"',t(ind+2,label,14,'m','#FFFFFF')]
def alert_dialog(root,icon,title,body,secondary=None,primary=None,danger=False):
    """One alert/result dialog: icon, title, one line, buttons. Used by results, confirms and warnings."""
    o=scrim(root)+['  al(v,g(16),pad(24)) s(400,hug) f[(#FFFFFF)] rd(16) shadow(o(0.16),y(24),blur(48)) st[(#00000014,w(1),pos(i))] "Alert Dialog"',
       '    al(h,x(sb),y(s)) s(fill,hug) "Dialog Head"']+['      '+l for l in ICON[icon]]+close_button(6)+[
       '    al(v,g(6)) s(fill,hug) "Alert Text"',t(6,title,17,'sb',INK,True,'Alert Title'),t(6,body,13,'r',MUT,True,'Alert Body',',lh(1.5)'),
       '    al(h,x(e),y(c),g(8),pad(4,0,0,0)) s(fill,hug) "Dialog Foot"']
    if secondary: o+=button(6,secondary)
    if primary: o+=danger_button(6,primary) if danger else button(6,primary,'primary')
    return o
