const I = {
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrowr: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const ic = (k, sz = 16, cls = '') => `<div data-node-label="Icon" className="size-[${sz}px] shrink-0 block ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">${I[k]}</svg></div>`;
const MARK = '<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M13 57l19-50 19 50" fill="none" stroke="#111111" strokeWidth="3.063" strokeLinecap="round" strokeLinejoin="round"></path><path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth="2.188" strokeLinecap="round"></path></svg>';
const F = '[font-family:var(--ad-font)]';
const T = (label, text, cls) => `<span data-node-label="${label}" className="${F} block ${cls}">${text}</span>`;
const ink = '[color:var(--ad-ink)]', mut = '[color:var(--paper-gray-600)]', sub = '[color:var(--paper-gray-500)]';
const btn = 'shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_1px_2px_#0000000a] [background-color:var(--ad-surface)]';
const fix = x => x.replace(/style=\{\{(.*?)\}\}/g, (m, b) => 'style="' + b.split(/,(?=[a-zA-Z]+:)/).map(p => { const [k, ...v] = p.split(':'); return k.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':' + v.join(':').replace(/^'|'$/g, ''); }).join(';') + '"');
const CLAUDE = "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"100%\" height=\"100%\"><path d=\"m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z\"></path></svg>";
const OPENAI = "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"100%\" height=\"100%\"><path d=\"M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z\"></path></svg>";
const lBtn = (t, kind = 'primary', ext = false, h = 44) => kind === 'primary'
  ? `<div data-node-label="Primary Button" className="flex h-[${h}px] items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[10px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_2px_6px_#2d6fcd33] px-5 gap-2">${T('Primary Label', t, 'text-white text-[15px] font-medium')}</div>`
  : `<div data-node-label="Secondary Button" className="flex h-[${h}px] items-center rounded-[10px] ${btn} px-5 gap-2">${T('Secondary Label', t, `${ink} text-[15px] font-medium`)}</div>`;
const SERIF = '[font-family:Newsreader]';
const SV = (label, text, cls) => `<span data-node-label="${label}" className="${SERIF} block ${cls}">${text}</span>`;
const figSlot = (label, w, h, extra = '') => `<div data-node-label="${label}" className="flex w-[${w}px] h-[${h}px] shrink-0 relative overflow-clip bg-white ${extra}"></div>`;
const MONO = '[font-family:Geist_Mono]';
const micro = (t, extra = '') => `<span data-node-label="Micro" className="${MONO} block ${/color:|text-\[#/.test(extra) || extra.includes(ink) ? '' : sub} text-[11px] tracking-[0.6px] ${extra}">${t}</span>`;
const XC = { navy: '#0F2433', b1: '#1D4A7A', b2: '#2D6FCD', b3: '#7FAEEB', b4: '#C9DCF7', grid: '#E6E9ED', up: '#16A34A', down: '#DC2626', mut: '#6B7A86', ink: '#222222' };
const asSection = (jsx, id, label) => jsx.replace(`data-node-id="${id}" data-node-label="${label}"`, `data-node-label="${label.split(' / ').pop()}"`);

const heroS1 = `<div data-node-id="ed43" data-node-label="S11.01 Discover / Landing / Hero" className="flex w-[1440px] h-[900px] flex-col items-center relative overflow-clip bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal]">
  <div data-node-label="Nav Wrap" className="flex w-full justify-center pt-5">
    <div data-node-label="Nav Capsule" className="flex h-[56px] items-center rounded-full bg-[#FFFFFFCC] shadow-[0px_0px_0px_1px_#0f243314,0px_10px_30px_#0f24331a,0px_2px_6px_#0f24330d,inset_0px_1px_0px_#ffffff] pl-5 pr-2 gap-6">
      <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[22px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[15px] font-semibold tracking-[-0.3px]`)}</div>
      <div data-node-label="Nav Divider" className="block w-px h-5 [background-color:#0f24331f]"></div>
      <div data-node-label="Nav Track" className="flex h-[40px] items-center rounded-full [background-color:#0f24330a] shadow-[inset_0px_1px_2px_#0f24330f] p-1 gap-0.5">
        <div data-node-label="Nav Tab Active" className="flex h-[32px] items-center rounded-full bg-white shadow-[0px_1px_3px_#0f24331f,0px_0px_0px_1px_#0f24330d] px-4">${T('Nav Link', 'Product', `${ink} text-[14px] font-medium`)}</div>
        ${['Agents', 'Pricing'].map(x => `<div data-node-label="Nav Tab" className="flex h-[32px] items-center rounded-full px-4">${T('Nav Link', x, `${mut} text-[14px]`)}</div>`).join('')}
      </div>
      <div data-node-label="Nav Actions" className="flex items-center gap-4 pl-1">${T('Nav Sign In', 'Sign in', `${ink} text-[14px] font-medium`)}${lBtn('Start free', 'primary', false, 40).replace('rounded-[10px]', 'rounded-full')}</div>
    </div>
  </div>
  <div data-node-label="Hero Copy" className="flex flex-col items-center pt-[80px] gap-6">
    <div data-node-label="Hero Headline" className="flex flex-col items-center">${T('Headline Line', 'Your next deck could be', `${ink} text-[84px] font-semibold leading-[1.02] tracking-[-3.6px] whitespace-nowrap`)}${T('Headline Line', 'your best work yet.', `${ink} text-[84px] font-semibold leading-[1.02] tracking-[-3.6px] whitespace-nowrap`)}</div>
    <span data-node-label="Hero Sub" className="${F} block w-[600px] text-center ${mut} text-[20px] leading-[1.5]">Aira builds board-ready decks the way top strategy teams do: the answer first, every number sourced, ready for PowerPoint.</span>
    <div data-node-label="Hero Actions" className="flex items-center gap-3 pt-2">${lBtn('Start free').replace('h-[44px]', 'h-[50px]')}<div data-node-label="Secondary Button" className="flex h-[50px] items-center rounded-[10px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-300),0px_1px_2px_#0000000d] px-6">${T('Secondary Label', 'See how it works', `${ink} text-[15px] font-medium`)}</div></div>
  </div>
  <div data-node-label="Capsule Wrap" className="flex absolute left-[170px] top-[600px] w-[1100px] h-[420px]">
    <div data-node-label="Capsule" className="flex w-[1100px] h-[420px] rounded-[210px]"></div>
  </div>
</div>`;

const navS1 = heroS1.slice(heroS1.indexOf('  <div data-node-label="Nav Wrap"'), heroS1.indexOf('  <div data-node-label="Hero Copy"'));

const MISSING_FINANCE_CHART_ART = '';
const tick = (label, val, dir) => `<div data-node-label="Tick" className="flex shrink-0 items-center gap-2.5 px-6 border-r [border-right-color:#E6E6E3]">${micro(label.toUpperCase(), 'whitespace-nowrap')}${T('Tick Val', val, `${MONO} ${ink} text-[13px] font-medium whitespace-nowrap`)}${T('Tick Dir', dir === 'up' ? '▲' : '▼', `${dir === 'up' ? '[color:#16A34A]' : '[color:#DC2626]'} text-[9px]`)}</div>`;
const TICKS = [['Action titles', '8/8', 'up'], ['MECE', 'Pass', 'up'], ['So what', 'Clear', 'up'], ['Ghost deck', 'Final', 'up'], ['Slides', '80 to 8', 'down'], ['Footnotes sourced', '100%', 'up'], ['EBITDA bridge', 'Tied out', 'up'], ['Comps', 'Refreshed', 'up'], ['Turn time', '2h', 'down'], ['Page flip', 'Done', 'up'], ['Board ask', 'Approve', 'up']];
const heroFin = `<div data-node-id="ed43" data-node-label="S11.01 Discover / Landing / Hero, finance" className="flex w-[1440px] h-[900px] flex-col relative overflow-clip bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal]">
  <div data-node-label="Chart" className="flex absolute left-0 top-0 w-[1440px] h-[900px]">${MISSING_FINANCE_CHART_ART}</div>
  ${navS1}
  <div data-node-label="Ticker" className="flex absolute left-0 top-[860px] w-[1440px] h-[40px] items-center overflow-clip border-t [border-top-color:#D7DCE2] bg-white">
    <div data-node-label="Ticker Label" className="flex shrink-0 h-full items-center px-6 [background-color:#0F2433]">${T('TL', 'GOOD DECK', `${MONO} text-white text-[11px] font-semibold tracking-[1px] whitespace-nowrap`)}</div>
    <div data-node-label="Ticker Track" className="flex shrink-0 h-full items-center">${TICKS.map(([l, v, d]) => tick(l, v, d)).join('')}</div>
  </div>
  <div data-node-label="Copy" className="flex absolute left-[96px] top-[236px] w-[900px] flex-col">
    ${SV('H Line', 'Clarity is the edge.', `${ink} text-[104px] font-normal leading-[1] tracking-[-3.4px] whitespace-nowrap`)}
    ${T('Sub', 'So clear the CEO puts the phone down.', `[color:#666666] text-[24px] font-normal tracking-[-0.4px] leading-[1.3] whitespace-nowrap pt-5`)}
    <div data-node-label="Actions" className="flex items-center gap-6 pt-9">${lBtn('Start free').replace('h-[44px]', 'h-[50px]').replace('rounded-[10px]', 'rounded-full')}<div data-node-label="Link" className="flex items-center gap-1.5">${T('Link Text', 'Import a PowerPoint', `${ink} text-[15px] font-medium`)}${ic('arrowr', 13, ink)}</div></div>
  </div>
  <div data-node-label="Decision Pill" className="flex absolute left-[1053px] top-[272px] h-[52px] items-center rounded-full bg-white shadow-[0px_0px_0px_1px_#0f243314,0px_14px_34px_#2d6fcd2e,0px_2px_6px_#0f24330f] pl-1.5 pr-5 gap-3">
    <div data-node-label="Yes Dot" className="flex size-[40px] justify-center items-center rounded-full [background-image:linear-gradient(180deg,#93B8EF_0%,#4D94FB_100%)] shadow-[inset_0px_1px_0px_#ffffff66,0px_0px_0px_1px_#2D6FCD] text-white">${ic('check', 18)}</div>
    <div data-node-label="Yes Text" className="flex flex-col gap-0.5">${T('Yes Title', 'Zero follow-up questions.', `${ink} text-[15px] font-semibold tracking-[-0.2px] whitespace-nowrap`)}</div>
  </div>
  <div data-node-label="Axis" className="flex absolute left-[96px] right-[96px] top-[836px] justify-between">${['Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25'].map(q => micro(q)).join('')}</div>
</div>`;
const heroSec = asSection(heroFin, 'ed43', 'S11.01 Discover / Landing / Hero, finance');

const magic2 = `<div data-node-label="Magic" className="flex w-[1440px] h-[1224px] shrink-0 relative overflow-clip bg-white border-t [border-top-color:#EEEEEC]">
  <div data-node-label="Mg Copy" className="flex absolute left-[96px] top-[112px] w-[1248px] flex-col">
    ${SV('Mg Title', 'Make slides like magic.', `${ink} text-[88px] font-normal leading-[1] tracking-[-3px] whitespace-nowrap`)}
    ${T('Mg Sub', 'Drop in your notes. Watch the deck build itself.', `[color:#666666] text-[24px] font-normal tracking-[-0.4px] whitespace-nowrap pt-6`)}
  </div>
  <div data-node-label="Band" className="flex absolute left-[96px] top-[328px] w-[1248px] h-[784px]">
    ${figSlot('Real Running Slot', 1248, 784, 'rounded-[16px] shadow-[0px_0px_0px_1px_#0000001a,0px_30px_80px_#2d6fcd26,0px_4px_12px_#0f24330d]')}
  </div>
  <div data-node-label="Run Pill" className="flex absolute left-[880px] top-[284px] h-[52px] items-center rounded-full bg-white shadow-[0px_0px_0px_1px_#0f243314,0px_14px_34px_#2d6fcd2e,0px_2px_6px_#0f24330f] pl-1.5 pr-5 gap-3">
    <div data-node-label="Yes Dot" className="flex size-[40px] justify-center items-center rounded-full [background-image:linear-gradient(180deg,#93B8EF_0%,#4D94FB_100%)] shadow-[inset_0px_1px_0px_#ffffff66,0px_0px_0px_1px_#2D6FCD] text-white">${ic('check', 18)}</div>
    ${T('Pill Text', 'Building slide 3 of 8. Coffee optional.', `${ink} text-[15px] font-semibold tracking-[-0.2px] whitespace-nowrap`)}
  </div>
</div>`;

const agentCap = (logo, name, dark, y) => `<div data-node-label="Agent Cap" className="flex absolute left-0 w-[248px] h-[64px] items-center gap-3.5 rounded-full bg-white shadow-[0px_0px_0px_1px_#0f243314,0px_8px_24px_#0f24330a] pl-2.5 pr-6" style={{top:'${y}px'}}>
    <div data-node-label="Logo Tile" className="flex size-[44px] shrink-0 justify-center items-center rounded-full ${dark === 'claude' ? 'bg-white shadow-[inset_0px_0px_0px_1px_#E6E8EB] [color:#D97757]' : dark ? '[background-color:#222222] text-white' : '[background-color:#EEF1F5] [color:#222222]'}"><div data-node-label="Logo" className="${dark === 'claude' ? 'size-[26px]' : 'size-[22px]'} block">${logo}</div></div>
    ${T('Agent Name', name, `${ink} text-[17px] font-semibold tracking-[-0.2px] whitespace-nowrap`)}
  </div>`;
const plugIcon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"></path></svg>';
const miniSlide = (() => { const seg = [[0.9, 1.3, 1.9, 2.6, 3.5], [1.2, 1.2, 1.3, 1.4, 1.6], [0.9, 0.9, 0.9, 1.0, 1.2]], K = 21, B = 232, out = [];
  ['FY21', 'FY22', 'FY23', 'FY24', 'FY25E'].forEach((y, i) => { const x = 44 + i * 84; let base = B;
    [[0, XC.navy], [1, XC.b2], [2, XC.b4]].forEach(([si, c]) => { const h = Math.round(seg[si][i] * K); out.push(`<div data-node-label="Bar" className="flex absolute w-[48px]" style={{left:'${x}px',top:'${base - h}px',height:'${h}px',backgroundColor:'${c}'}}></div>`); base -= h; });
    out.push(`<div data-node-label="Year" className="flex absolute w-[48px] justify-center" style={{left:'${x}px',top:'${B + 6}px'}}>${T('Year Text', y, '[color:#3B4B57] text-[9px] whitespace-nowrap')}</div>`); });
  return `<div data-node-label="Mini Slide" className="flex absolute left-[768px] top-[45px] w-[480px] h-[270px] rounded-[6px] bg-white overflow-clip shadow-[0px_0px_0px_1px_#0000001a,0px_30px_80px_#2d6fcd26,0px_4px_12px_#0f24330d]">
    <div data-node-label="Ms Title" className="flex absolute left-[28px] top-[24px]">${T('Ms Title Text', 'Enterprise carried the quarter', `[color:${XC.navy}] text-[19px] font-semibold tracking-[-0.3px] whitespace-nowrap`)}</div>
    <div data-node-label="Ms Unit" className="flex absolute left-[28px] top-[52px]">${T('Ms Unit Text', 'Revenue by customer segment, $M. Sample data.', '[color:#6B7A86] text-[10px] whitespace-nowrap')}</div>
    ${out.join('')}
  </div>`; })();
const agentsSec = `<div data-node-label="Agents" className="flex w-[1440px] h-[840px] shrink-0 relative overflow-clip bg-white border-t [border-top-color:#EEEEEC]">
  <div data-node-label="Ag Copy" className="flex absolute left-[96px] top-[120px] w-[1248px] flex-col">
    ${SV('Ag Title', 'Bring any agent.', `${ink} text-[88px] font-normal leading-[1] tracking-[-3px] whitespace-nowrap`)}
    ${T('Ag Sub', 'Claude, Codex or your own. Work however you like.', '[color:#666666] text-[24px] font-normal tracking-[-0.4px] whitespace-nowrap pt-6')}
  </div>
  <div data-node-label="Ag Visual" className="flex absolute left-[96px] top-[360px] w-[1248px] h-[360px]">
    <div data-node-label="Ag Lines" className="flex absolute left-0 top-0 w-[1248px] h-[360px]"><svg viewBox="0 0 1248 360" width="1248" height="360" fill="none"><path d="M248 60 C 390 60, 380 180, 500 180" stroke="#4D94FB" strokeWidth="1.5"></path><path d="M248 180 L 500 180" stroke="#4D94FB" strokeWidth="1.5"></path><path d="M248 300 C 390 300, 380 180, 500 180" stroke="#4D94FB" strokeWidth="1.5"></path><path d="M700 180 L 768 180" stroke="#4D94FB" strokeWidth="1.5"></path><circle cx="768" cy="180" r="3.5" fill="#4D94FB"></circle></svg></div>
    ${agentCap(CLAUDE, 'Claude', 'claude', 28)}
    ${agentCap(OPENAI, 'Codex', true, 148)}
    ${agentCap(plugIcon, 'Your agent', false, 268)}
    <div data-node-label="Hub" className="flex absolute left-[500px] top-[144px] w-[200px] h-[72px] justify-center items-center gap-3 rounded-full bg-white shadow-[0px_0px_0px_1px_#2d6fcd40,0px_14px_34px_#2d6fcd2e,0px_2px_6px_#0f24330f]">
      <div data-node-label="Mark" className="size-[28px] block">${MARK}</div>${T('Hub Name', 'AirDesign', `${ink} text-[19px] font-semibold tracking-[-0.3px] whitespace-nowrap`)}
    </div>
    ${miniSlide}
  </div>
</div>`;

const priceSec = `<div data-node-label="Pricing" className="flex w-[1440px] h-[840px] shrink-0 relative overflow-clip bg-white border-t [border-top-color:#EEEEEC]">
  <div data-node-label="Pr Copy" className="flex absolute left-0 top-[120px] w-[1440px] flex-col items-center">
    ${SV('Pr Title', 'AirDesign is free.', `${ink} text-[88px] font-normal leading-[1] tracking-[-3px] whitespace-nowrap`)}
    ${T('Pr Sub', 'Every feature, every week. No plan, no trial.', '[color:#666666] text-[24px] font-normal tracking-[-0.4px] whitespace-nowrap pt-6')}
  </div>
  <div data-node-label="Price Card Slot" className="flex absolute left-[500px] top-[344px] w-[440px] h-[353px]"></div>
  <div data-node-label="Pr Note" className="flex absolute left-0 top-[729px] w-[1440px] justify-center">${T('Pr Note Text', "Don't want to wait for the weekly reset? You can pay to reset.", '[color:#909090] text-[15px] whitespace-nowrap')}</div>
</div>`;

const footSec = `<div data-node-label="Footer" className="flex w-[1440px] h-[120px] shrink-0 items-center justify-between px-[96px] border-t [border-top-color:#EEEEEC] bg-white">
  <div data-node-label="Foot Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[20px] block">${MARK}</div>${T('Foot Name', 'AirDesign', `${ink} text-[14px] font-semibold`)}${T('Foot Line', 'Clarity is the edge.', `${sub} text-[14px]`)}</div>
  <div data-node-label="Foot Links" className="flex items-center gap-7">${['Pricing', 'Agent guides', 'Sign in', 'Privacy', 'Terms'].map(x => T('Foot Link', x, `${mut} text-[13px]`)).join('')}</div>
</div>`;

const landingE2E2 = `<div data-node-id="ed47" data-node-label="S11.01 Discover / Landing / Default" className="flex w-[1440px] flex-col bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal]">
  ${heroSec.replace('h-[900px] flex-col relative', 'h-[900px] shrink-0 flex-col relative')}
  ${magic2 + agentsSec + priceSec + footSec}
</div>`;

export default fix(landingE2E2);
