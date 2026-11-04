import fs from 'node:fs';
const I = {
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  slide: '<rect x="2.5" y="4" width="19" height="16" rx="1.2"/><rect x="6.5" y="8" width="11" height="8" rx="0.4"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  cursor: '<path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.12 1.58a2 2 0 0 0-1.44 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/>',
  text: '<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>',
  shape: '<rect x="3.5" y="3.5" width="10" height="10" rx="1.5"/><circle cx="15.5" cy="15.5" r="5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  clip: '<path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevr: '<path d="m9 6 6 6-6 6"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
  arrowr: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  pen: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  image2: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  font: '<path d="M4 20 10 4h1l6 16M6.5 14h8"/>',
  chevl: '<path d="m15 6-6 6 6 6"/>',
  actions: '<path d="m7 3 4 4-4 4-4-4z"/><circle cx="17" cy="7" r="3.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><path d="M17 14v7M13.5 17.5h7"/>',
  rmbg: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="2.5 2.5"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 18c.8-2.5 2.5-3.5 4.5-3.5s3.7 1 4.5 3.5"/>',
  hd: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M10 10v4M7 12h3M13 10v4h1.5a2 2 0 0 0 0-4z"/>',
  icon: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  alert: '<path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/>',
};
const ic = (k, sz = 16, cls = '') => `<div data-node-label="Icon" className="size-[${sz}px] shrink-0 block ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">${I[k]}</svg></div>`;
const MARK = '<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M13 57l19-50 19 50" fill="none" stroke="#111111" strokeWidth="3.063" strokeLinecap="round" strokeLinejoin="round"></path><path d="M6 44l52-14" fill="none" stroke="#FF58AE" strokeWidth="2.188" strokeLinecap="round"></path></svg>';
const SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%"><path d="M4.5 20.5 9.4 10.2M19.5 20.5 14.6 10.2"></path><path fill="currentColor" stroke="none" d="M12 1.6c.43 2.37 1.63 3.57 4 4-2.37.43-3.57 1.63-4 4-.43-2.37-1.63-3.57-4-4 2.37-.43 3.57-1.63 4-4z"></path></svg>';
const F = '[font-family:var(--ad-font)]';
const T = (label, text, cls) => `<span data-node-label="${label}" className="${F} block ${cls}">${text}</span>`;
const ink = '[color:var(--ad-ink)]', mut = '[color:var(--paper-gray-600)]', sub = '[color:var(--paper-gray-500)]';
const card = 'shadow-[0px_0px_0px_1px_#00000012,0px_2px_8px_#0000000a]';
const ring = 'shadow-[0px_0px_0px_1px_var(--paper-gray-200)]';
const btn = 'shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_1px_2px_#0000000a] [background-color:var(--ad-surface)]';

const BARS = [['Q3 24', 4.1], ['Q4 24', 4.6], ['Q1 25', 5.0], ['Q2 25', 5.4], ['Q3 25', 5.7]];
const K = JSON.parse(fs.readFileSync('/tmp/strat/review2/copy_kit.json', 'utf8'));
const tileIcon = (top, bot, edge, glyph) => `<div data-node-label="Notice Tile" className="flex size-5 justify-center items-center rounded-[6px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_${edge},0px_1px_2px_#0000001f]" style="background-image:linear-gradient(180deg,${top} 0%,${bot} 100%)">${glyph}</div>`;
const NOTICE_ICON = {
  ok: tileIcon('#93B8EF', '#4D94FB', '#2D6FCD', '<svg viewBox="0 0 12 12" width="11" height="11"><path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path></svg>'),
  error: tileIcon('#F29A9A', '#D93F3F', '#B92F2F', '<svg viewBox="0 0 12 12" width="11" height="11"><path d="M6 2.6v4.2" stroke="#fff" strokeWidth="1.9" strokeLinecap="round"></path><circle cx="6" cy="9.2" r="1" fill="#fff"></circle></svg>'),
  limit: tileIcon('#F29A9A', '#D93F3F', '#B92F2F', '<svg viewBox="0 0 12 12" width="11" height="11"><circle cx="6" cy="6" r="3.6" fill="none" stroke="#fff" strokeWidth="1.8"></circle></svg>'),
};
function toast({ kind = 'info', text, action }) {
  const icon = kind === 'success' ? `<div data-node-label="Toast Icon" className="flex size-4 justify-center items-center text-white">${ic('check', 15)}</div>` : kind === 'error' ? `<div data-node-label="Toast Icon" className="size-4 block"><svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#D93F3F"></circle><path d="M8 4.5v4.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"></path><circle cx="8" cy="11.3" r="1" fill="#fff"></circle></svg></div>` : '';
  return `<div data-node-label="Toast Wrap" className="flex absolute left-0 right-0 top-[12px] justify-center"><div data-node-label="Toast" className="flex h-10 items-center rounded-[10px] [background-color:var(--paper-gray-900)] shadow-[0px_8px_24px_#00000033] pl-3.5 ${action ? 'pr-1.5' : 'pr-4'} gap-2.5">${icon}${T('Toast Text', text, 'text-white text-[13px]')}${action ? `<div data-node-label="Toast Action" className="flex h-7 items-center rounded-[7px] px-2.5">${T('Toast Action Label', action, 'text-white text-[13px] font-medium')}</div>` : ''}</div></div>`;
}
function noticeCard({ kind, title, body, actions = [] }) {
  const b = (a) => a.primary ? `<div data-node-label="Reply Button" className="flex h-8 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-3">${T('Reply Button Label', a.label, 'text-white text-[13px] font-medium')}</div>` : `<div data-node-label="Reply Button" className="flex h-8 items-center rounded-[8px] ${btn} px-3">${T('Reply Button Label', a.label, `${ink} text-[13px] font-medium`)}</div>`;
  return `<div data-node-label="Notice Card" className="flex flex-col rounded-[12px] bg-white shadow-[0px_0px_0px_1px_#EAEAE7,0px_1px_2px_#0000000d] p-3.5 gap-3">
        <div data-node-label="Notice Head" className="flex items-center gap-2">${NOTICE_ICON[kind]}${T('Notice Title', title, `${ink} text-[13px] font-semibold`)}</div>
        ${T('Notice Body', body, `${mut} text-[12.5px] leading-[1.5]`)}
        ${actions.length ? `<div data-node-label="Notice Actions" className="flex items-center gap-2">${actions.map(b).join('')}</div>` : ''}
      </div>`;
}
function thumb(i, w, state) {
  const k = w / 160, px = v => `${Math.max(1, Math.round(v * k * 10) / 10)}px`, h = Math.round(w * 9 / 16);
  const box = (bg, inner, extra = '') => `<div data-node-label="Thumb ${i}" className="flex flex-col shrink-0 w-[${w}px] h-[${h}px] ${bg} rounded-[2px] overflow-hidden ${extra}" style={{padding:'${px(12)}',gap:'${px(5)}'}}>${inner}</div>`;
  const line = (wd, c = 'var(--paper-gray-200)', hh = 3) => `<div data-node-label="Line" className="shrink-0 block rounded-full" style={{width:'${px(wd)}',height:'${px(hh)}',backgroundColor:'${c}'}}></div>`;
  const title = (t, c = 'var(--paper-gray-900)') => `<span data-node-label="Thumb Title" className="${F} block font-semibold" style={{fontSize:'${px(10)}',color:'${c}',lineHeight:1.2}}>${t}</span>`;
  const white = 'bg-white ' + ring;
  if (state === 'queued') return `<div data-node-label="Thumb ${i} Queued" className="flex shrink-0 justify-center items-center w-[${w}px] h-[${h}px] rounded-[2px] [background-color:var(--paper-gray-50)] shadow-[inset_0px_0px_0px_1px_var(--paper-gray-200)]">${T('Queued', 'Queued', `${sub} text-[11px]`)}</div>`;
  switch (i) {
    case 1: return box('[background-color:var(--deck-navy)]', `<div data-node-label="Grow" className="flex-1 block"></div>${title('Q3 Investor Update', '#ffffff')}${line(50, '#ffffff55', 2.5)}`);
    case 2: return box(white, `${title('Three things to know')}${line(110)}${line(96)}${line(104)}`);
    case 3: return box(white, `${title('Revenue grew 39%')}<div data-node-label="Mini Bars" className="flex flex-1 items-end" style={{gap:'${px(8)}'}}>${BARS.map((b, j) => `<div data-node-label="Mini Bar" className="block" style={{width:'${px(16)}',height:'${px(b[1] * 7 - 14)}',backgroundColor:'${j === 4 ? 'var(--deck-teal)' : 'var(--deck-mist)'}'}}></div>`).join('')}</div>`);
    case 4: return box(white, `<span data-node-label="Big Number" className="${F} block font-semibold" style={{fontSize:'${px(26)}',color:'var(--deck-teal)',lineHeight:1}}>71%</span>${line(60)}`, 'justify-center');
    case 5: return box(white, `${title('Customers')}<div data-node-label="Logo Grid" className="flex flex-wrap" style={{gap:'${px(5)}'}}>${[0,1,2,3,4,5].map(() => `<div data-node-label="Logo Cell" className="block" style={{width:'${px(40)}',height:'${px(13)}',backgroundColor:'var(--paper-gray-100)'}}></div>`).join('')}</div>`);
    case 6: return box('[background-color:var(--deck-mist)]', `${title('Product', 'var(--deck-navy)')}`);
    case 7: return box(white, `${title('Hiring plan')}<div data-node-label="Avatars" className="flex" style={{gap:'${px(5)}'}}>${[0,1,2,3].map(() => `<div data-node-label="Avatar Dot" className="block rounded-full" style={{width:'${px(16)}',height:'${px(16)}',backgroundColor:'var(--paper-gray-200)'}}></div>`).join('')}</div>`);
    case 8: return box('[background-color:var(--deck-teal)]', `<div data-node-label="Grow" className="flex-1 block"></div>${title('Next quarter', '#ffffff')}${line(44, '#ffffff66', 2.5)}`);
  }
}

function topBar(view) {
  const seg = (k, on) => `<div data-node-label="View ${k}" className="flex justify-center items-center w-8 h-7 rounded-[6px] ${on ? 'bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_1px_2px_#0000000f] [color:var(--ad-ink)]' : '[color:var(--paper-gray-500)]'}">${ic(k, 16)}</div>`;
  return `<div data-node-label="Top Bar" className="flex shrink-0 h-12 items-center justify-between [background-color:var(--ad-surface)] border-b [border-bottom-color:var(--paper-gray-100)] px-3">
  <div data-node-label="Top Left" className="flex w-[360px] items-center gap-3">
    <div data-node-label="App Mark" className="flex size-8 shrink-0 justify-center items-center rounded-[8px]"><div data-node-label="Mark" className="size-[22px] block">${MARK}</div></div>
    <div data-node-label="Top Divider" className="w-px h-5 block [background-color:var(--paper-gray-200)]"></div>
    <div data-node-label="Deck Title" className="flex min-w-0 items-center gap-1.5">${T('Deck Title Text', 'Q3 Investor Update', `${ink} text-sm font-medium`)}${ic('chev', 14, sub)}</div>
  </div>
  <div data-node-label="View Toggle" className="flex items-center [background-color:var(--paper-gray-100)] rounded-[8px] p-0.5 gap-0.5">${seg('slide', view === 'slide')}${seg('grid', view === 'grid')}</div>
  <div data-node-label="Top Right" className="flex w-[360px] justify-end items-center gap-2">
    <div data-node-label="Export Button" className="flex h-8 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-3">${T('Export Label', 'Export', 'text-white text-[13px] font-medium')}</div>
  </div>
</div>`;
}

const deckHead = (cls = '') => `<div data-node-label="Deck Head" className="flex h-12 shrink-0 items-center gap-2 ${cls}"><div data-node-label="Mark" className="size-[20px] shrink-0 block">${MARK}</div><div data-node-label="Deck Title" className="flex min-w-0 items-center gap-1">${T('Deck Title Text', 'Q3 Investor Update', `${ink} text-[13px] font-medium truncate`)}${ic('chev', 14, sub)}</div></div>`;
const viewToggle = view => { const seg = (k, on) => `<div data-node-label="View ${k}" className="flex justify-center items-center size-8 rounded-[7px] ${on ? '[background-color:var(--paper-gray-100)] [color:var(--ad-ink)]' : '[color:var(--paper-gray-500)]'}">${ic(k, 16)}</div>`; return `${seg('slide', view === 'slide')}${seg('grid', view === 'grid')}`; };
function strip(mode) {
  const TW = 180;
  const item = i => {
    const queued = (mode === 'working' && i > 3) || ((mode === 'limit' || mode === 'resetdone') && i > 5), active = i === 3;
    const flag = mode === 'done' && i === 6, working = (mode === 'working' || mode === 'own') && i === 3;
    return `<div data-node-label="Strip Item ${i}" className="flex items-start rounded-[10px] ${active ? 'bg-[#e8f1fe]' : ''} p-2 gap-2">
      <div data-node-label="Strip Meta" className="flex w-4 flex-col items-center gap-1.5 pt-0.5">${T('Strip Number', String(i), `${active ? '[color:var(--paper-blue-link)] font-medium' : sub} text-xs`)}${working ? `<div data-node-label="Working Dot" className="size-1.5 block rounded-full [background-color:var(--ad-brand)]"></div>` : ''}</div>
      ${thumb(i, TW, queued ? 'queued' : '')}
    </div>`;
  };
  const head = (name, open, range) => `<div data-node-label="Section Head" className="flex h-8 items-center px-2 gap-2">${ic(open ? 'chev' : 'chevr', 14, sub)}${T('Section Name', name, `${ink} text-[13px] font-semibold`)}${range ? `<div data-node-label="Range Badge" className="flex h-5 items-center rounded-[5px] ${ring} px-1.5">${T('Range Text', range, `${sub} text-[11px]`)}</div>` : ''}</div>`;
  const stack = `<div data-node-label="Section Stack" className="flex pl-[34px] pt-1"><div data-node-label="Stack Inner" className="flex w-[180px] flex-col items-center">
      ${thumb(6, TW, ['working', 'limit', 'resetdone'].includes(mode) ? 'queued' : '')}
      <div data-node-label="Stack Layer" className="w-[166px] h-1.5 block rounded-b-[3px] bg-white ${ring}"></div>
      <div data-node-label="Stack Layer" className="w-[150px] h-1.5 block rounded-b-[3px] bg-white ${ring}"></div>
    </div></div>`;
  const items = `${head('Opening', true)}${item(1)}${item(2)}
    ${head('Performance', true)}${item(3)}${item(4)}${item(5)}
    ${head('Outlook', false, '6 to 8')}${stack}`;
  return `<div data-node-label="Slide Sidebar" className="flex w-[248px] h-full shrink-0 flex-col bg-white border-r [border-right-color:var(--paper-gray-100)]">
    <div data-node-label="Sidebar Head" className="flex h-14 shrink-0 items-center justify-between pl-3 pr-2">
      <div data-node-label="Deck Head" className="flex items-center gap-2"><div data-node-label="Mark" className="size-[20px] shrink-0 block">${MARK}</div><div data-node-label="Deck Title" className="flex items-center gap-1">${T('Deck Title Text', 'Q3 Investor Update', `${ink} text-[13px] font-medium`)}${ic('chev', 14, sub)}</div></div>
      <div data-node-label="Grid Button" className="flex size-8 justify-center items-center rounded-[7px] [color:var(--paper-gray-600)]">${ic('grid', 16)}</div>
    </div>
    <div data-node-label="New Slide Row" className="flex px-3 pb-2">
      <div data-node-label="New Slide Split" className="flex flex-1 h-8 items-center rounded-[8px] ${btn}">
        <div data-node-label="New Slide Main" className="flex flex-1 justify-center items-center gap-1">${T('New Slide Label', 'New slide', `${ink} text-[13px] font-medium`)}${ic('chev', 13, sub)}</div>
        <div data-node-label="Split Divider" className="w-px h-8 block [background-color:var(--paper-gray-200)]"></div>
        <div data-node-label="New Slide Quick" className="flex w-8 justify-center items-center [color:var(--ad-ink)]">${ic('plus', 15)}</div>
      </div>
    </div>
    <div data-node-label="Strip List" className="flex flex-col px-2 pb-2 gap-1 overflow-hidden">${items}</div>
  </div>`;
}

function slide(mode, W = 800) {
  const max = 5.7, ch = Math.round(210 * W / 800);
  const bars = BARS.map(([q, v], j) => `<div data-node-label="Bar Column" className="flex flex-1 flex-col justify-end items-center gap-1.5">${T('Bar Value', '$' + v + 'M', `[color:var(--deck-navy)] text-[13px] font-semibold`)}<div data-node-label="Bar" className="w-[72px] block" style={{height:'${Math.round(v / max * ch)}px',backgroundColor:'${j === 4 ? 'var(--deck-teal)' : 'var(--deck-mist)'}'}}></div></div>`).join('');
  const labels = BARS.map(([q]) => `<div data-node-label="Label Cell" className="flex flex-1 justify-center">${T('Bar Label', q, `${mut} text-xs`)}</div>`).join('');
  const editing = mode === 'working'; const own = mode === 'own'; const selChart = mode === 'compose';
  const work = editing || own;
  const slideEl = `<div data-node-label="Slide" className="flex w-[${W}px] h-[${Math.round(W * 9 / 16)}px] shrink-0 flex-col bg-white rounded-[${work ? 4 : 2}px] ${work ? '' : 'shadow-[0px_0px_0px_1px_#0000000f,0px_2px_8px_#0000000d,0px_12px_32px_#00000008]'} pt-11 pb-7 px-14 gap-1.5 relative">
    ${T('Slide Kicker', 'REVENUE', '[color:var(--deck-teal)] text-[11px] font-semibold tracking-[1.2px]')}
    ${T('Slide Headline', 'Revenue grew 39% year over year', '[color:var(--deck-navy)] text-[30px] font-semibold tracking-[-0.6px]')}
    <div data-node-label="Chart Space" className="flex-1 block"></div>
    <div data-node-label="Chart" className="flex flex-col rounded-[6px] p-1 gap-0 relative ${work ? 'shadow-[0px_0px_0px_1px_#4d94fb59]' : selChart ? 'border border-[#4D94FB] rounded-none' : ''}">
      <div data-node-label="Bars" className="flex h-[${ch + 26}px] gap-6 border-b [border-bottom-color:var(--paper-gray-200)]">${bars}</div>
      <div data-node-label="Bar Labels" className="flex gap-6 pt-2">${labels}</div>
      ${work ? '<div data-node-label="Working Sweep" className="flex absolute left-0 top-0 w-full h-full rounded-[6px] [background-image:linear-gradient(100deg,#4d94fb00_25%,#4d94fb26_50%,#8b7bff1a_62%,#4d94fb00_80%)]"></div>' : ''}
    </div>
    ${T('Slide Source', 'Source: Q3 board notes, unaudited', `${sub} text-[10px]`)}
  </div>`;
  if (!work) return slideEl;
  return `<div data-node-label="Working Glow" className="flex shrink-0 p-[2px] rounded-[6px] [background-image:linear-gradient(135deg,#4D94FB_0%,#A9C8FF_35%,#B9A8FF_65%,#4D94FB_100%)] shadow-[0px_0px_28px_#4d94fb59,-18px_-12px_56px_#93b8ef47,18px_14px_56px_#b39dff47]">${slideEl}</div>`;
}

function toolbar(view, menu = false, imgOn = false, shapeOn = false, shapeSel = false, textOn = false, actOn = false, tab = 'agent') {
  const tool = k => `<div data-node-label="Tool ${k}" className="flex justify-center items-center size-9 rounded-[8px] ${(imgOn && k === 'image') || ((shapeOn || shapeSel) && k === 'shape') || (textOn && k === 'text') || (actOn && k === 'actions') ? '[background-color:var(--ad-brand)] text-white' : '[color:var(--paper-gray-700)]'}">${ic(k, 18)}</div>`;
  const row = (k, label, key, on) => `<div data-node-label="Menu Item" className="flex h-8 items-center rounded-[7px] ${on ? '' : ''} pl-2 pr-2.5 gap-2.5">
      <div data-node-label="Check Slot" className="flex size-4 justify-center items-center text-white">${on ? ic('check', 14) : ''}</div>
      ${ic(k, 16, 'text-white')}${T('Menu Label', label, 'text-white text-[13px] flex-1')}${T('Menu Key', key, 'text-[#8c8c8c] text-xs')}</div>`;
  const pop = menu ? `<div data-node-label="Tool Menu" className="flex absolute left-[42px] bottom-[52px] w-[188px] flex-col rounded-[12px] [background-color:var(--paper-gray-900)] shadow-[0px_8px_24px_#00000033] p-1.5">${row('cursor', 'Move', 'V', true)}${row('hand', 'Hand tool', 'H', false)}</div>` : '';
  return `<div data-node-label="Toolbar" className="flex items-center bg-white rounded-[12px] shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_4px_12px_#0000000f] p-1 gap-1 relative">
    <div data-node-label="Move Group" className="flex items-center gap-0.5">
      <div data-node-label="Tool Move" className="flex justify-center items-center size-9 rounded-[8px] ${imgOn || shapeOn || shapeSel || textOn || actOn ? '[color:var(--paper-gray-700)]' : '[background-color:var(--ad-brand)] text-white'}">${ic('cursor', 18)}</div>
      <div data-node-label="Move Menu Button" className="flex justify-center items-center w-4 h-9 rounded-[6px] ${menu ? '[background-color:var(--paper-gray-100)]' : ''} [color:var(--paper-gray-600)]">${ic('chev', 12)}</div>
    </div>
    ${['text','shape','image','actions'].map(tool).join('')}
    <div data-node-label="Tool Divider" className="w-px h-6 block [background-color:var(--paper-gray-200)] mx-1"></div>
    ${panelSwitch(tab)}
    ${pop}

  </div>`;
}
const SHAPE_P = {
    square: '<rect x="3" y="3" width="18" height="18" rx="2.5"/>',
    circle: '<circle cx="12" cy="12" r="9.5"/>',
    diamond: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
    triangle: '<path d="M12 3 21.5 20.5H2.5z"/>',
    star: '<path d="m12 2.5 2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>',
    plus: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    arrowl: '<path d="M10 4 3 12l7 8v-5h11V9H10z"/>',
    arrowr: '<path d="M14 4l7 8-7 8v-5H3V9h11z"/>',
    bubble: '<path d="M3 4h18v12H10l-5 4v-4H3z"/>',
    tridown: '<path d="M2.5 3.5h19L12 21z"/>',
    pill: '<rect x="2.5" y="6" width="19" height="12" rx="6"/>',
    pentagon: '<path d="m12 2.5 9.5 7-3.6 11.5H6.1L2.5 9.5z"/>',
    octagon: '<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z"/>',
    chevron: '<path d="M3 5h13l5 7-5 7H3l5-7z"/>',
};
function shapeTray() {
  const P = SHAPE_P;
  const sh = k => `<div data-node-label="Shape ${k}" className="flex size-9 justify-center items-center rounded-[7px]"><div data-node-label="Shape Art" className="size-[26px] block"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="#4D94FB" stroke="#2D6FCD" strokeWidth="1" strokeLinejoin="round">${P[k]}</svg></div></div>`;
  return `<div data-node-label="Shape Tray" className="flex items-center bg-white rounded-[12px] shadow-[0px_0px_0px_1px_#00000014,0px_12px_32px_#0000001f] p-1.5 gap-0.5">
    ${[false, true].map(a => `<div data-node-label="Shape ${a ? 'arrow line' : 'line'}" className="flex size-9 justify-center items-center rounded-[7px]"><div data-node-label="Line Art" className="size-[22px] block"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#222222" strokeWidth="1.6" strokeLinecap="round"><path d="M5 19 19 5"/>${a ? '<path d="M11 5h8v8"/>' : ''}</svg></div></div>`).join('')}
    <div data-node-label="Tray Divider" className="w-px h-6 block [background-color:var(--paper-gray-200)] mx-1"></div>
    ${['square', 'circle', 'diamond', 'triangle', 'star', 'plus', 'arrowl', 'arrowr', 'bubble'].map(sh).join('')}
    <div data-node-label="Tray Divider" className="w-px h-6 block [background-color:var(--paper-gray-200)] mx-1"></div><div data-node-label="More Shapes" className="flex h-8 shrink-0 items-center rounded-[8px] px-2.5">${T('More Shapes Label', 'More shapes', `${ink} text-xs font-medium`)}</div>
  </div>`;
}

function notesBox(mode, W = 800) {
  const notes = mode === 'working' ? '' : 'Lead with the trend, then the Q3 number. Mention the two enterprise deals.';
  return `<div data-node-label="Notes" className="flex w-[${W}px] h-12 items-center rounded-[10px] [background-color:var(--paper-gray-100)] px-4">
      ${T('Notes Text', notes || 'Add speaker notes', `${notes ? 'text-[color:var(--paper-gray-700)]' : sub} text-[13px] flex-1 truncate`)}
    </div>`;
}
function canvas(mode, W = 800) {
  const notes = mode === 'working' ? '' : 'Lead with the trend, then the Q3 number. Mention the two enterprise deals.';
  return `<div data-node-label="Canvas" className="flex w-[${W}px] flex-col gap-3">
    ${T('Slide Number', '3', `${sub} text-[13px]`)}
    ${slide(mode, W)}
  </div>`;
}

const SECTIONS = [['Opening', [1, 2]], ['Performance', [3, 4, 5]], ['Outlook', [6, 7, 8]]];
const GW = 300, GH = 169, GG = 32, GL = 87, GT = 96, SEC = 241;
function pasteThumb(it) {
  const title = it === 'pa' ? 'Market share by region' : 'Churn is down to 4%';
  const body = it === 'pa' ? `<div data-node-label="Mini Bars" className="flex flex-1 items-end gap-2.5">${[46, 34, 58, 26].map(v => `<div data-node-label="Mini Bar" className="w-[26px] block" style="height:${v}px;background-color:#8a8a8a"></div>`).join('')}</div>`
    : `<div data-node-label="Lines" className="flex flex-col gap-2">${[180, 150, 164].map(v => `<div data-node-label="Line" className="h-[5px] block rounded-full" style="width:${v}px;background-color:#d7d7d6"></div>`).join('')}</div>`;
  return `<div data-node-label="Pasted Slide" className="flex shrink-0 w-[${GW}px] h-[${GH}px] flex-col rounded-[2px] bg-white ${ring} p-[22px] gap-3"><span data-node-label="Pasted Title" className="${F} block text-[15px] font-semibold" style="color:#1f1f1f">${title}</span>${body}</div>`;
}
function grid(state = 'idle') {
  const dark = it => it === 1 || it === 8;
  const cell = (it, n, rowSel) => {
    const isGhost = it === 'ghost', isNew = it === 'new', isPaste = typeof it === 'string' && it.startsWith('p');
    const sel = state === 'pasted' ? isPaste : state === 'added' ? isNew : state === 'idle' || state === 'hover' ? it === 3 : false;
    const numCls = isGhost || sel ? '[color:var(--paper-blue-link)] font-semibold' : dark(it) ? 'text-white/70' : '[color:var(--paper-gray-500)]';
    const body = isGhost ? `<div data-node-label="Ghost Slide" className="flex shrink-0 w-[${GW}px] h-[${GH}px] rounded-[2px] [background-color:var(--paper-gray-100)] border-2 border-dashed [border-color:var(--paper-gray-400)]"></div>`
      : isPaste ? pasteThumb(it) : isNew ? `<div data-node-label="New Slide Blank" className="flex shrink-0 w-[${GW}px] h-[${GH}px] rounded-[2px] bg-white ${ring}"></div>` : thumb(it, GW, '');
    const frame = rowSel ? 'shadow-[0px_0px_0px_4px_#a7c5f2]' : sel ? 'shadow-[0px_0px_0px_2px_var(--ad-brand)]' : '';
    return `<div data-node-label="Grid Item ${isGhost ? 'Ghost' : n}" className="flex rounded-[3px] ${frame} relative">${body}${n === '' ? '' : `<span data-node-label="Slide Number" className="${F} absolute left-[8px] top-[6px] block text-[11px] ${numCls}">${n}</span>`}</div>`;
  };
  let n = 0;
  const secs = SECTIONS.map(([name, items], k) => {
    let seq = items;
    if (k === 1 && state === 'hold') seq = [3, 4, 5, 'ghost'];
    if (k === 1 && state === 'added') seq = [3, 'new', 4, 5];
    if (k === 0 && state === 'pasted') seq = [1, 2, 'pa', 'pb'];
    const rowSel = state === 'section' && k === 2;
    const cells = seq.map(it => cell(it, it === 'ghost' ? '' : ++n, rowSel)).join('');
    return `<div data-node-label="Section ${name}" className="flex flex-col gap-4">
      <div data-node-label="Section Head" className="flex h-5 items-center gap-3">${T('Section Name', name, `${rowSel ? '[color:var(--paper-blue-link)]' : ink} text-xs font-semibold`)}<div data-node-label="Section Rule" className="flex-1 h-px block [background-color:var(--paper-gray-100)]"></div></div>
      <div data-node-label="Section Row" className="flex gap-8">${cells}</div>
    </div>`;
  }).join('');
  return `<div data-node-label="Grid" className="flex w-[${4 * GW + 3 * GG}px] flex-col gap-9">${secs}</div>`;
}
const rowMid = k => GT + k * SEC + 36 + GH / 2;
const gapX = (idx) => GL + (idx + 1) * GW + idx * GG + GG / 2;

const CURSOR = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 3l14 7.2-6.3 1.8L9.9 18.6z" fill="#111111" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round"></path></svg>';
function quickPicker() {
  const cell = n => `<div data-node-label="Layout Cell" className="flex flex-col gap-1.5">${layoutThumb(n, 112)}${T('Layout Name', n, `${ink} text-xs`)}</div>`;
  const pick = ['Title','Executive summary','Chart and takeaway','Two columns','Table','Next steps'];
  return `<div data-node-label="Quick Picker" className="flex w-[380px] flex-col bg-white rounded-[12px] shadow-[0px_0px_0px_1px_#00000014,0px_12px_32px_#0000001f] p-3 gap-3">
    <div data-node-label="Describe Field" className="flex h-10 items-center rounded-[9px] ${btn} pl-2.5 pr-1.5 gap-2">
      <div data-node-label="Describe Spark" className="flex size-5 shrink-0 justify-center items-center rounded-[6px] [background-color:var(--ad-brand)] text-white"><div data-node-label="Spark" className="size-3 block">${SPARK}</div></div>
      ${T('Describe Placeholder', 'Describe slide 4', `${sub} text-[13px] flex-1`)}
      <div data-node-label="Describe Send" className="flex size-7 justify-center items-center rounded-full [background-color:var(--paper-gray-200)] text-white">${ic('up', 14)}</div>
    </div>
    <div data-node-label="Quick Layouts" className="flex flex-col gap-3">
      <div data-node-label="Layout Row" className="flex gap-2">${pick.slice(0, 3).map(cell).join('')}</div>
      <div data-node-label="Layout Row" className="flex gap-2">${pick.slice(3).map(cell).join('')}</div>
    </div>
    <div data-node-label="Picker Foot" className="flex justify-between items-center">${T('All Layouts', 'All layouts', `[color:var(--paper-blue-link)] text-xs font-medium`)}${T('Blank Hint', 'Esc keeps it blank', `${sub} text-xs`)}</div>
  </div>`;
}

const LAYOUTS = ['Title','Section','Executive summary','Chart and takeaway','Two columns','Table','Big number','Timeline','Team','Next steps'];
function layoutThumb(n, w) {
  const k = w / 236, px = v => `${Math.round(v * k * 10) / 10}px`, h = Math.round(w * 9 / 16);
  const bar = (wd, hh = 4, c = 'var(--paper-gray-200)') => `<div data-node-label="Line" className="shrink-0 block rounded-full" style={{width:'${px(wd)}',height:'${px(hh)}',backgroundColor:'${c}'}}></div>`;
  const blk = (wd, hh, c = 'var(--paper-gray-100)') => `<div data-node-label="Block" className="shrink-0 block rounded-[2px]" style={{width:'${px(wd)}',height:'${px(hh)}',backgroundColor:'${c}'}}></div>`;
  const head = bar(110, 6, 'var(--deck-navy)');
  const col = (inner, g = 5) => `<div data-node-label="Col" className="flex flex-col" style={{gap:'${px(g)}'}}>${inner}</div>`;
  const rowx = (inner, g = 10, extra = '') => `<div data-node-label="Row" className="flex ${extra}" style={{gap:'${px(g)}'}}>${inner}</div>`;
  const body = {
    'Title': `<div data-node-label="Grow" className="flex-1 block"></div>${bar(130, 8, 'var(--deck-navy)')}${bar(80)}`,
    'Section': `<div data-node-label="Grow" className="flex-1 block"></div>${bar(20, 4, 'var(--deck-teal)')}${bar(120, 8, 'var(--deck-navy)')}<div data-node-label="Grow" className="flex-1 block"></div>`,
    'Executive summary': `${head}${col([0,1,2].map(() => rowx(blk(6, 6, 'var(--deck-teal)') + bar(150), 6, 'items-center')).join(''), 8)}`,
    'Chart and takeaway': `${head}${rowx(`<div data-node-label="Bars" className="flex items-end" style={{gap:'${px(5)}'}}>${[22,30,36,44,52].map((v, j) => blk(14, v, j === 4 ? 'var(--deck-teal)' : 'var(--deck-mist)')).join('')}</div>` + col(bar(70) + bar(60) + bar(66)), 16, 'items-end')}`,
    'Two columns': `${head}${rowx(col(bar(16, 4, 'var(--deck-teal)') + bar(80) + bar(70)) + col(bar(16, 4, 'var(--deck-teal)') + bar(80) + bar(70)), 22)}`,
    'Table': `${head}${col([0,1,2,3].map(r => rowx([0,1,2,3].map(() => blk(36, 7, r === 0 ? 'var(--paper-gray-200)' : 'var(--paper-gray-100)')).join(''), 4)).join(''), 4)}`,
    'Big number': `<div data-node-label="Grow" className="flex-1 block"></div><span data-node-label="Big" className="${F} block font-semibold" style={{fontSize:'${px(30)}',color:'var(--deck-teal)',lineHeight:1}}>71%</span>${bar(90)}<div data-node-label="Grow" className="flex-1 block"></div>`,
    'Timeline': `${head}<div data-node-label="Grow" className="flex-1 block"></div>${rowx([0,1,2,3].map(() => col(blk(8, 8, 'var(--deck-teal)') + bar(36), 5)).join(''), 14)}<div data-node-label="Grow" className="flex-1 block"></div>`,
    'Team': `${head}${rowx([0,1,2,3].map(() => col(`<div data-node-label="Face" className="block rounded-full" style={{width:'${px(26)}',height:'${px(26)}',backgroundColor:'var(--paper-gray-200)'}}></div>` + bar(30), 5)).join(''), 14)}`,
    'Next steps': `${head}${col([0,1,2].map(j => rowx(`<span data-node-label="Step No" className="${F} block font-semibold" style={{fontSize:'${px(9)}',color:'var(--deck-teal)'}}>${j + 1}</span>` + bar(120), 7, 'items-center')).join(''), 8)}`,
  }[n];
  return `<div data-node-label="Layout ${n}" className="flex flex-col shrink-0 bg-white rounded-[2px] ${ring} overflow-hidden" style={{width:'${w}px',height:'${h}px',padding:'${px(16)}',gap:'${px(10)}'}}>${body}</div>`;
}

function picker() {
  const tpl = (name, bg, titleColor, title, sub2) => `<div data-node-label="Template Cell" className="flex flex-col gap-2">
      <div data-node-label="Template Thumb" className="flex w-[224px] h-[126px] flex-col justify-center rounded-[2px] ${bg} px-5 gap-1.5">
        <span data-node-label="Thumb Title" className="${F} block text-[13px] font-semibold" style="color:${titleColor}">${title}</span>
        <div data-node-label="Thumb Line" className="w-[90px] h-[3px] block rounded-full" style="background-color:${sub2}"></div>
      </div>
      ${T('Template Name', name, `${ink} text-[13px]`)}
    </div>`;
  const group = (label, cells) => `<div data-node-label="Template Group" className="flex flex-col gap-3">${T('Group Label', label, `${ink} text-[13px] font-semibold`)}<div data-node-label="Template Row" className="flex gap-4">${cells}</div></div>`;
  return `<div data-node-label="New Slide Picker" className="flex w-[496px] flex-col pb-5 bg-white rounded-[14px] shadow-[0px_0px_0px_1px_#00000014,0px_12px_32px_#0000001f] overflow-hidden">
    <div data-node-label="Picker Search Wrap" className="flex p-3 border-b [border-bottom-color:var(--paper-gray-100)]">
      <div data-node-label="Picker Search" className="flex flex-1 h-10 items-center rounded-[10px] [background-color:var(--paper-gray-100)] px-3 gap-2">${ic('search', 15, sub)}${T('Search Placeholder', 'Search templates', `${sub} text-[13px]`)}</div>
    </div>
    <div data-node-label="Template Groups" className="flex flex-col px-4 pt-4 gap-6">
      ${group('Your templates', tpl('Halden', '[background-color:var(--deck-navy)]', '#ffffff', 'Halden', '#ffffff55'))}
      ${group('Basic', tpl('Light slides', 'bg-white ' + ring, 'var(--paper-gray-900)', 'Slide title', 'var(--paper-gray-200)') + tpl('Dark slides', '[background-color:var(--paper-gray-950)]', '#ffffff', 'Slide title', '#ffffff40'))}
    </div>
  </div>`;
}

const FLOW_P = [
  ['<path d="M7.5 6h13.5l-4.5 12H3z"/>', ''],
  ['<path d="M3 6h13.5l4.5 12H7.5z"/>', ''],
  ['<path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3z"/>', '<path d="M4 6c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'],
  ['<path d="M6 5h12c1.7 0 3 3.1 3 7s-1.3 7-3 7H6c-1.7 0-3-3.1-3-7s1.3-7 3-7z"/>', '<path d="M18 5c-1.7 0-3 3.1-3 7s1.3 7 3 7"/>'],
  ['<path d="M4 4h11l5 5v11H4z"/>', '<path d="M15 4v5h5"/>'],
  ['<path d="M3 5h6l2 2.5h10V19H3z"/>', '<path d="M3 9h18"/>'],
  ['<path d="M4 5h16v11c-3 0-5-2-8 0s-5 1.5-8 0z"/>', ''],
  ['<path d="M7 3h14v11c-3 0-5-2-7 0"/><path d="M3 7h14v11c-3 0-5-2-7 0s-4 1.5-7 0z"/>', ''],
  ['<rect x="3" y="5" width="18" height="14" rx="1"/>', '<path d="M7 5v14M17 5v14"/>'],
  ['<path d="M5 4h14v9l-7 6.5L5 13z"/>', ''],
  ['<path d="M3 6h18l-3.5 12h-11z"/>', ''],
  ['<path d="M4 7.5 20 4v16H4z"/>', ''],
  ['<path d="M7.5 5h9l4.5 7-4.5 7h-9L3 12z"/>', ''],
  ['<rect x="3" y="5" width="18" height="14" rx="1"/>', '<path d="M3 9.5h18M8 5v14"/>'],
  ['<circle cx="12" cy="12" r="9"/>', '<path d="M12 3v18M3 12h18"/>'],
  ['<circle cx="12" cy="12" r="9"/>', '<path d="m5.6 5.6 12.8 12.8M18.4 5.6 5.6 18.4"/>'],
];
function shapesPanel() {
  const tile = k => `<div data-node-label="Shape Tile" className="flex size-[68px] justify-center items-center rounded-[8px] [background-color:var(--paper-gray-50)]"><div data-node-label="Shape Art" className="size-[30px] block"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="#4D94FB" stroke="#2D6FCD" strokeWidth="1" strokeLinejoin="round">${SHAPE_P[k]}</svg></div></div>`;
  const line = arrow => `<div data-node-label="Shape Tile" className="flex size-[68px] justify-center items-center rounded-[8px] [background-color:var(--paper-gray-50)]"><div data-node-label="Line Art" className="size-[26px] block"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#222222" strokeWidth="1.5" strokeLinecap="round"><path d="M5 19 19 5"/>${arrow ? '<path d="M11 5h8v8"/>' : ''}</svg></div></div>`;
  const rows = arr => { const o = []; for (let k = 0; k < arr.length; k += 3) o.push(`<div data-node-label="Shape Row" className="flex gap-1.5">${arr.slice(k, k + 3).join('')}</div>`); return o.join(''); };
  const head = (t, open) => `<div data-node-label="Group Head" className="flex h-7 items-center gap-1">${ic(open ? 'chev' : 'chevr', 12, sub)}${T('Group Name', t, `${ink} text-xs font-semibold`)}</div>`;
  return `<div data-node-label="Slide Sidebar" className="flex w-[248px] h-full shrink-0 flex-col bg-white border-r [border-right-color:var(--paper-gray-100)]">
    <div data-node-label="Sidebar Head" className="flex h-14 shrink-0 items-center justify-between pl-3 pr-2">
      <div data-node-label="Deck Head" className="flex items-center gap-2"><div data-node-label="Mark" className="size-[20px] shrink-0 block">${MARK}</div><div data-node-label="Deck Title" className="flex items-center gap-1">${T('Deck Title Text', 'Q3 Investor Update', `${ink} text-[13px] font-medium`)}${ic('chev', 14, sub)}</div></div>
      <div data-node-label="Grid Button" className="flex size-8 justify-center items-center rounded-[7px] [color:var(--paper-gray-600)]">${ic('grid', 16)}</div>
    </div>
    <div data-node-label="Media Head" className="flex h-10 shrink-0 items-center px-2 gap-1">${ic('chevl', 16, ink)}${T('Media Title', 'Shapes', `${ink} text-sm font-semibold`)}</div>
    <div data-node-label="Media Search Wrap" className="flex px-3 pb-3 border-b [border-bottom-color:var(--paper-gray-100)]"><div data-node-label="Media Search" className="flex flex-1 h-8 items-center rounded-[8px] [background-color:var(--paper-gray-100)] px-2.5 gap-2">${ic('search', 14, sub)}${T('Media Search Text', 'Search shapes', `${sub} text-[13px]`)}</div></div>
    <div data-node-label="Shapes Body" className="flex flex-1 min-h-0 flex-col px-3 pt-2 gap-2 overflow-hidden">
      ${head('Lines', true)}${rows([line(false), line(true)])}
      ${head('Basic', true)}${rows(['square', 'circle', 'diamond', 'triangle', 'tridown', 'pill', 'pentagon', 'octagon', 'plus', 'arrowl', 'arrowr', 'chevron', 'star', 'bubble'].map(tile))}
      ${head('Flowchart', true)}${rows(FLOW_P.map(([f, o]) => `<div data-node-label="Shape Tile" className="flex size-[68px] shrink-0 justify-center items-center rounded-[8px] [background-color:var(--paper-gray-50)]"><div data-node-label="Shape Art" className="size-[30px] block"><svg viewBox="0 0 24 24" width="100%" height="100%" stroke="#2D6FCD" strokeWidth="1" strokeLinejoin="round"><g fill="#4D94FB">${f}</g><g fill="none">${o}</g></svg></div></div>`))}
    </div>
  </div>`;
}
function actionsPop() {
  const item = (k, t) => `<div data-node-label="Action Item" className="flex h-9 items-center rounded-[8px] px-2 gap-2.5">${ic(k, 17, ink)}${T('Action Label', t, `${ink} text-[13px]`)}</div>`;
  const head = t => T('Action Group', t, `${sub} text-xs pl-2 pt-1`);
  return `<div data-node-label="Actions Pop" className="flex w-[320px] flex-col bg-white rounded-[12px] shadow-[0px_0px_0px_1px_#00000014,0px_12px_32px_#0000001f] p-2 gap-1">
    <div data-node-label="Action Search" className="flex h-9 items-center rounded-[8px] [background-color:var(--paper-gray-100)] px-2.5 gap-2">${ic('search', 15, sub)}${T('Action Search Text', 'Search actions', `${sub} text-[13px]`)}</div>
    ${head('Insert')}${item('chart', 'Chart')}${item('table', 'Table')}${item('icon', 'Icon')}
    ${head('Image')}${item('rmbg', 'Remove background')}${item('hd', 'Boost resolution')}
  </div>`;
}
function textPanel() {
  const st = (label, cls) => `<div data-node-label="Text Style" className="flex items-center rounded-[8px] [background-color:var(--paper-gray-50)] px-3 py-2.5">${T('Style Sample', label, `${ink} ${cls}`)}</div>`;
  return `<div data-node-label="Slide Sidebar" className="flex w-[248px] h-full shrink-0 flex-col bg-white border-r [border-right-color:var(--paper-gray-100)]">
    <div data-node-label="Sidebar Head" className="flex h-14 shrink-0 items-center justify-between pl-3 pr-2">
      <div data-node-label="Deck Head" className="flex items-center gap-2"><div data-node-label="Mark" className="size-[20px] shrink-0 block">${MARK}</div><div data-node-label="Deck Title" className="flex items-center gap-1">${T('Deck Title Text', 'Q3 Investor Update', `${ink} text-[13px] font-medium`)}${ic('chev', 14, sub)}</div></div>
      <div data-node-label="Grid Button" className="flex size-8 justify-center items-center rounded-[7px] [color:var(--paper-gray-600)]">${ic('grid', 16)}</div>
    </div>
    <div data-node-label="Media Head" className="flex h-10 shrink-0 items-center px-2 gap-1">${ic('chevl', 16, ink)}${T('Media Title', 'Text', `${ink} text-sm font-semibold`)}</div>
    <div data-node-label="Add Text Wrap" className="flex px-3 pb-3 border-b [border-bottom-color:var(--paper-gray-100)]"><div data-node-label="Add Text Button" className="flex flex-1 h-8 justify-center items-center rounded-[8px] ${btn} gap-1.5">${ic('text', 14, ink)}${T('Add Text Label', 'Add text box', `${ink} text-[13px] font-medium`)}</div></div>
    <div data-node-label="Text Body" className="flex flex-1 min-h-0 flex-col px-3 pt-3 gap-2 overflow-hidden">
      ${T('Text Group', 'Halden styles', `${mut} text-xs font-medium`)}
      ${st('Title', 'text-[30px] font-semibold tracking-[-0.6px] leading-[1.1]')}${st('Header 1', 'text-[22px] font-semibold tracking-[-0.3px]')}${st('Header 2', 'text-lg font-semibold')}${st('Header 3', 'text-[15px] font-semibold')}${st('Body 1', 'text-[15px]')}${st('Body 2', 'text-sm')}${st('Body 3', 'text-[13px]')}${st('Note', 'text-xs [color:var(--paper-gray-600)]')}
    </div>
  </div>`;
}
function slideCol() {
  const th = i => `<div data-node-label="Col Thumb ${i}" className="flex rounded-[4px] p-[2px] ${i === 3 ? 'shadow-[0px_0px_0px_2px_var(--ad-brand)]' : ''}">${thumb(i, 60, '')}</div>`;
  const div = '<div data-node-label="Col Divider" className="w-8 h-px block [background-color:var(--paper-gray-200)] my-1"></div>';
  return `<div data-node-label="Slide Column" className="flex w-[96px] h-full shrink-0 flex-col items-center bg-white border-r [border-right-color:var(--paper-gray-100)] pt-3 gap-2">
    <div data-node-label="Col Add" className="flex w-[64px] h-8 shrink-0 justify-center items-center rounded-[8px] ${btn}">${ic('plus', 15, ink)}</div>
    <div data-node-label="Col Sep" className="w-full h-px block [background-color:var(--paper-gray-100)] my-1"></div>
    ${th(1)}${th(2)}${div}${th(3)}${th(4)}${th(5)}${div}${th(6)}${th(7)}${th(8)}
  </div>`;
}
function mediaPanel() {
  const col = arr => `<div data-node-label="Media Col" className="flex flex-1 flex-col gap-2">${arr.map(([h, c]) => `<div data-node-label="Media Tile" className="w-full block rounded-[6px]" style="height:${h}px;background-color:${c}"></div>`).join('')}</div>`;
  return `<div data-node-label="Slide Sidebar" className="flex w-[248px] h-full shrink-0 flex-col bg-white border-r [border-right-color:var(--paper-gray-100)]">
    <div data-node-label="Sidebar Head" className="flex h-14 shrink-0 items-center justify-between pl-3 pr-2">
      <div data-node-label="Deck Head" className="flex items-center gap-2"><div data-node-label="Mark" className="size-[20px] shrink-0 block">${MARK}</div><div data-node-label="Deck Title" className="flex items-center gap-1">${T('Deck Title Text', 'Q3 Investor Update', `${ink} text-[13px] font-medium`)}${ic('chev', 14, sub)}</div></div>
      <div data-node-label="Grid Button" className="flex size-8 justify-center items-center rounded-[7px] [color:var(--paper-gray-600)]">${ic('grid', 16)}</div>
    </div>
    <div data-node-label="Media Head" className="flex h-10 shrink-0 items-center px-2 gap-1">${ic('chevl', 16, ink)}${T('Media Title', 'Images', `${ink} text-sm font-semibold`)}</div>
    <div data-node-label="Media Search Wrap" className="flex px-3 pb-3 border-b [border-bottom-color:var(--paper-gray-100)]"><div data-node-label="Media Search" className="flex flex-1 h-8 items-center rounded-[8px] [background-color:var(--paper-gray-100)] px-2.5 gap-2">${ic('search', 14, sub)}${T('Media Search Text', 'Search images', `${sub} text-[13px]`)}</div></div>
    <div data-node-label="Media Body" className="flex flex-1 min-h-0 flex-col px-3 pt-3 gap-2.5 overflow-hidden">
      ${T('Media Label', 'Stock photos', `${mut} text-xs font-medium`)}
      <div data-node-label="Media Grid" className="flex gap-2">${col([[78, '#4f6b7d'], [130, '#a9c4d2'], [96, '#0f2433'], [120, '#c1c1c0'], [90, '#1d6b8f']])}${col([[120, '#d7d7d6'], [88, '#1d6b8f'], [140, '#a9c4d2'], [80, '#4f6b7d'], [110, '#eaeae7']])}</div>
    </div>
    <div data-node-label="Media Foot" className="flex shrink-0 flex-col border-t [border-top-color:var(--paper-gray-100)] p-3">
      <div data-node-label="Upload Button" className="flex h-9 justify-center items-center rounded-[8px] ${btn} gap-2">${ic('upload', 15, ink)}${T('Upload Label', 'Upload image', `${ink} text-[13px] font-medium`)}</div>
    </div>
  </div>`;
}
function ownLimitDialog(low = false) {
  return `<div data-node-label="Dialog Scrim" className="flex absolute left-0 top-0 w-[1470px] h-[923px] justify-center items-center [background-color:#00000040]">
    <div data-node-label="Alert Dialog" className="flex w-[400px] flex-col bg-white rounded-[16px] shadow-[0px_0px_0px_1px_#00000014,0px_24px_48px_#00000029] p-6 gap-4">
      <div data-node-label="Dialog Head" className="flex justify-between items-start"><div data-node-label="Alert Icon" className="flex size-9 justify-center items-center rounded-full bg-[#FDF0F0]"><svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="7" fill="none" stroke="#D93F3F" strokeWidth="2.2"></circle></svg></div><div data-node-label="Close Button" className="flex size-7 justify-center items-center rounded-[6px] [color:var(--paper-gray-600)]">${ic('x', 14)}</div></div>
      <div data-node-label="Alert Text" className="flex flex-col gap-1.5">${T('Alert Title', "You've hit this week's limit", `${ink} text-[17px] font-semibold`)}${T('Alert Body', 'It resets Monday at 8:00 AM, or you can reset now for $5.', `${mut} text-[13px] leading-[1.5]`)}</div>
      <div data-node-label="Dialog Foot" className="flex justify-end gap-2 pt-1">
        <div data-node-label="Secondary Button" className="flex h-9 items-center rounded-[8px] ${btn} px-4">${T('Secondary Label', 'Not now', `${ink} text-sm font-medium`)}</div>
        <div data-node-label="Primary Button" className="flex h-9 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-4">${T('Primary Label', 'Reset', 'text-white text-sm font-medium')}</div>
      </div>
    </div>
  </div>`;
}
function resetDialog(fail) {
  const row = (a, b, strong) => `<div data-node-label="Reset Row" className="flex justify-between items-center">${T('Reset Key', a, `${mut} text-[13px]`)}${T('Reset Val', b, `${ink} text-[13px] ${strong ? 'font-semibold' : ''}`)}</div>`;
  return `<div data-node-label="Dialog Scrim" className="flex absolute left-0 top-0 w-[1470px] h-[923px] justify-center items-center [background-color:#0000004d]">
    <div data-node-label="Reset Dialog" className="flex w-[400px] flex-col bg-white rounded-[14px] shadow-[0px_24px_64px_#00000040]">
      <div data-node-label="Dialog Head" className="flex h-14 items-center justify-between border-b [border-bottom-color:var(--paper-gray-100)] pl-5 pr-3">${T('Dialog Title', 'Reset weekly usage', `${ink} text-[15px] font-semibold`)}<div data-node-label="Close Button" className="flex size-8 justify-center items-center rounded-[8px] [color:var(--paper-gray-600)]">${ic('x', 16)}</div></div>
      <div data-node-label="Dialog Body" className="flex flex-col px-5 py-5 gap-4">
        ${T('Reset Lead', 'Your usage goes back to 100% right away.', `${ink} text-[13px]`)}
        <div data-node-label="Reset Rows" className="flex flex-col rounded-[10px] [background-color:var(--paper-gray-50)] p-3.5 gap-2.5">${row('Credit balance', '$15.00')}${row('Reset', '$5.00')}${row('After reset', '$10.00', true)}</div>
        ${fail ? `<div data-node-label="Pay Error" className="flex items-start rounded-[10px] bg-[#fdf0f0] px-3.5 py-3 gap-2.5">${ic('alert', 15, 'text-[#cf222e]')}${T('Pay Error Text', "Your card was declined. Nothing was charged. Try another card or bank QR.", 'text-[#8a1c24] text-[13px] leading-[1.45]')}</div>` : ''}
      </div>
      <div data-node-label="Dialog Foot" className="flex justify-end border-t [border-top-color:var(--paper-gray-100)] px-5 py-3 gap-2">
        <div data-node-label="Cancel Button" className="flex h-9 items-center rounded-[8px] ${btn} px-4">${T('Cancel Label', fail ? 'Add credits' : 'Cancel', `${ink} text-[13px] font-medium`)}</div>
        <div data-node-label="Reset Confirm" className="flex h-9 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-4">${T('Confirm Label', fail ? 'Try again' : 'Reset', 'text-white text-[13px] font-medium')}</div>
      </div>
    </div>
  </div>`;
}
function imagePop() {
  const tab = (t, on) => `<div data-node-label="Img Tab" className="flex h-7 items-center rounded-[6px] ${on ? 'bg-white shadow-[0px_1px_2px_#0000001a]' : ''} px-2.5">${T('Img Tab Label', t, `${on ? ink + ' font-medium' : mut} text-xs`)}</div>`;
  const tiles = ['#a9c4d2', '#4f6b7d', '#d7d7d6', '#1d6b8f', '#c1c1c0', '#0f2433'];
  return `<div data-node-label="Image Pop" className="flex w-[360px] flex-col bg-white rounded-[12px] shadow-[0px_0px_0px_1px_#00000014,0px_12px_32px_#0000001f] p-3 gap-3">
    <div data-node-label="Img Top" className="flex items-center justify-between"><div data-node-label="Img Tabs" className="flex items-center rounded-[8px] [background-color:var(--paper-gray-100)] p-0.5">${tab('Your images', false)}${tab('Stock photos', true)}${tab('Icons', false)}</div>${T('Upload Link', 'Upload', '[color:var(--paper-blue-link)] text-xs font-medium')}</div>
    <div data-node-label="Img Search" className="flex h-9 items-center rounded-[8px] [background-color:var(--paper-gray-50)] px-3 gap-2">${ic('search', 14, sub)}${T('Img Search Text', 'Office team meeting', `${ink} text-[13px]`)}</div>
    <div data-node-label="Img Grid" className="flex flex-col gap-1.5">${[0, 3].map(k => `<div data-node-label="Img Row" className="flex gap-1.5">${tiles.slice(k, k + 3).map(c => `<div data-node-label="Img Tile" className="flex-1 h-[72px] block rounded-[6px]" style="background-color:${c}"></div>`).join('')}</div>`).join('')}</div>
    ${T('Img Note', 'Free to use. Credit goes in the speaker notes when needed.', `${sub} text-[11px]`)}
  </div>`;
}
function errPage(id, label, title, sub2, cta) {
  return `<div data-node-id="${id}" data-node-label="${label}" className="flex w-[1470px] h-[923px] flex-col justify-center items-center bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Err Column" className="flex w-[360px] flex-col items-center gap-5">
    <div data-node-label="Err Mark" className="size-[44px] block">${MARK}</div>
    <div data-node-label="Err Text" className="flex flex-col items-center gap-1.5">${T('Err Title', title, `${ink} text-[15px] font-medium`)}${T('Err Sub', sub2, `${sub} text-[13px] text-center leading-[1.5]`)}</div>
    ${primary(cta)}
  </div>
</div>`;
}
function exportDialog(kind) {
  const row = (label, ctrl) => `<div data-node-label="Export Row" className="flex items-start gap-4"><div data-node-label="Row Label Box" className="flex w-[110px] h-9 shrink-0 items-center">${T('Row Label', label, `${mut} text-[13px]`)}</div><div data-node-label="Row Control" className="flex flex-1 flex-col gap-3">${ctrl}</div></div>`;
  const sel = v => `<div data-node-label="Select" className="flex h-9 items-center justify-between rounded-[8px] bg-white ${ring} px-3">${T('Select Value', v, `${ink} text-[13px]`)}${ic('chev', 14, sub)}</div>`;
  const radio = (label, sub2, on) => `<div data-node-label="Radio Row" className="flex items-start gap-2.5">
      <div data-node-label="Radio Slot" className="flex h-5 items-center"><div data-node-label="Radio" className="flex size-4 shrink-0 justify-center items-center rounded-full ${on ? '[background-color:var(--ad-brand)]' : 'border-[1.5px] [border-color:var(--paper-gray-300)]'}">${on ? '<div data-node-label="Radio Dot" className="size-1.5 block rounded-full bg-white"></div>' : ''}</div></div>
      <div data-node-label="Radio Text" className="flex flex-1 flex-col gap-0.5">${T('Radio Label', label, `${ink} text-[13px]`)}${T('Radio Sub', sub2, `${sub} text-xs leading-[1.45]`)}</div>
    </div>`;
  const body = kind === 'pptx'
    ? row('File type', sel('PowerPoint')) + row('Slides', sel('All slides'))
    : row('File type', sel('PDF')) + row('Slides', sel('All slides')) + row('Quality', sel('Standard'));
  return `<div data-node-label="Dialog Scrim" className="flex absolute left-0 top-0 w-[1470px] h-[923px] justify-center items-center [background-color:#0000004d]">
    <div data-node-label="Export Dialog" className="flex w-[480px] flex-col bg-white rounded-[14px] shadow-[0px_24px_64px_#00000040]">
      <div data-node-label="Dialog Head" className="flex h-14 items-center justify-between border-b [border-bottom-color:var(--paper-gray-100)] pl-5 pr-3">${T('Dialog Title', 'Export', `${ink} text-[15px] font-semibold`)}<div data-node-label="Close Button" className="flex size-8 justify-center items-center rounded-[8px] [color:var(--paper-gray-600)]">${ic('x', 16)}</div></div>
      <div data-node-label="Dialog Body" className="flex flex-col px-5 py-5 gap-3">${body}</div>
      <div data-node-label="Dialog Foot" className="flex justify-end border-t [border-top-color:var(--paper-gray-100)] px-5 py-3"><div data-node-label="Export Confirm" className="flex h-9 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-4">${T('Confirm Label', 'Export', 'text-white text-[13px] font-medium')}</div></div>
    </div>
  </div>`;
}
function exportPop() {
  const opt = (label, sub2, on) => `<div data-node-label="Export Option" className="flex items-center rounded-[8px] ${on ? '[background-color:var(--paper-gray-50)]' : ''} px-2.5 py-2 gap-2.5">
      <div data-node-label="Radio" className="flex size-4 shrink-0 justify-center items-center rounded-full ${on ? '[background-color:var(--ad-brand)]' : 'border-[1.5px] [border-color:var(--paper-gray-300)]'}">${on ? '<div data-node-label="Radio Dot" className="size-1.5 block rounded-full bg-white"></div>' : ''}</div>
      <div data-node-label="Option Text" className="flex flex-col gap-0.5">${T('Option Label', label, `${ink} text-[13px] font-medium`)}${T('Option Sub', sub2, `${sub} text-xs`)}</div>
    </div>`;
  return `<div data-node-label="Export Pop" className="flex w-[260px] flex-col bg-white rounded-[12px] shadow-[0px_0px_0px_1px_#00000014,0px_12px_32px_#0000001f] p-1.5 gap-1">
    ${opt('PowerPoint', 'Editable .pptx', true)}
    ${opt('PDF', 'For reading and print', false)}
    <div data-node-label="Pop Action" className="flex px-1 pt-1 pb-0.5"><div data-node-label="Download Button" className="flex flex-1 h-9 justify-center items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f]">${T('Download Label', 'Download', 'text-white text-[13px] font-medium')}</div></div>
  </div>`;
}
function panelHead(tab, offline = false) {
  const on = 'bg-white shadow-[0px_1px_2px_#0000001a]';
  return `<div data-node-label="Panel Head" className="flex h-14 shrink-0 items-center justify-between border-b [border-bottom-color:var(--paper-gray-100)] pl-3 pr-2">
      <div data-node-label="Zoom" className="flex h-8 items-center pr-1 gap-0.5">${T('Zoom Value', '64%', `${mut} text-[13px]`)}${ic('chev', 12, sub)}</div>
      <div data-node-label="Export Button" className="flex h-8 items-center ${offline ? 'opacity-40' : ''} [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-3">${T('Export Label', 'Export', 'text-white text-[13px] font-medium')}</div>
    </div>`;
}
function panelSwitch(tab) {
  const on = 'bg-white shadow-[0px_1px_2px_#0000001a]';
  return `<div data-node-label="Panel Switch" className="flex h-8 items-center rounded-[8px] [background-color:var(--paper-gray-100)] p-0.5 gap-0">
        <div data-node-label="Switch Agent" className="flex h-7 items-center rounded-[6px] ${tab === 'agent' ? on : ''} px-2.5 gap-1.5"><div data-node-label="Spark" className="size-[14px] block ${tab === 'agent' ? '[color:var(--ad-brand)]' : '[color:var(--paper-gray-600)]'}">${SPARK}</div>${T('Switch Label', 'Agent', `${tab === 'agent' ? ink + ' font-medium' : mut} text-[13px]`)}</div>
        <div data-node-label="Switch Design" className="flex h-7 items-center rounded-[6px] ${tab === 'design' ? on : ''} px-2.5 gap-1.5">${ic('sliders', 14, tab === 'design' ? ink : mut)}${T('Switch Label', 'Design', `${tab === 'design' ? ink + ' font-medium' : mut} text-[13px]`)}</div>
      </div>`;
}
function designPanel() {
  const sec = (title, inner, last) => `<div data-node-label="Design Section" className="flex flex-col ${last ? '' : 'border-b [border-bottom-color:var(--paper-gray-100)]'} px-4 py-4 gap-3">${T('Section Title', title, `${ink} text-[13px] font-semibold`)}${inner}</div>`;
  const field = (label, inner) => `<div data-node-label="Field" className="flex h-9 items-center justify-between rounded-[8px] bg-white ${ring} px-3">${inner}</div>`;
  const sw = (c, name, border) => `<div data-node-label="Color Row" className="flex h-9 items-center rounded-[8px] bg-white ${ring} px-3 gap-2.5"><div data-node-label="Swatch" className="size-4 block rounded-[4px] ${border ? ring : ''}" style="background-color:${c}"></div>${T('Color Name', name, `${ink} text-[13px]`)}</div>`;
  const theme = `<div data-node-label="Theme Card" className="flex items-center rounded-[10px] bg-white ${ring} p-2 gap-3">
      <div data-node-label="Theme Swatch" className="flex w-10 h-10 shrink-0 overflow-hidden rounded-[6px]"><div data-node-label="Sw1" className="flex-1 block" style="background-color:var(--deck-navy)"></div><div data-node-label="Sw2" className="flex-1 block" style="background-color:var(--deck-teal)"></div><div data-node-label="Sw3" className="flex-1 block" style="background-color:var(--deck-mist)"></div></div>
      <div data-node-label="Theme Text" className="flex flex-1 flex-col gap-0.5">${T('Theme Name', 'Halden', `${ink} text-[13px] font-medium`)}${T('Theme Font', 'Geist', `${sub} text-xs`)}</div>
      ${ic('chev', 14, sub)}
    </div>`;
  const bgSeg = `<div data-node-label="Background Type" className="flex h-8 items-center rounded-[8px] [background-color:var(--paper-gray-100)] p-0.5">
      <div data-node-label="Type Color" className="flex flex-1 h-7 justify-center items-center rounded-[6px] bg-white shadow-[0px_1px_2px_#0000001a]">${T('Type Label', 'Color', `${ink} text-xs font-medium`)}</div>
      <div data-node-label="Type Image" className="flex flex-1 h-7 justify-center items-center rounded-[6px]">${T('Type Label', 'Image', `${mut} text-xs`)}</div>
    </div>`;
  return `<div data-node-label="Agent Panel" className="flex w-[360px] h-full shrink-0 flex-col bg-white border-l [border-left-color:var(--paper-gray-100)]">
    ${panelHead('design')}
    <div data-node-label="Slide Title Row" className="flex h-12 shrink-0 items-center border-b [border-bottom-color:var(--paper-gray-100)] px-4">${T('Design Slide', 'Slide 3', `${ink} text-sm font-semibold`)}</div>
    ${sec('Template', theme)}
    ${sec('Background', bgSeg + sw('#ffffff', 'White', true))}
    ${sec('Colors', `<div data-node-label="Colors" className="grid grid-cols-2 gap-2">${sw('var(--deck-navy)', 'Navy')}${sw('var(--deck-teal)', 'Teal')}${sw('var(--deck-mist)', 'Mist')}${sw('#ffffff', 'White', true)}</div>`, true)}
  </div>`;
}
function panel(mode, usageOpen = false, offline = false) {
  const working = mode === 'working';
  if (mode === 'own') mode = 'done';
  const badge = sz => `<div data-node-label="Agent Badge" className="flex size-[${sz}px] shrink-0 justify-center items-center rounded-[6px] [background-color:var(--ad-brand)] text-white"><div data-node-label="Spark" className="size-[${Math.round(sz * 0.6)}px] block">${SPARK}</div></div>`;
  const step = (st, txt) => `<div data-node-label="Step" className="flex h-6 items-center gap-2">
    ${st === 'done' ? `<div data-node-label="Step Done" className="flex size-3.5 shrink-0 justify-center items-center [color:var(--paper-gray-400)]">${ic('check', 13)}</div>` : st === 'now' ? '<div data-node-label="Step Now" className="flex size-3.5 shrink-0 justify-center items-center"><div data-node-label="Now Dot" className="size-[7px] block rounded-full [background-color:var(--ad-brand)]"></div></div>' : '<div data-node-label="Step Next" className="flex size-3.5 shrink-0 justify-center items-center"><div data-node-label="Next Ring" className="size-[7px] block rounded-full border-[1.5px] [border-color:var(--paper-gray-300)]"></div></div>'}
    ${T('Step Text', txt, `${st === 'now' ? ink + ' font-medium' : st === 'done' ? mut : sub} text-[13px]`)}</div>`;
  const ask = `<div data-node-label="Person Message" className="flex flex-col self-end max-w-[280px] items-end gap-1.5">
      <div data-node-label="Person Bubble" className="flex [background-color:var(--paper-gray-100)] rounded-[14px] px-3.5 py-2.5">${T('Person Text', 'Make an 8-slide investor update from my notes. Calm, data first, our Halden brand.', `${ink} text-[13px] leading-[1.5]`)}</div>
      <div data-node-label="Attachment" className="flex h-7 items-center rounded-[8px] ${ring} px-2 gap-1.5">${ic('doc', 13, mut)}${T('Attachment Name', 'Q3 board notes.docx', `${mut} text-xs`)}</div>
    </div>`;
  const act = (txt, extra = '') => `<div data-node-label="Activity" className="flex items-center gap-1.5">${T('Activity Text', txt, `${sub} text-[13px]`)}${extra}<div data-node-label="Caret" className="size-2.5 block [color:var(--paper-gray-400)]"><svg viewBox="0 0 10 10" width="100%" height="100%"><path d="M3.5 2.5 7 5l-3.5 2.5z" fill="currentColor"></path></svg></div></div>`;
  const btnSm = (t, primary) => primary ? `<div data-node-label="Reply Button" className="flex h-8 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-3">${T('Reply Button Label', t, 'text-white text-[13px] font-medium')}</div>` : `<div data-node-label="Reply Button" className="flex h-8 items-center rounded-[8px] ${btn} px-3">${T('Reply Button Label', t, `${ink} text-[13px] font-medium`)}</div>`;
  if (mode === 'limit') var replyX = `
      ${act('Read 1 file, built slides 1 to 5')}
      ${noticeCard({ kind: 'limit', title: K['usage.limit_title'], body: K['usage.limit_body'], actions: [{ label: K['usage.reset_action'], primary: true }] })}`;
  if (mode === 'resetdone') var replyX = `
      ${act('Read 1 file, built slides 1 to 5')}
      ${noticeCard({ kind: 'ok', title: K['history.reset'], body: K['agent.resume_line'], actions: [{ label: K['agent.resume'], primary: true }] })}`;
  if (mode === 'runfail') var replyX = `
      ${act('Read 1 file, built slides 1 to 3')}
      ${noticeCard({ kind: 'error', title: K['agent.failed_title'], body: K['agent.failed_body'], actions: [{ label: K['agent.resume'], primary: true }, { label: K['common.undo'] }] })}`;
  const reply = replyX ? replyX : working ? `
      ${act('Read 1 file, applied Halden brand')}
      ${T('Agent Text', 'Eight slides from your notes. Every chart uses your numbers.', `${ink} text-[13px] leading-[1.6]`)}
      ${act('Built slides 1 and 2')}
      <div data-node-label="Activity Now" className="flex items-center">${T('Now Text', 'Building slide 3 of 8', `${sub} text-[13px]`)}</div>` : `
      ${act('Read 1 file, built 8 slides')}
      ${T('Agent Text', 'Your deck is ready. Eight slides, every number from your notes.', `${ink} text-[13px] leading-[1.6]`)}
      <div data-node-label="Run Undo" className="flex items-center gap-1.5">${ic('undo', 13, sub)}${T('Undo Label', 'Undo', `${sub} text-xs`)}</div>
`;
  return `<div data-node-label="Agent Panel" className="flex w-[360px] h-full shrink-0 flex-col bg-white border-l [border-left-color:var(--paper-gray-100)] relative">
    ${panelHead('agent', offline)}
    <div data-node-label="Chat Bar" className="flex h-11 shrink-0 items-center justify-between pl-3 pr-3">
      <div data-node-label="Chat Session" className="flex h-6 items-center rounded-[6px] pl-1 pr-1.5 gap-1.5">${ic('history', 13, sub)}${T('Session Name', 'Q3 investor update', `${mut} text-xs`)}${ic('chev', 11, sub)}</div>
      <div data-node-label="Chat Bar Right" className="flex items-center gap-0.5">
        <div data-node-label="Usage Ring Button" className="flex size-6 justify-center items-center rounded-[6px] ${usageOpen ? '[background-color:var(--paper-gray-100)]' : ''}"><div data-node-label="Usage Ring" className="size-4 block"><svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#D7D7D6" strokeWidth="2.5"></circle><circle cx="10" cy="10" r="7.5" fill="none" stroke="${mode === 'limit' ? '#E5484D' : '#4D94FB'}" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="${(2 * Math.PI * 7.5 * (mode === 'limit' ? 1 : mode === 'resetdone' ? 0.02 : working ? 0.34 : 0.38)).toFixed(1)} 100" transform="rotate(-90 10 10)"></circle></svg></div></div>
        <div data-node-label="New Chat Button" className="flex size-7 justify-center items-center rounded-[7px] [color:var(--paper-gray-600)]">${ic('pen', 15)}</div>
      </div>
    </div>
    <div data-node-label="Conversation" className="flex flex-1 flex-col px-4 pt-3 gap-6">
      ${ask}
      <div data-node-label="Agent Turn" className="flex flex-col gap-3.5">${reply}</div>
    </div>
    ${mode === 'compose' ? `<div data-node-label="Composer Wrap" className="flex flex-col px-3 pb-3 gap-2">
      <div data-node-label="Composer" className="flex flex-col rounded-[14px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_2px_8px_#0000000d] p-3 gap-2.5">
        <div data-node-label="Context Chips" className="flex flex-wrap items-center gap-1.5">
          <div data-node-label="Context Chip" className="flex h-6 shrink-0 items-center rounded-[6px] [background-color:var(--paper-gray-100)] pl-2 pr-1 gap-1">${T('Chip Label', 'Slide 3', `${mut} text-xs`)}${ic('x', 11, sub)}</div>
          <div data-node-label="Context Chip" className="flex h-6 shrink-0 items-center rounded-[6px] bg-[#EEF4FE] pl-2 pr-1 gap-1">${ic('chart', 12, '[color:var(--paper-blue-link)]')}${T('Chip Label', 'Bar chart', '[color:var(--paper-blue-link)] text-xs')}${ic('x', 11, '[color:var(--paper-blue-link)]')}</div>
        </div>
        <div data-node-label="Message Field" className="flex flex-col max-h-[168px] overflow-clip relative">
          ${T('Message Text', 'Make this chart tell the story faster. Lead with the Q3 number, then show the trend across all five quarters. Keep our Halden colors and label each bar with its value. Add one takeaway line under the title, revenue grew 39% year over year, and cut the source note down to a single line so the slide breathes.', `${ink} text-[13px] leading-[1.6]`)}
          <div data-node-label="Message Fade" className="flex absolute left-0 bottom-0 w-full h-8 [background-image:linear-gradient(180deg,#ffffff00_0%,#ffffff_100%)]"></div>
        </div>
        <div data-node-label="Composer Foot" className="flex items-center justify-between">
          <div data-node-label="Attach Button" className="flex size-7 shrink-0 justify-center items-center rounded-[7px] [color:var(--ad-ink)]">${ic('plus', 17)}</div>
          <div data-node-label="Send Button" className="flex size-8 shrink-0 justify-center items-center rounded-full [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] text-white">${ic('up', 16)}</div>
        </div>
      </div>
    </div>` : `<div data-node-label="Composer Wrap" className="flex flex-col px-3 pb-3 gap-2">
      <div data-node-label="Composer" className="flex h-12 items-center rounded-[14px] ${offline ? '[background-color:var(--paper-gray-50)] opacity-60' : 'bg-white'} shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_2px_8px_#0000000d] pl-3 pr-2 gap-2.5">
        <div data-node-label="Attach Button" className="flex size-7 shrink-0 justify-center items-center rounded-[7px] [color:var(--ad-ink)]">${ic('plus', 17)}</div>
        ${mode === 'limit' || offline ? '' : `<div data-node-label="Context Chip" className="flex h-6 shrink-0 items-center rounded-[6px] [background-color:var(--paper-gray-100)] pl-2 pr-1 gap-1">${T('Chip Label', 'Slide 3', `${mut} text-xs`)}${ic('x', 11, sub)}</div>`}
        ${T('Composer Placeholder', offline ? 'Waits for connection' : mode === 'limit' ? 'Resets Monday at 8:00 AM' : working ? 'Add to the request' : 'Ask Aira', `${sub} text-[13px] flex-1`)}
        ${working ? '<div data-node-label="Stop Button" className="flex size-7 shrink-0 justify-center items-center rounded-full [background-color:var(--paper-gray-900)]"><div data-node-label="Stop Square" className="size-2.5 block rounded-[2px] bg-white"></div></div>' : `<div data-node-label="Mic Button" className="flex size-7 shrink-0 justify-center items-center rounded-[7px] [color:var(--ad-ink)]">${ic('mic', 17)}</div>`}
      </div>
    </div>`}
      ${usageOpen ? `<div data-node-label="Usage Pop" className="flex absolute right-3 top-[100px] w-[220px] flex-col bg-white rounded-[10px] shadow-[0px_0px_0px_1px_#00000014,0px_8px_24px_#0000001a] p-3 gap-2">
        <div data-node-label="Pop Head" className="flex justify-between items-center">${T('Pop Title', 'Weekly usage', `${ink} text-xs font-medium`)}${T('Pop Value', '38%', `${ink} text-xs font-medium`)}</div>
        <div data-node-label="Pop Track" className="flex h-1 rounded-full [background-color:var(--paper-gray-100)]"><div data-node-label="Pop Fill" className="w-[38%] h-1 block rounded-full [background-color:var(--ad-brand)]"></div></div>
        <div data-node-label="Pop Foot" className="flex justify-between items-center">${T('Pop Reset', 'Resets Mon 8:00 AM', `${sub} text-[11px]`)}<div data-node-label="See All" className="flex items-center gap-0.5">${T('See All Label', 'See all', `${ink} text-[11px] font-medium`)}${ic('arrowr', 11, ink)}</div></div>
      </div>` : ''}
  </div>`;
}

const island = inner => `<div data-node-label="Island" className="flex h-11 items-center bg-white rounded-[12px] ${card} px-1.5 gap-1">${inner}</div>`;
const at = (label, x, y, inner, extra = '') => `<div data-node-label="${label}" className="flex absolute ${extra}" style="${typeof x === 'string' ? x : 'left:' + x + 'px'};top:${y}px">${inner}</div>`;
const slideScreen = (id, label, mode, withPicker, tab = 'agent', exp = '') => `<div data-node-id="${id}" data-node-label="${label}" className="flex w-[1470px] h-[923px] [background-color:var(--paper-gray-50)] [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip relative">
${exp === 'image' ? mediaPanel() + slideCol() : exp === 'shapes' ? shapesPanel() + slideCol() : exp === 'text' ? textPanel() + slideCol() : strip(mode)}
<div data-node-label="Stage" className="flex flex-1 min-w-0 flex-col items-center pt-14 pb-4 gap-0 relative">
  ${canvas(mode, ['image', 'shapes', 'text'].includes(exp) ? 720 : 800)}
  <div data-node-label="Stage Space" className="flex-1 block"></div>
  <div data-node-label="Notes Handle" className="w-12 h-1 block rounded-full [background-color:var(--paper-gray-300)]"></div>
  <div data-node-label="Handle Gap" className="h-2 block"></div>
  ${notesBox(mode, ['image', 'shapes', 'text'].includes(exp) ? 720 : 800)}
  <div data-node-label="Notes Gap" className="h-3 block"></div>
  ${exp ? '' : ''}${toolbar('slide', mode === 'done' && !withPicker && !exp, exp === 'image', exp === 'shape', exp === 'shapes', exp === 'text', exp === 'actions', tab)}
  ${exp === 'shape' || exp === 'actions' ? `<div data-node-label="Tray Wrap" className="flex absolute left-0 right-0 bottom-[72px] justify-center">${exp === 'shape' ? shapeTray() : actionsPop()}</div>` : ''}
  ${mode === 'resetdone' ? toast({ kind: 'success', text: K['usage.reset_done'] }) : ''}
  ${exp === 'exportfail' ? toast({ kind: 'error', text: K['export.failed'], action: K['pay.try_again'] }) : ''}
  ${exp === 'offline' ? toast({ kind: 'info', text: K['editor.offline'] }) : ''}
  ${exp === 'done' ? toast({ kind: 'success', text: K['export.downloaded'].replace('{file}', 'Q3 Investor Update.pptx') }) : ''}
</div>
${tab === 'design' ? designPanel() : panel(mode, mode === 'done' && !withPicker && !exp, exp === 'offline')}
${exp === 'menu' ? at('Export Pop Wrap', 'right:8px', 52, exportPop()) : ''}
${exp === 'pptx' || exp === 'pdf' ? exportDialog(exp) : ''}
${exp === 'reset' || exp === 'payfail' ? resetDialog(exp === 'payfail') : ''}
${exp === 'ownlimit' || exp === 'lowbal' || exp === 'ownadded' ? ownLimitDialog(exp === 'lowbal') : ''}
${withPicker ? at('Picker Wrap', 256, 12, picker()) : ''}
</div>`;
const gridScreen = (id, label, state = 'idle') => `<div data-node-id="${id}" data-node-label="${label}" className="flex w-[1470px] h-[923px] [background-color:var(--paper-gray-50)] [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip relative">
${at('Grid Wrap', GL, GT, grid(state))}
${state === 'pasted' ? toast({ kind: 'success', text: K['import.pasted'].replace('{n}', '2'), action: K['common.undo'] }) : ''}
${state === 'hover' ? at('Row Handle Wrap', GL - 26, rowMid(1) - 18, `<div data-node-label="Row Handle" className="w-1.5 h-9 block rounded-full bg-[#a7c5f2]"></div>`) + at('Insert Dot Wrap', gapX(0) - 8, rowMid(1) - 8, `<div data-node-label="Insert Dot" className="flex size-4 justify-center items-center rounded-full [background-color:var(--ad-brand)] text-white"><div data-node-label="Plus" className="size-[10px] block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" width="100%" height="100%"><path d="M12 4v16M4 12h16"/></svg></div></div>`) : ''}
${state === 'hold' ? at('Row Handle Wrap', GL - 26, rowMid(1) - 18, `<div data-node-label="Row Handle" className="w-1.5 h-9 block rounded-full bg-[#a7c5f2]"></div>`) + at('Insert Plus Wrap', gapX(2) - 14, rowMid(1) - 14, `<div data-node-label="Insert Plus" className="flex size-7 justify-center items-center rounded-full [background-color:var(--ad-brand)] text-white"><div data-node-label="Plus" className="size-[14px] block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" width="100%" height="100%"><path d="M12 4v16M4 12h16"/></svg></div></div>`) : ''}
${state === 'added' ? at('Quick Picker Wrap', GL + GW + GG, GT + SEC + 36 + GH + 8, quickPicker()) : ''}
${state === 'section' ? at('Row Handle Wrap', GL - 30, rowMid(2) - 20, `<div data-node-label="Row Grip" className="flex w-4 h-10 flex-col justify-center items-center rounded-full [background-color:var(--ad-brand)] gap-[3px]">${'<div data-node-label="Grip Line" className="w-2 h-[1.5px] block rounded-full bg-white"></div>'.repeat(3)}</div>`)
  + at('End Dot Wrap', GL + 3 * GW + 2 * GG + 8, rowMid(2) - 8, `<div data-node-label="Insert Dot" className="flex size-4 justify-center items-center rounded-full [background-color:var(--ad-brand)] text-white"><div data-node-label="Plus" className="size-[10px] block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" width="100%" height="100%"><path d="M12 4v16M4 12h16"/></svg></div></div>`)
  + at('Below Dot Wrap', GL + GW / 2 - 8, GT + 2 * SEC + 36 + GH + 10, `<div data-node-label="Insert Dot" className="flex size-4 justify-center items-center rounded-full [background-color:var(--ad-brand)] text-white"><div data-node-label="Plus" className="size-[10px] block"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" width="100%" height="100%"><path d="M12 4v16M4 12h16"/></svg></div></div>`)
  + at('Section Bar Wrap', GL + 66, GT + 2 * SEC - 8, `<div data-node-label="Section Bar" className="flex h-9 items-center bg-white rounded-[10px] ${card} px-1 gap-0.5">${['Rename', 'Duplicate', 'Hide'].map(x => `<div data-node-label="Bar Item" className="flex h-7 items-center rounded-[7px] px-2.5">${T('Bar Label', x, `${ink} text-xs font-medium`)}</div>`).join('')}<div data-node-label="Bar Divider" className="w-px h-4 block [background-color:var(--paper-gray-200)] mx-0.5"></div><div data-node-label="Bar Agent" className="flex h-7 items-center rounded-[7px] px-2 gap-1.5"><div data-node-label="Agent Badge" className="flex size-4 justify-center items-center rounded-[5px] [background-color:var(--ad-brand)] text-white"><div data-node-label="Spark" className="size-2.5 block">${SPARK}</div></div>${T('Bar Label', 'Ask agent', `${ink} text-xs font-medium`)}</div></div>`) : ''}
${at('Left Island', 12, 12, island(`<div data-node-label="Mark" className="flex size-8 justify-center items-center"><div data-node-label="Mark Art" className="size-[20px] block">${MARK}</div></div>
  <div data-node-label="Deck Title" className="flex items-center pl-0.5 pr-2 gap-1">${T('Deck Title Text', 'Q3 Investor Update', `${ink} text-[13px] font-medium`)}${ic('chev', 14, sub)}</div>
  <div data-node-label="New Slide Button" className="flex h-7 items-center rounded-[7px] ${btn} pl-1.5 pr-2 gap-1">${ic('plus', 13, ink)}${T('New Slide Label', 'New slide', `${ink} text-xs font-medium`)}</div>
  <div data-node-label="Island Divider" className="w-px h-5 block [background-color:var(--paper-gray-200)] mx-1"></div>
  ${viewToggle('grid')}`))}
${at('Grid Toolbar Wrap', 'left:0px;width:1470px', 855, toolbar('slide'), 'justify-center')}
${at('Right Island', 'right:12px', 12, island(`
  <div data-node-label="Zoom" className="flex h-8 items-center px-2 gap-1">${T('Zoom Value', '36%', `${ink} text-[13px]`)}${ic('chev', 13, sub)}</div>
  <div data-node-label="Export Button" className="flex h-8 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-3">${T('Export Label', 'Export', 'text-white text-[13px] font-medium')}</div>`))}
</div>`;

const impPage = (id, label, body) => `<div data-node-id="${id}" data-node-label="${label}" className="flex w-[1470px] h-[923px] flex-col bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Import Top" className="flex h-14 shrink-0 items-center justify-between px-5">
    <div data-node-label="Mark" className="size-[22px] block">${MARK}</div>
    <div data-node-label="Close Button" className="flex size-8 justify-center items-center rounded-[8px] [color:var(--paper-gray-600)]">${ic('x', 18)}</div>
  </div>
  <div data-node-label="Import Body" className="flex flex-1 justify-center pt-[120px]">
    <div data-node-label="Import Column" className="flex w-[520px] flex-col gap-6">${body}</div>
  </div>
</div>`;
const impHead = (t, sub2) => `<div data-node-label="Import Head" className="flex flex-col gap-1.5">${T('Import Title', t, `${ink} text-[26px] font-semibold tracking-[-0.5px]`)}${T('Import Sub', sub2, `${mut} text-sm`)}</div>`;
const fileRow = inner => `<div data-node-label="File Row" className="flex items-center rounded-[12px] bg-white ${ring} p-3 gap-3">
    <div data-node-label="File Tile" className="flex w-10 h-10 shrink-0 justify-center items-center rounded-[8px] [background-color:var(--paper-gray-100)]">${T('File Ext', 'PPTX', `${mut} text-[10px] font-semibold`)}</div>
    <div data-node-label="File Text" className="flex flex-1 flex-col gap-0.5">${T('File Name', 'Brightwater board review.pptx', `${ink} text-sm font-medium`)}${inner}</div>
  </div>`;
const primary = (t) => `<div data-node-label="Primary Button" className="flex h-9 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-4">${T('Primary Label', t, 'text-white text-sm font-medium')}</div>`;
const secondary = (t) => `<div data-node-label="Secondary Button" className="flex h-9 items-center rounded-[8px] ${btn} px-4">${T('Secondary Label', t, `${ink} text-sm font-medium`)}</div>`;
const imp1 = impPage('ed10', 'S07.02 Import, choose file', `${impHead('Import a deck', 'PowerPoint or PDF. Every slide stays editable.')}
  <div data-node-label="Drop Zone" className="flex h-[240px] flex-col justify-center items-center rounded-[14px] [background-color:var(--paper-gray-50)] border-2 border-dashed [border-color:var(--paper-gray-300)] gap-4">
    <div data-node-label="Upload Tile" className="flex size-11 justify-center items-center rounded-full bg-white ${ring} [color:var(--paper-gray-600)]">${ic('upload', 20)}</div>
    <div data-node-label="Drop Text" className="flex flex-col items-center gap-1">${T('Drop Title', 'Drop a file here', `${ink} text-sm font-medium`)}${T('Drop Sub', 'PPTX or PDF, up to 200 MB', `${sub} text-[13px]`)}</div>
    ${secondary('Choose file')}
  </div>`);
const imp2 = `<div data-node-id="ed11" data-node-label="S07.02 Import, loading" className="flex w-[1470px] h-[923px] flex-col justify-center items-center bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Loading Column" className="flex w-[360px] flex-col items-center gap-5">
    <div data-node-label="File Tile" className="flex w-12 h-12 justify-center items-center rounded-[10px] [background-color:var(--paper-gray-100)]">${T('File Ext', 'PPTX', `${mut} text-[11px] font-semibold`)}</div>
    <div data-node-label="Loading Text" className="flex flex-col items-center gap-1">${T('Loading Title', 'Importing Brightwater board review', `${ink} text-[15px] font-medium`)}${T('Loading Sub', 'Reading slide 14 of 24', `${sub} text-[13px]`)}</div>
    <div data-node-label="Progress Track" className="flex w-full h-1 rounded-full [background-color:var(--paper-gray-100)]"><div data-node-label="Progress Fill" className="w-[58%] h-1 block rounded-full [background-color:var(--ad-brand)]"></div></div>
  </div>
</div>`;
const note = (k, title, sub2, link) => `<div data-node-label="Note Row" className="flex items-start py-3 gap-3 border-b [border-bottom-color:var(--paper-gray-100)]">
    <div data-node-label="Note Icon" className="flex size-5 shrink-0 justify-center items-center pt-0.5 [color:var(--paper-gray-500)]">${ic(k, 16)}</div>
    <div data-node-label="Note Text" className="flex flex-1 flex-col gap-0.5">${T('Note Title', title, `${ink} text-sm`)}${T('Note Sub', sub2, `${sub} text-[13px]`)}</div>
    ${link ? T('Note Link', link, '[color:var(--paper-blue-link)] text-[13px] font-medium') : ''}
  </div>`;
const imp3 = `<div data-node-id="ed12" data-node-label="S07.03 Import, ready" className="flex w-[1470px] h-[923px] flex-col justify-center items-center bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Ready Column" className="flex w-[320px] flex-col items-center gap-5">
    <div data-node-label="Ready Mark" className="size-[44px] block">${MARK}</div>
    <div data-node-label="Ready Text" className="flex flex-col items-center gap-1">${T('Ready Title', 'Deck is ready', `${ink} text-[15px] font-medium`)}</div>
    ${primary('Open deck')}
  </div>
</div>`;
fs.writeFileSync('/tmp/strat/ed/ed10.jsx', imp1);
fs.writeFileSync('/tmp/strat/ed/ed11.jsx', imp2);
fs.writeFileSync('/tmp/strat/ed/ed12.jsx', imp3);
const fix = x => x.replace(/style=\{\{(.*?)\}\}/g, (m, b) => 'style="' + b.split(/,(?=[a-zA-Z]+:)/).map(p => { const [k, ...v] = p.split(':'); return k.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':' + v.join(':').replace(/^'|'$/g, ''); }).join(';') + '"');
fs.writeFileSync('/tmp/strat/ed/ed3.jsx', fix(gridScreen('ed3', 'S41.01 Editor / Grid / Default')));
fs.writeFileSync('/tmp/strat/ed/ed5.jsx', fix(gridScreen('ed5', 'S41.02 Editor / Grid / Add slide, hover', 'hover')));
fs.writeFileSync('/tmp/strat/ed/ed6.jsx', fix(gridScreen('ed6', 'S41.03 Editor / Grid / Add slide, hold', 'hold')));
fs.writeFileSync('/tmp/strat/ed/ed1.jsx', fix(slideScreen('ed1', 'S42.01 Editor / Agent / Working', 'working', false)));
fs.writeFileSync('/tmp/strat/ed/ed2.jsx', fix(slideScreen('ed2', 'S42.02 Editor / Agent / Run complete', 'done', false)));
fs.writeFileSync('/tmp/strat/ed/ed9.jsx', fix(slideScreen('ed9', 'S43.02 Editor / Tools / Design panel', 'idle', false, 'design')));
fs.writeFileSync('/tmp/strat/ed/ed4.jsx', fix(slideScreen('ed4', 'S43.01 Editor / Tools / Template picker', 'done', true)));
fs.writeFileSync('/tmp/strat/ed/ed13.jsx', fix(gridScreen('ed13', 'S41.04 Editor / Grid / Slides pasted', 'pasted')));
fs.writeFileSync('/tmp/strat/ed/ed14.jsx', fix(slideScreen('ed14', 'S61.01 Export / Export / PowerPoint options', 'done', false, 'agent', 'pptx')));
fs.writeFileSync('/tmp/strat/ed/ed15.jsx', fix(slideScreen('ed15', 'S61.03 Export / Export / Downloaded, toast', 'done', false, 'agent', 'done')));
fs.writeFileSync('/tmp/strat/ed/ed16.jsx', fix(slideScreen('ed16', 'S61.02 Export / Export / PDF options', 'done', false, 'agent', 'pdf')));
const CLAUDE = "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"100%\" height=\"100%\"><path d=\"m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z\"></path></svg>";
const conPage = (id, label, body, tile = `<div data-node-label="Claude Tile" className="flex size-12 justify-center items-center rounded-[12px] bg-[#d97757] text-white"><div data-node-label="Claude Logo" className="size-[26px] block">${CLAUDE}</div></div>`) => `<div data-node-id="${id}" data-node-label="${label}" className="flex w-[1470px] h-[923px] flex-col justify-center items-center bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Connect Column" className="flex w-[360px] flex-col items-center gap-6">
    <div data-node-label="Logo Pair" className="flex items-center gap-3">
      <div data-node-label="AirDesign Tile" className="flex size-12 justify-center items-center rounded-[12px] bg-white ${ring}"><div data-node-label="Mark" className="size-[28px] block">${MARK}</div></div>
      <div data-node-label="Link Dots" className="flex items-center gap-1">${'<div data-node-label="Dot" className="size-1 block rounded-full [background-color:var(--paper-gray-300)]"></div>'.repeat(3)}</div>
      ${tile}
    </div>
    ${body}
  </div>
</div>`;
const perm = t => `<div data-node-label="Perm Row" className="flex items-center gap-2.5">${ic('check', 14, sub)}${T('Perm Text', t, `${ink} text-[13px]`)}</div>`;
const consent = (id, label, who, back, tile) => conPage(id, label, `
    <div data-node-label="Connect Text" className="flex flex-col items-center gap-1.5">${T('Connect Title', `${who} wants to use AirDesign`, `${ink} text-xl font-semibold tracking-[-0.3px]`)}${T('Connect Sub', 'It can work on your decks for you.', `${sub} text-[13px]`)}</div>
    <div data-node-label="Account Row" className="flex w-full items-center rounded-[12px] ${ring} p-3 gap-3">
      <div data-node-label="Avatar" className="flex size-8 shrink-0 justify-center items-center rounded-full [background-color:var(--deck-navy)]">${T('Avatar Initials', 'AL', 'text-white text-xs font-semibold')}</div>
      <div data-node-label="Account Text" className="flex flex-1 min-w-0 flex-col">${T('Account Name', 'Ada Lovelace', `${ink} text-[13px] font-medium truncate`)}${T('Account Email', 'ada@halden.com', `${sub} text-xs truncate`)}</div>
      ${T('Switch Link', 'Switch', `[color:var(--paper-blue-link)] text-[13px] font-medium`)}
    </div>
    <div data-node-label="Perm List" className="flex w-full flex-col px-1 gap-2.5">
      ${T('Perm Head', `${who} will be able to`, `${mut} text-xs font-medium`)}
      ${perm('Read and edit all your decks')}${perm('Use your brand and files')}${perm('Import and export PowerPoint')}
    </div>
    <div data-node-label="Connect Actions" className="flex w-full gap-2">
      <div data-node-label="Cancel Button" className="flex flex-1 h-10 justify-center items-center rounded-[9px] ${btn}">${T('Cancel Label', 'Cancel', `${ink} text-sm font-medium`)}</div>
      <div data-node-label="Allow Button" className="flex flex-1 h-10 justify-center items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[9px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f]">${T('Allow Label', 'Allow', 'text-white text-sm font-medium')}</div>
    </div>
    ${T('Fine Print', `${back} ${who} uses your weekly usage. Disconnect anytime in Settings.`, `${sub} text-xs text-center leading-[1.5]`)}`, tile);
const con1 = consent('ed17', 'S71.01 Agents / Connect / Approve Claude', 'Claude', 'You will return to claude.ai.');
const con2 = conPage('ed18', 'S71.02 Agents / Connect / Claude connected', `
    <div data-node-label="Connect Text" className="flex flex-col items-center gap-1.5">${T('Connect Title', 'Connected', `${ink} text-xl font-semibold tracking-[-0.3px]`)}${T('Connect Sub', 'Taking you back to Claude', `${sub} text-[13px]`)}</div>`);
fs.writeFileSync('/tmp/strat/ed/ed17.jsx', con1);
fs.writeFileSync('/tmp/strat/ed/ed18.jsx', con2);
const OPENAI = "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"100%\" height=\"100%\"><path d=\"M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z\"></path></svg>";
const oTile = `<div data-node-label="OpenAI Tile" className="flex size-12 justify-center items-center rounded-[12px] [background-color:var(--paper-gray-950)] text-white"><div data-node-label="OpenAI Logo" className="size-[24px] block">${OPENAI}</div></div>`;
fs.writeFileSync('/tmp/strat/ed/ed20.jsx', consent('ed20', 'S71.03 Agents / Connect / Approve Codex', 'Codex', 'You will return to Codex on this computer.', oTile));
const prCard = (label, price, unit, lines, cta, primaryCta) => `<div data-node-label="Price Card" className="flex flex-1 flex-col rounded-[16px] bg-white ${ring} p-6 gap-5">
    <div data-node-label="Card Head" className="flex flex-col gap-3">${T('Card Label', label, `${mut} text-[13px] font-medium`)}<div data-node-label="Price Row" className="flex items-baseline gap-1.5">${T('Price', price, `${ink} text-[40px] font-semibold tracking-[-1px]`)}${T('Price Unit', unit, `${sub} text-sm`)}</div></div>
    <div data-node-label="Card Lines" className="flex flex-col gap-2.5">${lines.map(l => `<div data-node-label="Card Line" className="flex items-start gap-2.5"><div data-node-label="Line Icon" className="flex h-5 items-center">${ic('check', 14, sub)}</div>${T('Line Text', l, `${ink} text-[13px] leading-[1.5]`)}</div>`).join('')}</div>
    <div data-node-label="Card Space" className="flex-1 block"></div>
    ${primaryCta ? `<div data-node-label="Card Button" className="flex h-10 justify-center items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[9px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f]">${T('Card Button Label', cta, 'text-white text-sm font-medium')}</div>` : `<div data-node-label="Card Button" className="flex h-10 justify-center items-center rounded-[9px] ${btn}">${T('Card Button Label', cta, `${ink} text-sm font-medium`)}</div>`}
  </div>`;
const pricing = `<div data-node-id="ed21" data-node-label="S01.02 Pricing, free usage" className="flex w-[1470px] h-[923px] flex-col items-center bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Site Nav" className="flex w-full h-16 shrink-0 items-center justify-between px-8">
    <div data-node-label="Brand" className="flex items-center gap-2"><div data-node-label="Mark" className="size-[22px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[15px] font-semibold`)}</div>
    <div data-node-label="Nav Right" className="flex items-center gap-6">${T('Nav Pricing', 'Pricing', `${ink} text-[13px] font-medium`)}${T('Nav Sign In', 'Sign in', `${mut} text-[13px]`)}<div data-node-label="Nav Start" className="flex h-8 items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[8px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f] px-3">${T('Nav Start Label', 'Start free', 'text-white text-[13px] font-medium')}</div></div>
  </div>
  <div data-node-label="Pricing Hero" className="flex flex-col items-center pt-[80px] gap-3">${T('Pricing Title', 'AirDesign is free', `${ink} text-[52px] font-semibold tracking-[-1.5px]`)}${T('Pricing Sub', 'Every feature, every week. No plan, no trial.', `${mut} text-lg`)}</div>
  <div data-node-label="Free Card" className="flex w-[440px] flex-col rounded-[18px] bg-white ${ring} shadow-[0px_12px_40px_#0000000d] mt-12 p-7 gap-6">
    <div data-node-label="Price Row" className="flex items-end gap-2">${T('Price', '$0', `${ink} text-[56px] font-semibold tracking-[-1.5px] leading-[1]`)}${T('Price Unit', 'forever', `${sub} text-base pb-1.5`)}</div>
    <div data-node-label="Card Lines" className="flex flex-col gap-3">${['Unlimited decks', 'Aira built in', 'Bring Claude or Codex', 'PowerPoint import and export', 'Usage resets every week'].map(l => `<div data-node-label="Card Line" className="flex items-center gap-2.5">${ic('check', 15, '[color:var(--ad-brand)]')}${T('Line Text', l, `${ink} text-sm`)}</div>`).join('')}</div>
    <div data-node-label="Card Button" className="flex h-11 justify-center items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[10px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f]">${T('Card Button Label', 'Start free', 'text-white text-[15px] font-medium')}</div>
  </div>
  <div data-node-label="Wait Note" className="flex items-center pt-8">${T('Wait Text', "Don't want to wait for the weekly reset? You can pay to reset.", `${sub} text-[13px]`)}</div>
</div>`;
fs.writeFileSync('/tmp/strat/ed/ed21.jsx', pricing);
fs.writeFileSync('/tmp/strat/ed/ed22.jsx', fix(slideScreen('ed22', 'S92.01 Credits / Out of usage / Limit reached', 'limit', false, 'agent', '')));
fs.writeFileSync('/tmp/strat/ed/ed23.jsx', fix(slideScreen('ed23', 'S92.03 Credits / Out of usage / Add credits first', 'limit', false, 'agent', '')));
fs.writeFileSync('/tmp/strat/ed/ed24.jsx', fix(slideScreen('ed24', 'S49.01 Editor / Errors / Agent run failed', 'runfail', false)));
fs.writeFileSync('/tmp/strat/ed/ed26.jsx', fix(slideScreen('ed26', 'S69.01 Export / Errors / Export failed', 'done', false, 'agent', 'exportfail')));
fs.writeFileSync('/tmp/strat/ed/ed27.jsx', fix(slideScreen('ed27', 'S49.02 Editor / Errors / Offline', 'done', false, 'agent', 'offline')));
fs.writeFileSync('/tmp/strat/ed/ed28.jsx', errPage('ed28', 'S29.01 Access / Errors / Link expired', 'This link has expired', 'Sign-in links work once and last 15 minutes.', 'Send a new link'));
fs.writeFileSync('/tmp/strat/ed/ed30.jsx', fix(slideScreen('ed30', 'S43.03 Editor / Tools / Images', 'done', false, 'agent', 'image')));
fs.writeFileSync('/tmp/strat/ed/ed31.jsx', fix(slideScreen('ed31', 'S43.04 Editor / Tools / Shapes', 'done', false, 'agent', 'shape')));
fs.writeFileSync('/tmp/strat/ed/ed32.jsx', fix(slideScreen('ed32', 'S43.05 Editor / Tools / Shapes, expanded', 'done', false, 'agent', 'shapes')));
fs.writeFileSync('/tmp/strat/ed/ed33.jsx', fix(slideScreen('ed33', 'S43.06 Editor / Tools / Text', 'done', false, 'agent', 'text')));
fs.writeFileSync('/tmp/strat/ed/ed34.jsx', fix(slideScreen('ed34', 'S43.07 Editor / Tools / Actions', 'done', false, 'agent', 'actions')));
const qrSvg = (() => {
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const N = 25, c = 6; let r = '';
  const finder = (x, y) => `<rect x="${x*c}" y="${y*c}" width="${7*c}" height="${7*c}" fill="#111"/><rect x="${(x+1)*c}" y="${(y+1)*c}" width="${5*c}" height="${5*c}" fill="#fff"/><rect x="${(x+2)*c}" y="${(y+2)*c}" width="${3*c}" height="${3*c}" fill="#111"/>`;
  const inF = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inF(x, y) && rnd() > 0.52) r += `<rect x="${x*c}" y="${y*c}" width="${c}" height="${c}" fill="#111"/>`;
  return `<svg viewBox="0 0 ${N*c} ${N*c}" width="100%" height="100%"><rect width="${N*c}" height="${N*c}" fill="#fff"/>${r}${finder(0,0)}${finder(N-7,0)}${finder(0,N-7)}</svg>`;
})();
const dlgHead = t => `<div data-node-label="Dialog Head" className="flex items-center justify-between">${T('Dialog Title', t, `${ink} text-lg font-semibold`)}<div data-node-label="Close Button" className="flex size-8 justify-center items-center rounded-[8px] [color:var(--paper-gray-600)]">${ic('x', 16)}</div></div>`;
const detail = (k, v, copy) => `<div data-node-label="Detail Row" className="flex h-8 items-center justify-between">${T('Detail Key', k, `${mut} text-[13px]`)}<div data-node-label="Detail Val" className="flex items-center gap-2">${T('Detail Value', v, `${ink} text-[13px] font-medium`)}${copy ? T('Copy Link', 'Copy', '[color:var(--paper-blue-link)] text-xs font-medium') : ''}</div></div>`;
const qrWait = `<div data-node-id="qr1" data-node-label="QR Dialog Waiting" className="flex w-[420px] flex-col bg-white rounded-[18px] shadow-[0px_24px_64px_#00000040] p-6 gap-5 [font-family:var(--ad-font)]">
  ${dlgHead('Pay with bank QR')}
  <div data-node-label="QR Block" className="flex items-center rounded-[14px] [background-color:var(--paper-gray-50)] p-4 gap-4">
    <div data-node-label="QR Code" className="size-[132px] shrink-0 block rounded-[8px] bg-white p-1.5">${qrSvg}</div>
    <div data-node-label="QR Amount" className="flex flex-col gap-1">${T('Pay VND', '625,000 VND', `${ink} text-[22px] font-semibold tracking-[-0.4px]`)}${T('Pay USD', 'for $25.00 in credits', `${mut} text-[13px]`)}${T('Pay Rate', '25,000 VND per $1', `${sub} text-xs`)}</div>
  </div>
  <div data-node-label="Details" className="flex flex-col">${detail('Bank', 'MB Bank')}${detail('Account name', 'AIRDESIGN JSC')}${detail('Account number', '9620 4471 8836', true)}${detail('Transfer content', 'AD7Q4K', true)}</div>
  <div data-node-label="Status Row" className="flex items-center justify-between rounded-[10px] [background-color:#eef4fe] px-3.5 py-3">
    <div data-node-label="Status Left" className="flex items-center gap-2.5"><div data-node-label="Spinner" className="size-4 block"><svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#c9dcf9" strokeWidth="2.5"></circle><path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="#4D94FB" strokeWidth="2.5" strokeLinecap="round"></path></svg></div>${T('Status Text', 'Waiting for your bank', `[color:var(--paper-blue-link)] text-[13px] font-medium`)}</div>
    ${T('Expires', 'Expires in 14:32', `${mut} text-xs`)}
  </div>
  ${T('QR Note', 'Scan with any banking app. Keep the amount and transfer content as they are. Credits land a few seconds after you pay.', `${sub} text-xs leading-[1.5]`)}
</div>`;
const center = (id, label, icon, iconCls, title, sub2, buttons) => `<div data-node-id="${id}" data-node-label="${label}" className="flex w-[420px] flex-col items-center bg-white rounded-[18px] shadow-[0px_24px_64px_#00000040] px-6 pt-8 pb-6 gap-5 [font-family:var(--ad-font)]">
  <div data-node-label="Result Icon" className="flex size-12 justify-center items-center rounded-full ${iconCls}">${ic(icon, 24)}</div>
  <div data-node-label="Result Text" className="flex flex-col items-center gap-1.5">${T('Result Title', title, `${ink} text-lg font-semibold`)}${T('Result Sub', sub2, `${mut} text-[13px] text-center leading-[1.5]`)}</div>
  <div data-node-label="Result Actions" className="flex w-full gap-2">${buttons}</div>
</div>`;
const fullBtn = (t, p) => p ? `<div data-node-label="Primary Button" className="flex flex-1 h-10 justify-center items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[9px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_1px_2px_#0000001f]">${T('Primary Label', t, 'text-white text-sm font-medium')}</div>` : `<div data-node-label="Secondary Button" className="flex flex-1 h-10 justify-center items-center rounded-[9px] ${btn}">${T('Secondary Label', t, `${ink} text-sm font-medium`)}</div>`;
const qrPaid = center('qr2', 'QR Dialog Paid', 'check', 'bg-[#e6f4ea] text-[#1e7d3c]', 'Payment received', '$25.00 added. Credit balance is now $40.00.', fullBtn('Done', true));
const qrExpired = center('qr3', 'QR Dialog Expired', 'alert', '[background-color:var(--paper-gray-100)] [color:var(--paper-gray-600)]', 'This QR has expired', 'Already paid? Your credits still land, usually within a few minutes.', fullBtn('Close', false) + fullBtn('New QR', true));
fs.writeFileSync('/tmp/strat/ed/qr1.jsx', qrWait);
fs.writeFileSync('/tmp/strat/ed/qr2.jsx', qrPaid);
fs.writeFileSync('/tmp/strat/ed/qr3.jsx', qrExpired);
fs.writeFileSync('/tmp/strat/ed/ed38.jsx', fix(slideScreen('ed38', 'S42.04 Editor / Agent / Long message', 'compose', false)));
fs.writeFileSync('/tmp/strat/ed/ed35.jsx', fix(slideScreen('ed35', 'S42.03 Editor / Agent / Own agent editing', 'own', false)));
fs.writeFileSync('/tmp/strat/ed/ed36.jsx', fix(slideScreen('ed36', 'S92.04 Credits / Out of usage / Reset complete', 'resetdone', false)));

// ---------- Landing page (S11.01) ----------
const LW = 1440;
const lBtn = (t, kind = 'primary', ext = false, h = 44) => kind === 'primary'
  ? `<div data-node-label="Primary Button" className="flex h-[${h}px] items-center [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] rounded-[10px] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong),0px_2px_6px_#2d6fcd33] px-5 gap-2">${T('Primary Label', t, 'text-white text-[15px] font-medium')}</div>`
  : `<div data-node-label="Secondary Button" className="flex h-[${h}px] items-center rounded-[10px] ${btn} px-5 gap-2">${T('Secondary Label', t, `${ink} text-[15px] font-medium`)}</div>`;
const tileG = (inner, sz = 40, r = 12) => `<div data-node-label="Icon Tile" className="flex size-[${sz}px] shrink-0 justify-center items-center rounded-[${r}px] [background-image:linear-gradient(180deg,#93B8EF_0%,#4D94FB_100%)] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_#2D6FCD,0px_2px_6px_#2d6fcd2e] text-white">${inner}</div>`;
const lEyebrow = (t) => T('Section Eyebrow', t, '[color:var(--paper-blue-link)] text-[13px] font-semibold tracking-[0.2px]');
const lH2 = (t) => T('Section Title', t, `${ink} text-[44px] font-semibold leading-[1.1] tracking-[-1.2px]`);
const lLead = (t, w = 560) => `<span data-node-label="Section Lead" className="${F} block w-[${w}px] ${mut} text-[17px] leading-[1.55]">${t}</span>`;
const lSlide = ({ w = 640, kicker = 'REVENUE', title, body = '', source, glow = false, selTitle = false, was = '', annot = false, selChart = false, srcPx = 0, kPx = 0 }) => {
  const s = w / 640;
  const bars = BARS.map(([q, v], j) => `<div data-node-label="Bar Column" className="flex flex-1 flex-col justify-end items-center gap-1">${T('Bar Value', '$' + v + 'M', `[color:var(--deck-navy)] text-[${Math.round(11 * s)}px] font-semibold`)}<div data-node-label="Bar" className="w-[${Math.round(44 * s)}px] block" style={{height:'${Math.round(v / 5.7 * 120 * s)}px',backgroundColor:'${j === 4 ? 'var(--deck-teal)' : 'var(--deck-mist)'}'}}></div>${T('Bar Label', q, `${mut} text-[${Math.round(10 * s)}px]`)}</div>`).join('');
  const titleEl = `<div data-node-label="Slide Title Wrap" className="flex flex-col relative ${selTitle ? 'shadow-[0px_0px_0px_1px_#4D94FB]' : ''}">${was ? `<div data-node-label="Was Tag" className="flex absolute left-0 top-[-30px] h-6 items-center rounded-[6px] bg-white shadow-[0px_0px_0px_1px_#EAEAE7,0px_2px_6px_#0000000f] px-2 gap-1.5">${T('Was Label', 'Was', `${sub} text-[11px] font-medium`)}<div data-node-label="Was Struck" className="flex relative">${T('Was Text', was, `${mut} text-[11px]`)}<div data-node-label="Strike" className="flex absolute left-0 top-[7px] w-full h-px [background-color:var(--paper-gray-500)]"></div></div></div>` : ''}${T('Slide Headline', title, `[color:var(--deck-navy)] text-[${Math.round(24 * s)}px] font-semibold leading-[1.15] tracking-[-0.4px]`)}</div>`;
  const slideEl = `<div data-node-label="Landing Slide" className="flex w-[${w}px] h-[${Math.round(w * 9 / 16)}px] shrink-0 flex-col bg-white rounded-[${glow ? 4 : 3}px] ${glow ? '' : 'shadow-[0px_0px_0px_1px_#0000000f,0px_8px_24px_#0000000d]'} gap-[${Math.round(8 * s)}px]" style={{padding:'${Math.round(30 * s)}px ${Math.round(36 * s)}px'}}>
      ${T('Slide Kicker', kicker, `[color:var(--deck-teal)] text-[${kPx || Math.round(9 * s)}px] font-semibold tracking-[1px]`)}${titleEl}
      ${body ? body : `<div data-node-label="Chart" className="flex flex-1 items-end gap-[${Math.round(18 * s)}px] pt-2 ${selChart ? 'relative border border-[#4D94FB] rounded-none px-2' : ''}">${bars}${selChart ? handlesAbs : ''}</div>`}
      ${T('Slide Source', source, `${sub} text-[${srcPx || Math.round(8 * s)}px]`)}</div>`;
  return glow ? `<div data-node-label="Working Glow" className="flex shrink-0 p-[2px] rounded-[6px] [background-image:linear-gradient(135deg,#4D94FB_0%,#A9C8FF_35%,#B9A8FF_65%,#4D94FB_100%)] shadow-[0px_0px_32px_#4d94fb59,-20px_-14px_64px_#93b8ef47,20px_16px_64px_#b39dff47]">${slideEl}</div>` : slideEl;
};
const rowsBody = (rows, s = 1) => `<div data-node-label="Workstreams" className="flex flex-1 flex-col justify-center gap-[${Math.round(8 * s)}px]">${rows.map(([a, b]) => `<div data-node-label="Workstream" className="flex items-center rounded-[3px] [background-color:#EEF3F8] gap-3" style={{padding:'${Math.round(9 * s)}px ${Math.round(12 * s)}px'}}>${T('Row Label', a, `[color:var(--deck-navy)] text-[${Math.round(11 * s)}px] font-semibold w-[${Math.round(90 * s)}px]`)}${T('Row Text', b, `[color:var(--deck-navy)] text-[${Math.round(11 * s)}px]`)}</div>`).join('')}</div>`;
const segBody = (s = 1) => `<div data-node-label="Segments" className="flex flex-1 flex-col justify-center gap-[${Math.round(12 * s)}px]">${[['Enterprise', 66, 'var(--deck-teal)'], ['Mid-market', 22, 'var(--deck-mist)'], ['Self-serve', 12, 'var(--deck-mist)']].map(([a, v, c]) => `<div data-node-label="Segment Row" className="flex items-center gap-3">${T('Segment Label', a, `[color:var(--deck-navy)] text-[${Math.round(11 * s)}px] font-semibold w-[${Math.round(84 * s)}px]`)}<div data-node-label="Segment Bar" className="block h-[${Math.round(22 * s)}px]" style={{width:'${Math.round(v * 4.2 * s)}px',backgroundColor:'${c}'}}></div>${T('Segment Value', v + '% of growth', `[color:var(--deck-navy)] text-[${Math.round(11 * s)}px] font-semibold`)}</div>`).join('')}</div>`;
const decisionBody = (s = 1) => `<div data-node-label="Decision" className="flex flex-1 items-stretch gap-[${Math.round(14 * s)}px] pt-2">${[['Decision', 'Keep the current growth plan.', 'Approve the Q4 budget as proposed.'], ['Next review', 'Hiring case in Q1.', 'Bring two options and their payback.']].map(([h, a, b]) => `<div data-node-label="Decision Column" className="flex flex-1 flex-col rounded-[3px] [background-color:#EEF3F8] gap-[${Math.round(6 * s)}px]" style={{padding:'${Math.round(14 * s)}px'}}>${T('Decision Head', h, `[color:var(--deck-teal)] text-[${Math.round(9 * s)}px] font-semibold tracking-[1px]`)}${T('Decision Main', a, `[color:var(--deck-navy)] text-[${Math.round(14 * s)}px] font-semibold`)}${T('Decision Body', b, `[color:var(--deck-navy)] text-[${Math.round(11 * s)}px]`)}</div>`).join('')}</div>`;
const step = (state, t) => `<div data-node-label="Activity Step" className="flex items-center gap-2.5">${state === 'done' ? `<div data-node-label="Step Done" className="flex size-4 shrink-0 justify-center items-center rounded-full [background-color:var(--paper-gray-100)] [color:var(--paper-gray-600)]">${ic('check', 10)}</div>` : `<div data-node-label="Step Now" className="flex size-4 shrink-0 justify-center items-center rounded-full bg-[#EEF4FE] [color:var(--ad-brand)]"><div data-node-label="Spark" className="size-[11px] block">${SPARK}</div></div>`}${T('Step Text', t, `${state === 'done' ? mut : ink + ' font-medium'} text-[13px]`)}</div>`;
const heroFrame = `<div data-node-label="Product Frame" className="flex w-[1200px] flex-col rounded-[16px] bg-white shadow-[0px_0px_0px_1px_#0000000f,0px_24px_64px_#0000001a,0px_2px_6px_#0000000a] overflow-clip">
    <div data-node-label="Frame Bar" className="flex h-11 items-center border-b [border-bottom-color:var(--paper-gray-100)] px-4 gap-3">
      <div data-node-label="Mark" className="size-[18px] block">${MARK}</div>${T('Frame Deck', 'Halden quarterly review', `${ink} text-[13px] font-medium`)}<div data-node-label="Grow" className="flex-1 block"></div>
      <div data-node-label="Frame Export" className="flex h-7 items-center rounded-[7px] [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong)] px-3">${T('Export Label', 'Export', 'text-white text-xs font-medium')}</div>
    </div>
    <div data-node-label="Frame Body" className="flex h-[520px]">
      <div data-node-label="Frame Canvas" className="flex flex-1 justify-center items-center [background-color:var(--paper-gray-50)] pt-6">${lSlide({ w: 720, title: 'Revenue grew 39% year over year', source: 'Source: Q3 board notes, unaudited. Halden example, sample data.', glow: true, selTitle: true, was: 'Revenue' })}</div>
      <div data-node-label="Frame Panel" className="flex w-[300px] flex-col border-l [border-left-color:var(--paper-gray-100)] p-4 gap-4">
        <div data-node-label="Panel Head" className="flex items-center gap-2"><div data-node-label="Spark" className="size-[14px] block [color:var(--ad-brand)]">${SPARK}</div>${T('Panel Title', 'Aira', `${ink} text-[13px] font-semibold`)}</div>
        <div data-node-label="Person Bubble" className="flex self-end [background-color:var(--paper-gray-100)] rounded-[12px] px-3 py-2.5">${T('Person Text', 'Turn the Q3 notes into a board recommendation.', `${ink} text-[13px] leading-[1.5] w-[220px]`)}</div>
        <div data-node-label="Activity" className="flex flex-col gap-2.5">${step('done', 'Read Q3 board notes')}${step('done', 'Framed the recommendation')}${step('now', 'Writing action titles, slide 3')}</div>
        <div data-node-label="Grow" className="flex-1 block"></div>
        <div data-node-label="Composer" className="flex h-11 items-center rounded-[12px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] px-3 gap-2"><div data-node-label="Context Chip" className="flex h-6 items-center rounded-[6px] [background-color:var(--paper-gray-100)] px-2">${T('Chip Label', 'Slide 3', `${mut} text-xs`)}</div>${T('Composer Placeholder', 'Add to the request', `${sub} text-[13px]`)}</div>
      </div>
    </div>
  </div>`;
const keptItem = (t) => `<div data-node-label="Kept Item" className="flex items-center gap-2.5">${tileG(ic('check', 13), 22, 7)}${T('Kept Text', t, `${ink} text-[15px]`)}</div>`;
const BW_ROWS = [['Product', 'Complete launch checks'], ['Sales', 'Finish account briefings'], ['Operations', 'Confirm support coverage']];
const annotDot = (n) => `<div data-node-label="Annotation" className="flex size-7 shrink-0 justify-center items-center rounded-full [background-color:var(--paper-gray-900)] shadow-[0px_0px_0px_3px_#ffffff]">${T('Annotation Number', String(n), 'text-white text-[13px] font-semibold')}</div>`;
const noteRow = (n, t, b) => `<div data-node-label="Review Note" className="flex items-start gap-4 py-5 border-b [border-bottom-color:var(--paper-gray-200)]">${annotDot(n)}<div data-node-label="Note Text" className="flex flex-col gap-1">${T('Note Title', t, `${ink} text-[17px] font-semibold`)}${T('Note Body', b, `${mut} text-[15px] leading-[1.5]`)}</div></div>`;
const spine = [['1', 'Keep the current growth plan', false], ['2', 'Revenue grew 39% year over year', false], ['3', 'Enterprise deals drove two thirds of the growth', true], ['4', 'Hiring can wait one quarter', false], ['5', 'Approve the plan and review hiring in Q1', false]];
const agentCard = (tile, name, line) => `<div data-node-label="Agent Card" className="flex flex-1 flex-col rounded-[16px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_2px_8px_#0000000a] p-6 gap-4">${tile}<div data-node-label="Agent Text" className="flex flex-col gap-1.5">${T('Agent Name', name, `${ink} text-[18px] font-semibold`)}${T('Agent Line', line, `${mut} text-[15px] leading-[1.5]`)}</div></div>`;
const airaTile = `<div data-node-label="Aira Tile" className="flex size-11 justify-center items-center rounded-[12px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] [color:var(--ad-brand)]"><div data-node-label="Aira Logo" className="size-[22px] block">${SPARK}</div></div>`;
const claudeTile = `<div data-node-label="Claude Tile" className="flex size-11 justify-center items-center rounded-[12px] bg-[#d97757] text-white"><div data-node-label="Claude Logo" className="size-[22px] block">${CLAUDE}</div></div>`;
const codexTile = `<div data-node-label="Codex Tile" className="flex size-11 justify-center items-center rounded-[12px] [background-color:var(--paper-gray-950)] text-white"><div data-node-label="OpenAI Logo" className="size-[22px] block">${OPENAI}</div></div>`;
const section = (label, inner, extra = '') => `<div data-node-label="${label}" className="flex w-full flex-col items-center px-[120px] py-[112px] ${extra}">${inner}</div>`;
const landing = `<div data-node-id="ed39" data-node-label="S11.01 Discover / Landing / Default" className="flex w-[${LW}px] flex-col bg-[#FCFCF9] [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal]">
  <div data-node-label="Nav" className="flex h-[72px] items-center justify-between px-[120px]">
    <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[24px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[17px] font-semibold tracking-[-0.3px]`)}</div>
    <div data-node-label="Nav Links" className="flex items-center gap-8">${['The standard', 'Import', 'Agents', 'Pricing'].map(x => T('Nav Link', x, `${mut} text-[14px]`)).join('')}</div>
    <div data-node-label="Nav Actions" className="flex items-center gap-5">${T('Nav Sign In', 'Sign in', `${ink} text-[14px] font-medium`)}${lBtn('Start free', 'primary', false, 38)}</div>
  </div>
  <div data-node-label="Hero" className="flex w-full flex-col items-center pt-[88px] pb-[120px] gap-14 [background-image:linear-gradient(180deg,#FCFCF9_0%,#F5F5F2_100%)]">
    <div data-node-label="Hero Text" className="flex flex-col items-center gap-6">
      <div data-node-label="Hero Badge" className="flex h-8 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] pl-1.5 pr-3.5 gap-2"><div data-node-label="Badge Spark" className="flex size-5 justify-center items-center rounded-full bg-[#EEF4FE] [color:var(--ad-brand)]"><div data-node-label="Spark" className="size-[11px] block">${SPARK}</div></div>${T('Badge Text', 'Meet Aira, the agent that frames before it designs', `${mut} text-[13px]`)}</div>
      <div data-node-label="Hero Headline" className="flex flex-col items-center">${T('Headline Line', 'Make every slide', `${ink} text-[76px] font-semibold leading-[1.04] tracking-[-2.6px]`)}${T('Headline Line', 'state the answer.', `${ink} text-[76px] font-semibold leading-[1.04] tracking-[-2.6px]`)}</div>
      <span data-node-label="Hero Sub" className="${F} block w-[640px] text-center ${mut} text-[19px] leading-[1.5]">Aira builds board-ready decks with action titles, one point per slide and sourced numbers. You edit alongside it.</span>
      <div data-node-label="Hero Actions" className="flex items-center gap-3 pt-2">${lBtn('Start free')}${lBtn('Import a PowerPoint', 'secondary')}</div>
      <div data-node-label="Hero Notes" className="flex items-center gap-5">${T('Hero Note', 'Free with weekly usage', `${sub} text-[13px]`)}<div data-node-label="Divider" className="w-px h-3.5 block [background-color:var(--paper-gray-300)]"></div><div data-node-label="Own Agent Link" className="flex items-center gap-2"><div data-node-label="Mini Claude" className="size-[14px] block text-[#d97757]">${CLAUDE}</div><div data-node-label="Mini OpenAI" className="size-[14px] block [color:var(--paper-gray-900)]">${OPENAI}</div>${T('Own Agent Text', 'Or use Claude or Codex', `${ink} text-[13px] font-medium`)}</div></div>
    </div>
    ${heroFrame}
  </div>
  ${section('Import Section', `<div data-node-label="Section Head" className="flex w-full items-end justify-between pb-14"><div data-node-label="Head Text" className="flex flex-col gap-4">${lEyebrow('Import')}${lH2('Keep the deck you already have.')}</div>${lLead('Import a PowerPoint and keep its layouts, fonts and notes. Anything that changes is flagged, never hidden.', 420)}</div>
    <div data-node-label="Compare" className="flex w-full items-start gap-8">
      <div data-node-label="Compare Side" className="flex flex-col gap-4">${T('Compare Label', 'In PowerPoint', `${sub} text-[13px] font-medium`)}${lSlide({ w: 560, kicker: 'BRIGHTWATER', title: 'Keep the launch on schedule', body: rowsBody(BW_ROWS, 560 / 640), source: 'Source: Brightwater launch plan. Example, sample data.' })}</div>
      <div data-node-label="Compare Arrow" className="flex size-10 shrink-0 justify-center items-center self-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] mt-8 [color:var(--paper-gray-600)]">${ic('arrowr', 16)}</div>
      <div data-node-label="Compare Side" className="flex flex-col gap-4">${T('Compare Label', 'In AirDesign', `[color:var(--paper-blue-link)] text-[13px] font-medium`)}${lSlide({ w: 560, kicker: 'BRIGHTWATER', title: 'Keep the launch on schedule', body: rowsBody(BW_ROWS, 560 / 640), source: 'Source: Brightwater launch plan. Example, sample data.' })}</div>
    </div>
    <div data-node-label="Kept List" className="flex w-full items-center gap-10 pt-10">${keptItem('Layouts and masters')}${keptItem('Fonts and colors')}${keptItem('Speaker notes')}${keptItem('Editable text and charts')}</div>`, 'bg-white')}
  ${section('Standard Section', `<div data-node-label="Section Head" className="flex w-full flex-col items-center gap-4 pb-16">${lEyebrow('The standard')}${lH2('Reviewed like a partner would.')}${`<span data-node-label="Section Lead" className="${F} block w-[600px] text-center ${mut} text-[17px] leading-[1.55]">Every slide Aira builds is held to three rules before it reaches you.</span>`}</div>
    <div data-node-label="Review" className="flex w-full items-center gap-16">
      <div data-node-label="Review Slide" className="flex relative">${lSlide({ w: 660, title: 'Revenue grew 39% year over year', source: 'Source: Q3 board notes, unaudited. Halden example, sample data.' })}
        <div data-node-label="Pin 1" className="flex absolute left-[-14px] top-[44px]">${annotDot(1)}</div>
        <div data-node-label="Pin 2" className="flex absolute right-[-14px] top-[160px]">${annotDot(2)}</div>
        <div data-node-label="Pin 3" className="flex absolute left-[-14px] bottom-[14px]">${annotDot(3)}</div>
      </div>
      <div data-node-label="Review Notes" className="flex flex-1 flex-col">${noteRow(1, 'The title states the answer', 'Read the title alone and you know the point.')}${noteRow(2, 'One point per slide', 'One chart, one message, nothing competing.')}${noteRow(3, 'Every number has a source', 'Each figure traces back to the file it came from.')}</div>
    </div>`)}
  ${section('Story Section', `<div data-node-label="Section Head" className="flex w-full items-end justify-between pb-14"><div data-node-label="Head Text" className="flex flex-col gap-4">${lEyebrow('The storyline')}${lH2('Read the argument in the titles.')}</div>${lLead('Aira plans the story before it builds a single slide. The recommendation comes first.', 420)}</div>
    <div data-node-label="Story" className="flex w-full items-start gap-12">
      <div data-node-label="Spine" className="flex w-[480px] flex-col">${spine.map(([n, t, on]) => `<div data-node-label="Spine Row" className="flex items-center rounded-[12px] ${on ? 'bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_4px_12px_#0000000d]' : ''} px-4 py-4 gap-4">${T('Spine Number', n, `${on ? '[color:var(--paper-blue-link)]' : sub} text-[14px] font-semibold w-4`)}${T('Spine Title', t, `${on ? ink + ' font-semibold' : mut} text-[16px] leading-[1.4]`)}</div>`).join('')}</div>
      <div data-node-label="Story Slide" className="flex pt-2">${lSlide({ w: 600, kicker: 'GROWTH', title: 'Enterprise deals drove two thirds of the growth', body: segBody(600 / 640), source: 'Source: Q3 pipeline report. Halden example, sample data.' })}</div>
    </div>`, 'bg-white')}
  ${section('Agents Section', `<div data-node-label="Section Head" className="flex w-full flex-col items-center gap-4 pb-14">${lEyebrow('Agents')}${lH2('Aira is built in. Or bring your own.')}${`<span data-node-label="Section Lead" className="${F} block w-[620px] text-center ${mut} text-[17px] leading-[1.55]">Connect Claude or Codex over MCP. Their edits land in the same editor, under the same rules.</span>`}</div>
    <div data-node-label="Agent Cards" className="flex w-full gap-6">${agentCard(airaTile, 'Aira', 'Built in. Plans the story, writes the titles and builds every slide.')}${agentCard(claudeTile, 'Claude', 'Connect once, then ask Claude to build or edit your decks.')}${agentCard(codexTile, 'Codex', 'Work from Codex on this computer, with the same canvas.')}</div>
    <div data-node-label="MCP Row" className="flex w-full items-center justify-between rounded-[14px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] mt-6 pl-6 pr-2 py-2"><div data-node-label="MCP Text" className="flex items-center gap-4">${T('MCP Label', 'MCP server', `${sub} text-[13px] font-medium`)}${T('MCP Address', 'https://mcp.airdesign.app/mcp', `${ink} text-[15px]`)}</div><div data-node-label="MCP Actions" className="flex items-center gap-4">${T('Guide Link', 'Read the setup guides', '[color:var(--paper-blue-link)] text-[14px] font-medium')}${lBtn('Copy address', 'secondary', false, 40)}</div></div>`)}
  ${section('Export Section', `<div data-node-label="Export" className="flex w-full items-center gap-20">
      <div data-node-label="Export Text" className="flex w-[440px] flex-col gap-5">${lEyebrow('Export')}${lH2('Leave with a PowerPoint you can edit.')}${lLead('Export an editable PowerPoint or a PDF. Titles stay text, charts stay charts.', 420)}<div data-node-label="Format Chips" className="flex items-center gap-2 pt-2">${['PowerPoint', 'PDF'].map(x => `<div data-node-label="Format Chip" className="flex h-8 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] px-3.5">${T('Format Label', x, `${ink} text-[13px] font-medium`)}</div>`).join('')}</div></div>
      <div data-node-label="PPT Window" className="flex flex-1 flex-col rounded-[14px] bg-white shadow-[0px_0px_0px_1px_#0000000f,0px_24px_56px_#00000017] overflow-clip">
        <div data-node-label="PPT Bar" className="flex h-10 items-center bg-[#C43E1C] px-4 gap-2"><div data-node-label="PPT Icon" className="flex size-5 justify-center items-center rounded-[4px] bg-white">${T('PPT Letter', 'P', 'text-[#C43E1C] text-[12px] font-bold')}</div>${T('PPT File', 'Halden quarterly review.pptx', 'text-white text-[13px] font-medium')}</div>
        <div data-node-label="PPT Canvas" className="flex justify-center [background-color:var(--paper-gray-100)] px-8 py-10">${lSlide({ w: 560, kicker: 'RECOMMENDATION', title: 'Approve the plan and review hiring in Q1', body: decisionBody(560 / 640), source: 'Source: Q3 board notes. Halden example, sample data.', selTitle: true })}</div>
      </div>
    </div>`, 'bg-white')}
  ${section('Final Section', `<div data-node-label="Final" className="flex w-full flex-col items-center rounded-[28px] [background-image:linear-gradient(180deg,#FFFFFF_0%,#F3F6FC_100%)] shadow-[0px_0px_0px_1px_var(--paper-gray-200)] py-24 gap-6">${tileG(`<div data-node-label="Spark" className="size-[24px] block">${SPARK}</div>`, 56, 16)}${lH2('Start your next deck free.')}${`<span data-node-label="Section Lead" className="${F} block w-[520px] text-center ${mut} text-[17px] leading-[1.55]">Free with weekly usage. It resets every Monday. Your decks stay private to you.</span>`}<div data-node-label="Final Actions" className="flex items-center gap-3 pt-2">${lBtn('Start free')}${lBtn('Import a PowerPoint', 'secondary')}</div>${T('Final Link', 'Or connect Claude or Codex', '[color:var(--paper-blue-link)] text-[14px] font-medium')}</div>`)}
  <div data-node-label="Footer" className="flex w-full items-center justify-between border-t [border-top-color:var(--paper-gray-200)] px-[120px] py-10">
    <div data-node-label="Footer Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[20px] block">${MARK}</div>${T('Footer Name', 'AirDesign', `${ink} text-[14px] font-semibold`)}${T('Footer Line', 'Slides for decisions.', `${sub} text-[14px]`)}</div>
    <div data-node-label="Footer Links" className="flex items-center gap-7">${['Pricing', 'Agent guides', 'Sign in', 'Privacy', 'Terms'].map(x => T('Footer Link', x, `${mut} text-[13px]`)).join('')}</div>
  </div>
</div>`;

// ---------- Landing v2: bold ----------
const NAVY = '#0F2433';
const harvey = (q, sz = 12) => {
  const r = sz / 2 - 1, c = sz / 2, a = q / 4 * 2 * Math.PI, x = c + r * Math.sin(a), y = c - r * Math.cos(a);
  const path = q >= 4 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="#0F2433"></circle>` : q <= 0 ? '' : `<path d="M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${q > 2 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="#0F2433"></path>`;
  return `<svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}"><circle cx="${c}" cy="${c}" r="${r}" fill="white" stroke="#0F2433" strokeWidth="1"></circle>${path}</svg>`;
};
const mini = ({ w = 264, n, title, kind = 'bars', dark = false, glow = false, dim = false, big = '66%', rows = [], cols = [] }) => {
  const h = Math.round(w * 9 / 16), s = w / 264;
  const mf = Math.max(8, Math.round(8 * s));
  const vis = kind === 'segl' ? `<div data-node-label="Mini Seg Labeled" className="flex flex-1 flex-col justify-end gap-[${Math.round(4 * s)}px]">${[['Enterprise', 66, '#1B6B8F'], ['Mid-market', 22, '#A9BFCF'], ['Self-serve', 12, '#A9BFCF']].map(([a, v, c]) => `<div data-node-label="Mini Seg Row" className="flex items-center gap-[${Math.round(5 * s)}px]"><div data-node-label="Mini Seg Name" className="flex w-[${Math.round(58 * s)}px] shrink-0">${T('Mini Cell', a, `[color:var(--deck-navy)] text-[${Math.max(11, mf)}px]`)}</div><div data-node-label="Mini Seg Bar" className="block h-[${Math.round(9 * s)}px]" style={{width:'${Math.round(v * 1.4 * s)}px',backgroundColor:'${c}'}}></div>${T('Mini Cell', v + '% of growth', `[color:var(--deck-navy)] text-[${Math.max(11, mf)}px] font-semibold`)}</div>`).join('')}</div>`
    : kind === 'downl' ? `<div data-node-label="Mini Line Labeled" className="flex flex-1 flex-col justify-end gap-1"><div data-node-label="Line Values" className="flex justify-between">${T('Mini Cell', '6.2%', `[color:#3B4B57] text-[${Math.max(11, mf)}px]`)}${T('Mini Cell', '4.0%', `[color:var(--deck-navy)] text-[${Math.max(11, mf)}px] font-semibold`)}</div><svg viewBox="0 0 200 40" preserveAspectRatio="none" width="${Math.round(232 * s)}" height="${Math.round(36 * s)}"><path d="M2 39 H198" fill="none" stroke="#C9D1D8" strokeWidth="1"></path><path d="M4 9 L54 12 L104 15 L154 17.5 L196 20" fill="none" stroke="#1B6B8F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path><circle cx="196" cy="20" r="4.5" fill="#1B6B8F"></circle></svg><div data-node-label="Line Labels" className="flex justify-between">${['Q3 24', 'Q1 25', 'Q3 25'].map(q => T('Mini Cell', q, `[color:#909090] text-[${Math.max(10, mf - 1)}px]`)).join('')}</div></div>`
    : kind === 'capbars' ? `<div data-node-label="Mini Cap" className="flex flex-1 flex-col justify-end gap-[${Math.round(4 * s)}px]"><div data-node-label="Cap Head" className="flex justify-end">${T('Mini Cell', 'Cap 85%', `[color:var(--deck-navy)] text-[${Math.max(10, mf - 1)}px] font-semibold`)}</div>${rows.map(([a, v]) => `<div data-node-label="Cap Row" className="flex items-center gap-[${Math.round(6 * s)}px]"><div data-node-label="Cap Name" className="flex w-[${Math.round(52 * s)}px] shrink-0">${T('Mini Cell', a, `[color:#3B4B57] text-[${Math.max(11, mf)}px]`)}</div><div data-node-label="Cap Track" className="flex relative h-[${Math.round(9 * s)}px] [background-color:#EEF1F4]" style={{width:'${Math.round(170 * s)}px'}}><div data-node-label="Cap Fill" className="block h-full" style={{width:'${v}%',backgroundColor:'#A9BFCF'}}></div><div data-node-label="Cap Tick" className="flex absolute top-[-3px] w-px [background-color:#0F2433]" style={{left:'85%',height:'${Math.round(9 * s) + 6}px'}}></div></div>${T('Mini Cell', v + '%', `[color:var(--deck-navy)] text-[${Math.max(11, mf)}px] font-semibold`)}</div>`).join('')}</div>`
    : kind === 'harvey' ? `<div data-node-label="Mini Harvey" className="flex flex-1 flex-col justify-end gap-[${Math.round(3 * s)}px]">${rows.map(([a, q, b]) => `<div data-node-label="Mini Harvey Row" className="flex items-center justify-between border-b border-[#E4E9EE] pb-[${Math.round(2 * s)}px]">${T('Mini Cell', a, `[color:#3B4B57] text-[${Math.max(11, mf)}px]`)}<div data-node-label="Harvey Right" className="flex items-center gap-2">${T('Mini Cell', b, `[color:var(--deck-navy)] text-[${Math.max(11, mf)}px] font-semibold`)}<div data-node-label="Harvey Ball" className="size-[13px] block">${harvey(q, 13)}</div></div></div>`).join('')}</div>`
    : kind === 'down' ? `<div data-node-label="Mini Line" className="flex flex-1 items-end"><svg viewBox="0 0 200 60" width="${Math.round(220 * s)}" height="${Math.round(60 * s)}"><path d="M4 12 L54 20 L104 32 L154 42 L196 50" fill="none" stroke="#1B6B8F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path><circle cx="196" cy="50" r="5" fill="#1B6B8F"></circle></svg></div>`
    : kind === 'table' ? `<div data-node-label="Mini Table" className="flex flex-1 flex-col justify-end gap-[${Math.round(3 * s)}px]">${rows.map(([a, b]) => `<div data-node-label="Mini Table Row" className="flex justify-between border-b border-[#E4E9EE] pb-[${Math.round(2 * s)}px]">${T('Mini Cell', a, `[color:#3B4B57] text-[${Math.max(11, mf)}px]`)}${T('Mini Cell', b, `[color:var(--deck-navy)] text-[${Math.max(11, mf)}px] font-semibold`)}</div>`).join('')}</div>`
    : kind === 'decide' ? `<div data-node-label="Mini Decide" className="flex flex-1 items-stretch gap-[${Math.round(6 * s)}px]">${cols.map(([a, b]) => `<div data-node-label="Mini Col" className="flex flex-1 flex-col rounded-[2px] [background-color:#EEF3F8] gap-[${Math.round(2 * s)}px]" style={{padding:'${Math.round(6 * s)}px'}}>${T('Mini Col Kicker', a, `[color:var(--deck-teal)] text-[${Math.max(7, Math.round(6 * s))}px] font-semibold tracking-[0.5px]`)}${T('Mini Col Text', b, `[color:var(--deck-navy)] text-[${mf}px] font-medium leading-[1.25]`)}</div>`).join('')}</div>`
    : kind === 'bars' ? `<div data-node-label="Mini Chart" className="flex flex-1 items-end gap-[${Math.round(7 * s)}px]">${[34, 44, 52, 60, 72].map((v, j) => `<div data-node-label="Mini Bar" className="flex-1 block" style={{height:'${Math.round(v * s * 0.8)}px',backgroundColor:'${j === 4 ? 'var(--deck-teal)' : 'var(--deck-mist)'}'}}></div>`).join('')}</div>`
    : kind === 'big' ? `<div data-node-label="Mini Big" className="flex flex-1 items-end">${T('Mini Big Number', big, `[color:var(--deck-teal)] text-[${Math.round(38 * s)}px] font-semibold leading-[1] tracking-[-1px]`)}</div>`
    : kind === 'rows' ? `<div data-node-label="Mini Rows" className="flex flex-1 flex-col justify-end gap-[${Math.round(4 * s)}px]">${[90, 70, 80].map(v => `<div data-node-label="Mini Row" className="block h-[${Math.round(10 * s)}px] rounded-[2px] [background-color:#EEF3F8]" style={{width:'${v}%'}}></div>`).join('')}</div>`
    : kind === 'cols' ? `<div data-node-label="Mini Cols" className="flex flex-1 items-stretch gap-[${Math.round(6 * s)}px]">${[0, 1].map(() => `<div data-node-label="Mini Col" className="flex-1 block rounded-[2px] [background-color:#EEF3F8]"></div>`).join('')}</div>`
    : `<div data-node-label="Mini Seg" className="flex flex-1 flex-col justify-end gap-[${Math.round(5 * s)}px]">${[78, 30, 18].map((v, j) => `<div data-node-label="Mini Seg Bar" className="block h-[${Math.round(9 * s)}px]" style={{width:'${v}%',backgroundColor:'${j === 0 ? 'var(--deck-teal)' : 'var(--deck-mist)'}'}}></div>`).join('')}</div>`;
  const el = `<div data-node-label="Mini Slide" className="flex w-[${w}px] h-[${h}px] shrink-0 flex-col bg-white rounded-[3px] ${glow ? '' : dark ? 'shadow-[0px_10px_30px_#00000040]' : 'shadow-[0px_0px_0px_1px_#0000000f,0px_6px_18px_#0000000f]'} gap-[${Math.round(6 * s)}px]" style={{padding:'${Math.round(14 * s)}px ${Math.round(16 * s)}px'}}>
      <div data-node-label="Mini Head" className="flex items-center gap-[${Math.round(6 * s)}px]">${T('Mini Number', String(n).padStart(2, '0'), `[color:var(--deck-teal)] text-[${Math.round(8 * s)}px] font-semibold tracking-[1px]`)}</div>
      ${T('Mini Title', title, `[color:var(--deck-navy)] text-[${Math.round(13 * s)}px] font-semibold leading-[1.2] tracking-[-0.2px]`)}${dim ? `<div data-node-label="Dimmed Body" className="flex flex-1 flex-col opacity-[0.12]">${vis}</div>` : vis}</div>`;
  return glow ? `<div data-node-label="Working Glow" className="flex shrink-0 p-[2px] rounded-[5px] [background-image:linear-gradient(135deg,#4D94FB_0%,#A9C8FF_35%,#B9A8FF_65%,#4D94FB_100%)] shadow-[0px_0px_28px_#4d94fb80,-16px_-10px_48px_#93b8ef66,16px_12px_48px_#b39dff66]">${el}</div>` : el;
};
const chip = (t) => `<div data-node-label="Review Chip" className="flex h-9 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_#0000000d,0px_8px_24px_#0000001a] pl-1.5 pr-3.5 gap-2">${tileG(ic('check', 12), 24, 12)}${T('Chip Text', t, `${ink} text-[13px] font-medium`)}</div>`;
const heroCollage = `<div data-node-label="Hero Collage" className="flex relative w-[700px] h-[600px] shrink-0">
    <div data-node-label="Back Slide" className="flex absolute left-[250px] top-[0px] opacity-60">${mini({ w: 400, n: 1, title: 'Keep the current growth plan', kind: 'cols' })}</div>
    <div data-node-label="Mid Slide" className="flex absolute left-[150px] top-[64px] opacity-80">${mini({ w: 470, n: 2, title: 'Enterprise drove two thirds of growth', kind: 'seg' })}</div>
    <div data-node-label="Front Slide" className="flex absolute left-[30px] top-[176px]">${lSlide({ w: 600, title: 'Revenue grew 39% year over year', source: 'Source: Q3 board notes, unaudited. Halden example, sample data.', glow: true, selTitle: true, was: 'Revenue' })}</div>
    <div data-node-label="Aira Card" className="flex absolute left-[390px] top-[446px] w-[300px] flex-col rounded-[16px] bg-white shadow-[0px_0px_0px_1px_#0000000d,0px_24px_56px_#0000002e] p-4 gap-3">
      <div data-node-label="Card Head" className="flex items-center gap-2"><div data-node-label="Spark" className="size-[14px] block [color:var(--ad-brand)]">${SPARK}</div>${T('Card Title', 'Aira', `${ink} text-[13px] font-semibold`)}${T('Card State', 'Working on slide 3', `${sub} text-[12px]`)}</div>
      <div data-node-label="Activity" className="flex flex-col gap-2">${step('done', 'Read Q3 board notes')}${step('done', 'Framed the recommendation')}${step('now', 'Writing the action title')}</div>
    </div>
    <div data-node-label="Chip 1" className="flex absolute left-[500px] top-[196px]">${chip('Answer first')}</div>
    <div data-node-label="Chip 2" className="flex absolute left-[0px] top-[486px]">${chip('One point per slide')}</div>
    <div data-node-label="Chip 3" className="flex absolute left-[60px] top-[548px]">${chip('Every number sourced')}</div>
  </div>`;
const pyramid = (() => {
  const top = `<div data-node-label="Governing" className="flex absolute left-[420px] top-[0px] flex-col items-center gap-3">${T('Tier Label', 'Governing thought', `[color:var(--paper-blue-link)] text-[12px] font-semibold tracking-[0.3px]`)}${mini({ w: 360, n: 1, title: 'Approve the plan and review hiring in Q1', kind: 'cols' })}</div>`;
  const args = [['Revenue grew 39% year over year', 'bars', 'Board notes Q3'], ['Enterprise drove two thirds of it', 'seg', 'Pipeline report'], ['Hiring can wait one quarter', 'rows', 'Capacity model']];
  const kids = args.map(([t, k, ev], j) => `<div data-node-label="Argument" className="flex absolute top-[320px] flex-col items-center gap-3" style={{left:'${j * 410}px'}}>${T('Tier Label', 'Argument ' + (j + 1), `${sub} text-[12px] font-semibold tracking-[0.3px]`)}${mini({ w: 380, n: j + 2, title: t, kind: k })}<div data-node-label="Evidence" className="flex h-8 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] px-3 gap-2">${ic('doc', 13, mut)}${T('Evidence Text', ev, `${mut} text-[12px]`)}</div></div>`).join('');
  const lines = `<div data-node-label="Pyramid Lines" className="flex absolute left-0 top-0 w-[1200px] h-[340px]"><svg viewBox="0 0 1200 340" width="1200" height="340"><path d="M600 245 V285 H190 V325 M600 285 V325 M600 285 H1010 V325" fill="none" stroke="#C1C1C0" strokeWidth="1.5"></path><circle cx="600" cy="285" r="4" fill="#4D94FB"></circle></svg></div>`;
  return `<div data-node-label="Pyramid" className="flex relative w-[1200px] h-[640px]">${lines}${top}${kids}</div>`;
})();
const WALL = [['Keep the current growth plan', 'cols'], ['Revenue grew 39% year over year', 'bars'], ['Enterprise deals drove two thirds of the growth', 'seg'], ['Win rate rose to 31% in enterprise', 'big'], ['Mid-market churn is down to 4%', 'bars'], ['Hiring can wait one quarter', 'rows'], ['Three risks to watch, all owned', 'rows'], ['Approve the plan and review hiring in Q1', 'cols']];
const redPen = `<div data-node-label="Red Pen" className="flex w-full items-center gap-10">
    <div data-node-label="Draft Side" className="flex flex-col gap-4">${T('Compare Label', 'Your draft', `${sub} text-[13px] font-medium`)}
      <div data-node-label="Draft" className="flex relative">${lSlide({ w: 540, title: 'Revenue', source: 'Q3 numbers', kicker: 'SECTION 2' })}
        <div data-node-label="Pen Marks" className="flex absolute left-0 top-0 w-[540px] h-[304px]"><svg viewBox="0 0 540 304" width="540" height="304"><ellipse cx="78" cy="58" rx="58" ry="22" fill="none" stroke="#D93F3F" strokeWidth="2.2" transform="rotate(-4 78 58)"></ellipse><path d="M140 52 C 200 30, 260 30, 300 44" fill="none" stroke="#D93F3F" strokeWidth="2" strokeLinecap="round"></path><path d="M292 36 L301 44 L289 49" fill="none" stroke="#D93F3F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path><path d="M28 288 C 70 280, 110 282, 140 286" fill="none" stroke="#D93F3F" strokeWidth="2" strokeLinecap="round"></path><path d="M470 120 C 500 140, 505 180, 488 210" fill="none" stroke="#D93F3F" strokeWidth="2" strokeLinecap="round"></path></svg></div>
        <div data-node-label="Pen Note" className="flex absolute left-[310px] top-[26px] rounded-[6px] bg-[#FDF0F0] px-2.5 py-1.5">${T('Pen Text', 'So what? State the answer.', 'text-[#C23434] text-[13px] font-semibold')}</div>
        <div data-node-label="Pen Note" className="flex absolute left-[150px] top-[262px] rounded-[6px] bg-[#FDF0F0] px-2.5 py-1.5">${T('Pen Text', 'Source?', 'text-[#C23434] text-[13px] font-semibold')}</div>
        <div data-node-label="Pen Note" className="flex absolute left-[392px] top-[216px] rounded-[6px] bg-[#FDF0F0] px-2.5 py-1.5">${T('Pen Text', 'Which bar matters?', 'text-[#C23434] text-[13px] font-semibold')}</div>
      </div></div>
    <div data-node-label="Pen Arrow" className="flex flex-col items-center gap-2 pt-8">${tileG(`<div data-node-label="Spark" className="size-[18px] block">${SPARK}</div>`, 44, 13)}${T('Pen Arrow Text', 'Aira', `${mut} text-[12px] font-medium`)}</div>
    <div data-node-label="Fixed Side" className="flex flex-col gap-4">${T('Compare Label', 'After Aira', `[color:var(--paper-blue-link)] text-[13px] font-medium`)}${lSlide({ w: 540, title: 'Revenue grew 39% year over year', source: 'Source: Q3 board notes, unaudited. Halden example, sample data.' })}</div>
  </div>`;
const landing2 = `<div data-node-id="ed39" data-node-label="S11.01 Discover / Landing / Default" className="flex w-[${LW}px] flex-col bg-[#FCFCF9] [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Nav" className="flex h-[76px] items-center justify-between px-[120px]">
    <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[24px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[17px] font-semibold tracking-[-0.3px]`)}</div>
    <div data-node-label="Nav Links" className="flex items-center gap-8">${['The method', 'Import', 'Agents', 'Pricing'].map(x => T('Nav Link', x, `${mut} text-[14px]`)).join('')}</div>
    <div data-node-label="Nav Actions" className="flex items-center gap-5">${T('Nav Sign In', 'Sign in', `${ink} text-[14px] font-medium`)}${lBtn('Start free', 'primary', false, 38)}</div>
  </div>
  <div data-node-label="Hero" className="flex w-full items-center justify-between pl-[120px] pr-[40px] pt-[40px] pb-[96px] [background-image:radial-gradient(circle_at_78%_40%,#E9F1FE_0%,#FCFCF9_55%)]">
    <div data-node-label="Hero Text" className="flex w-[560px] flex-col gap-7">
      <div data-node-label="Hero Badge" className="flex self-start h-8 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] pl-1.5 pr-3.5 gap-2"><div data-node-label="Badge Spark" className="flex size-5 justify-center items-center rounded-full bg-[#EEF4FE] [color:var(--ad-brand)]"><div data-node-label="Spark" className="size-[11px] block">${SPARK}</div></div>${T('Badge Text', 'For decks that have to win', `${mut} text-[13px]`)}</div>
      <div data-node-label="Hero Headline" className="flex flex-col">${['Win the room', 'before you', 'walk in.'].map(l => T('Headline Line', l, `${ink} text-[88px] font-semibold leading-[0.98] tracking-[-3.4px]`)).join('')}</div>
      <span data-node-label="Hero Sub" className="${F} block w-[500px] ${mut} text-[19px] leading-[1.5]">Board-ready decks, built the way top consultants build them. Aira frames the answer, writes the action titles and sources every number. You make the call.</span>
      <div data-node-label="Hero Actions" className="flex items-center gap-3 pt-1">${lBtn('Start free')}${lBtn('Import a PowerPoint', 'secondary')}</div>
      <div data-node-label="Hero Notes" className="flex items-center gap-5">${T('Hero Note', 'Free with weekly usage', `${sub} text-[13px]`)}<div data-node-label="Divider" className="w-px h-3.5 block [background-color:var(--paper-gray-300)]"></div><div data-node-label="Own Agent Link" className="flex items-center gap-2"><div data-node-label="Mini Claude" className="size-[14px] block text-[#d97757]">${CLAUDE}</div><div data-node-label="Mini OpenAI" className="size-[14px] block [color:var(--paper-gray-900)]">${OPENAI}</div>${T('Own Agent Text', 'Or use Claude or Codex', `${ink} text-[13px] font-medium`)}</div></div>
    </div>
    ${heroCollage}
  </div>
  ${section('Pyramid Section', `<div data-node-label="Section Head" className="flex w-full items-end justify-between pb-16"><div data-node-label="Head Text" className="flex flex-col gap-4">${lEyebrow('The method')}${lH2('Built on the pyramid, not a template.')}</div>${lLead('Aira starts from the answer, splits it into three arguments and backs each one with evidence. Then it builds the slides.', 440)}</div>${pyramid}`, 'bg-white')}
  <div data-node-label="Wall Section" className="flex w-full flex-col items-center px-[120px] py-[120px] gap-16" style={{backgroundColor:'${NAVY}'}}>
    <div data-node-label="Section Head" className="flex w-full items-end justify-between"><div data-node-label="Head Text" className="flex flex-col gap-4">${T('Section Eyebrow', 'The storyline', 'text-[#93B8EF] text-[13px] font-semibold tracking-[0.2px]')}${T('Section Title', 'Read the whole argument in the titles.', 'text-white text-[44px] font-semibold leading-[1.1] tracking-[-1.2px]')}</div><span data-node-label="Section Lead" className="${F} block w-[400px] text-[#A9B8C6] text-[17px] leading-[1.55]">Skim the titles and you have the case. That is how a ghost deck becomes a board deck by tonight.</span></div>
    <div data-node-label="Wall" className="flex w-full flex-col gap-6">${[0, 4].map(k => `<div data-node-label="Wall Row" className="flex gap-6">${WALL.slice(k, k + 4).map(([t, kind], j) => mini({ w: 282, n: k + j + 1, title: t, kind, dark: true, glow: k + j === 2 })).join('')}</div>`).join('')}</div>
    <div data-node-label="Wall Note" className="flex items-center gap-3">${tileG(`<div data-node-label="Spark" className="size-[14px] block">${SPARK}</div>`, 28, 8)}${T('Wall Note Text', 'Aira is rebuilding slide 3 to match the new recommendation.', 'text-[#C9D4DE] text-[14px]')}</div>
  </div>
  ${section('Red Pen Section', `<div data-node-label="Section Head" className="flex w-full flex-col items-center gap-4 pb-16">${lEyebrow('The review')}${lH2('Every slide gets the partner’s red pen.')}${`<span data-node-label="Section Lead" className="${F} block w-[620px] text-center ${mut} text-[17px] leading-[1.55]">Topic titles, loose charts and unsourced numbers get caught before anyone senior sees them.</span>`}</div>${redPen}`)}
  ${section('Import Section', `<div data-node-label="Section Head" className="flex w-full items-end justify-between pb-14"><div data-node-label="Head Text" className="flex flex-col gap-4">${lEyebrow('PowerPoint in and out')}${lH2('Your deck stays a real PowerPoint.')}</div>${lLead('Import a .pptx and keep its layouts, fonts and notes. Export it back with titles as text and charts as charts.', 420)}</div>
    <div data-node-label="Compare" className="flex w-full items-start gap-8">
      <div data-node-label="Compare Side" className="flex flex-col gap-4">${T('Compare Label', 'In PowerPoint', `${sub} text-[13px] font-medium`)}${lSlide({ w: 560, kicker: 'BRIGHTWATER', title: 'Keep the launch on schedule', body: rowsBody(BW_ROWS, 560 / 640), source: 'Source: Brightwater launch plan. Example, sample data.' })}</div>
      <div data-node-label="Compare Arrow" className="flex size-10 shrink-0 justify-center items-center self-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] mt-8 [color:var(--paper-gray-600)]">${ic('arrowr', 16)}</div>
      <div data-node-label="Compare Side" className="flex flex-col gap-4">${T('Compare Label', 'In AirDesign', `[color:var(--paper-blue-link)] text-[13px] font-medium`)}${lSlide({ w: 560, kicker: 'BRIGHTWATER', title: 'Keep the launch on schedule', body: rowsBody(BW_ROWS, 560 / 640), source: 'Source: Brightwater launch plan. Example, sample data.' })}</div>
    </div>
    <div data-node-label="Kept List" className="flex w-full items-center gap-10 pt-10">${keptItem('Layouts and masters')}${keptItem('Fonts and colors')}${keptItem('Speaker notes')}${keptItem('Editable text and charts')}</div>`, 'bg-white')}
  ${section('Agents Section', `<div data-node-label="Section Head" className="flex w-full flex-col items-center gap-4 pb-14">${lEyebrow('Agents')}${lH2('Aira is built in. Or bring your own.')}${`<span data-node-label="Section Lead" className="${F} block w-[620px] text-center ${mut} text-[17px] leading-[1.55]">Connect Claude or Codex over MCP. Their edits land in the same editor, under the same rules.</span>`}</div>
    <div data-node-label="Agent Cards" className="flex w-full gap-6">${agentCard(airaTile, 'Aira', 'Built in. Plans the story, writes the titles and builds every slide.')}${agentCard(claudeTile, 'Claude', 'Connect once, then ask Claude to build or edit your decks.')}${agentCard(codexTile, 'Codex', 'Work from Codex on this computer, with the same canvas.')}</div>
    <div data-node-label="MCP Row" className="flex w-full items-center justify-between rounded-[14px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] mt-6 pl-6 pr-2 py-2"><div data-node-label="MCP Text" className="flex items-center gap-4">${T('MCP Label', 'MCP server', `${sub} text-[13px] font-medium`)}${T('MCP Address', 'https://mcp.airdesign.app/mcp', `${ink} text-[15px]`)}</div><div data-node-label="MCP Actions" className="flex items-center gap-4">${T('Guide Link', 'Read the setup guides', '[color:var(--paper-blue-link)] text-[14px] font-medium')}${lBtn('Copy address', 'secondary', false, 40)}</div></div>`)}
  <div data-node-label="Final Section" className="flex w-full flex-col items-center px-[120px] py-[140px] gap-7 [background-image:radial-gradient(circle_at_50%_0%,#1D4A7A_0%,${NAVY}_60%)]">
    ${mini({ w: 340, n: 8, title: 'Approve the plan and review hiring in Q1', kind: 'cols', glow: true })}
    ${T('Final Title', 'Your next deck has to win.', 'text-white text-[64px] font-semibold leading-[1.05] tracking-[-2px] pt-6')}
    <span data-node-label="Final Lead" className="${F} block w-[520px] text-center text-[#A9B8C6] text-[18px] leading-[1.55]">Start free. Weekly usage resets every Monday. Your decks stay private to you.</span>
    <div data-node-label="Final Actions" className="flex items-center gap-3 pt-2">${lBtn('Start free')}<div data-node-label="Ghost Button" className="flex h-[44px] items-center rounded-[10px] shadow-[0px_0px_0px_1px_#ffffff33] px-5">${T('Ghost Label', 'Import a PowerPoint', 'text-white text-[15px] font-medium')}</div></div>
  </div>
  <div data-node-label="Footer" className="flex w-full items-center justify-between px-[120px] py-10" style={{backgroundColor:'${NAVY}'}}>
    <div data-node-label="Footer Brand" className="flex items-center gap-2.5">${T('Footer Name', 'AirDesign', 'text-white text-[14px] font-semibold')}${T('Footer Line', 'Slides for decisions.', 'text-[#7F93A6] text-[14px]')}</div>
    <div data-node-label="Footer Links" className="flex items-center gap-7">${['Pricing', 'Agent guides', 'Sign in', 'Privacy', 'Terms'].map(x => T('Footer Link', x, 'text-[#A9B8C6] text-[13px]')).join('')}</div>
  </div>
</div>`;

// ---------- Landing v3: the page is a board deck ----------
const TOTAL = 7;
const signpost = (n, dark = false) => `<div data-node-label="Signpost" className="flex items-center gap-3">${T('Signpost Number', String(n).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0'), `${dark ? 'text-[#7F93A6]' : sub} text-[12px] font-medium tracking-[0.5px]`)}<div data-node-label="Signpost Bars" className="flex items-center gap-1">${Array.from({ length: TOTAL }, (_, j) => `<div data-node-label="Signpost Bar" className="block w-5 h-[3px] rounded-full" style={{backgroundColor:'${j + 1 === n ? '#4D94FB' : dark ? '#ffffff26' : '#D7D7D6'}'}}></div>`).join('')}</div></div>`;
const head = (n, eyebrow, title, lead, { dark = false, center = false, leadW = 440 } = {}) => {
  const eb = T('Section Eyebrow', eyebrow, `${dark ? 'text-[#93B8EF]' : '[color:var(--paper-blue-link)]'} text-[13px] font-semibold tracking-[0.2px]`);
  const h = `<div data-node-label="Section Title" className="flex flex-col ${center ? 'items-center' : ''}">${[].concat(title).map(l => T('Title Line', l, `${dark ? 'text-white' : ink} text-[48px] font-semibold leading-[1.08] tracking-[-1.4px]`)).join('')}</div>`;
  const ld = `<span data-node-label="Section Lead" className="${F} block ${dark ? 'text-[#A9B8C6]' : mut} text-[17px] leading-[1.55] ${center ? 'text-center' : ''}" style={{width:'${leadW}px'}}>${lead}</span>`;
  return center
    ? `<div data-node-label="Section Head" className="flex w-full flex-col items-center gap-5 pb-16">${signpost(n, dark)}${eb}${h}${ld}</div>`
    : `<div data-node-label="Section Head" className="flex w-full flex-col gap-6 pb-16"><div data-node-label="Head Top" className="flex w-full items-center justify-between">${eb}${signpost(n, dark)}</div><div data-node-label="Head Row" className="flex w-full items-end justify-between">${h}${ld}</div></div>`;
};
const struck = (t, cls, top) => `<div data-node-label="Struck" className="flex self-start relative">${T('Struck Text', t, cls)}<div data-node-label="Strike" className="flex absolute left-0 w-full h-[2px] [background-color:#5B7080]" style={{top:'${top}px'}}></div></div>`;
const handlesAbs = ['left-[-4px] top-[-4px]', 'right-[-4px] top-[-4px]', 'left-[-4px] bottom-[-4px]', 'right-[-4px] bottom-[-4px]'].map(pos => `<div data-node-label="Handle" className="flex absolute ${pos} size-[7px] bg-white border border-[#4D94FB] rounded-none"></div>`).join('');
const REWRITES = [
  ['Q3 revenue by segment', 'Enterprise carried the quarter', true],
  ['Customer survey results', 'Onboarding, not price, stalls trials', false],
  ['Market overview', 'Two rivals hold 70% of the market', false],
  ['Hiring update', 'Hiring can wait one quarter', false],
];
const rewriteRows = REWRITES.map(([a, b, on], j) => `<div data-node-label="Rewrite Row" className="flex w-full items-center py-7 ${j ? 'border-t border-[#ffffff14]' : ''}">
    <div data-node-label="Label Side" className="flex w-[420px] shrink-0 flex-col gap-2">${T('Row Tag', 'Label', 'text-[#5B7080] text-[12px] font-medium tracking-[0.5px]')}${struck(a, 'text-[#5B7080] text-[30px] font-medium leading-[1.15] tracking-[-0.6px]', 19)}</div>
    <div data-node-label="Row Arrow" className="flex w-[90px] shrink-0 [color:#4D94FB]">${ic('arrowr', 22)}</div>
    <div data-node-label="Answer Side" className="flex flex-1 flex-col gap-2">${T('Row Tag', on ? 'Answer, written by Aira' : 'Answer', `${on ? 'text-[#93B8EF]' : 'text-[#7F93A6]'} text-[12px] font-medium tracking-[0.5px]`)}<div data-node-label="Answer Wrap" className="flex self-start relative ${on ? 'border border-[#4D94FB] rounded-none' : ''}">${T('Answer Text', b, 'text-white text-[44px] font-semibold leading-[1.1] tracking-[-1.3px]')}${on ? handlesAbs : ''}</div></div>
  </div>`).join('');
const REG = [['North', '$42M', '+31%', '$13M'], ['East', '$35M', '+27%', '$9.5M'], ['South', '$48M', '+6%', '$2.9M'], ['West', '$30M', '+4%', '$1.2M'], ['Central', '$18M', '+3%', '$0.5M']];
const tCell = (t, cls, w) => `<div data-node-label="Cell" className="flex shrink-0 w-[${w}px]">${T('Cell Text', t, cls)}</div>`;
const dumpBody = (s) => {
  const rows = [['South', '$48M', '+6%'], ['North', '$42M', '+31%'], ['East', '$35M', '+27%'], ['West', '$30M', '+4%'], ['Central', '$18M', '+3%']];
  const W = [150, 120, 120].map(x => Math.round(x * s));
  const f = Math.round(10 * s);
  return `<div data-node-label="Dump Table" className="flex flex-1 flex-col pt-1">
    <div data-node-label="Table Head" className="flex border-b-[1.5px] border-[#0F2433] pb-1.5">${['Region', 'Revenue', 'Growth'].map((h, i) => tCell(h, `[color:var(--deck-navy)] text-[${f}px] font-semibold`, W[i])).join('')}</div>
    ${rows.map(r => `<div data-node-label="Table Row" className="flex border-b border-[#E4E9EE] py-[${Math.round(5 * s)}px]">${r.map((c, i) => tCell(c, `[color:#3B4B57] text-[${f}px]`, W[i])).join('')}</div>`).join('')}
  </div>`;
};
const insightBody = (s) => {
  const W = [96, 80, 72, 96].map(x => Math.round(x * s));
  const f = Math.round(10 * s);
  return `<div data-node-label="Insight" className="flex flex-1 items-stretch gap-[${Math.round(14 * s)}px] pt-1">
    <div data-node-label="Insight Table" className="flex flex-col">
      <div data-node-label="Table Head" className="flex border-b-[1.5px] border-[#0F2433] pb-1.5 pl-[${Math.round(40 * s)}px]">${['Region', 'Revenue', 'Growth', 'Added next year'].map((h, i) => tCell(h, `[color:var(--deck-navy)] text-[${f}px] font-semibold`, W[i])).join('')}</div>
      ${REG.map((r, j) => `<div data-node-label="Table Row" className="flex items-center border-b border-[#E4E9EE] py-[${Math.round(5 * s)}px] ${j < 2 ? '[background-color:#EEF4FE]' : ''}"><div data-node-label="Group" className="flex shrink-0 w-[${Math.round(40 * s)}px]">${j === 0 ? T('Group Text', 'Grow', `[color:var(--paper-blue-link)] text-[${Math.round(9 * s)}px] font-semibold pl-1`) : j === 2 ? T('Group Text', 'Hold', `[color:#909090] text-[${Math.round(9 * s)}px] font-semibold pl-1`) : ''}</div>${r.map((c, i) => i === 3 && j < 2
        ? `<div data-node-label="Cell" className="flex shrink-0 w-[${W[i]}px]"><div data-node-label="Circled" className="flex rounded-full border-[1.5px] border-[#4D94FB] px-1.5">${T('Cell Text', c, `[color:var(--deck-navy)] text-[${f}px] font-semibold`)}</div></div>`
        : tCell(c, `${j < 2 ? '[color:var(--deck-navy)] font-medium' : '[color:#3B4B57]'} text-[${f}px]`, W[i])).join('')}</div>`).join('')}
    </div>
    <div data-node-label="Callout" className="flex flex-1 flex-col justify-center rounded-[3px] [background-color:#0F2433] gap-[${Math.round(6 * s)}px]" style={{padding:'${Math.round(12 * s)}px'}}>${T('Callout Kicker', 'SO WHAT', `text-[#93B8EF] text-[${Math.round(8 * s)}px] font-semibold tracking-[1px]`)}${T('Callout Text', 'Fund North and East first', `text-white text-[${Math.round(13 * s)}px] font-semibold leading-[1.25]`)}${T('Callout Context', 'Their $22.5M is more than the other three regions add together.', `text-[#A9B8C6] text-[${Math.round(9 * s)}px] leading-[1.4]`)}</div>
  </div>`;
};
const soWhat = `<div data-node-label="So What" className="flex w-full items-center justify-between">
    <div data-node-label="Draft Side" className="flex flex-col gap-4">${T('Compare Label', 'Your draft', `${sub} text-[13px] font-medium`)}
      <div data-node-label="Draft" className="flex relative">${lSlide({ w: 540, kicker: 'SECTION 2', title: 'Regional results', body: dumpBody(540 / 640), source: 'Brightwater finance pack' })}
        <div data-node-label="Pen Marks" className="flex absolute left-0 top-0 w-[540px] h-[304px]"><svg viewBox="0 0 540 304" width="540" height="304"><ellipse cx="108" cy="58" rx="86" ry="22" fill="none" stroke="#D93F3F" strokeWidth="2.2" transform="rotate(-3 108 58)"></ellipse><path d="M198 50 C 240 30, 290 30, 322 42" fill="none" stroke="#D93F3F" strokeWidth="2" strokeLinecap="round"></path><path d="M313 34 L323 42 L311 47" fill="none" stroke="#D93F3F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path><path d="M300 110 C 330 150, 330 210, 300 250" fill="none" stroke="#D93F3F" strokeWidth="2" strokeLinecap="round"></path></svg></div>
        <div data-node-label="Pen Note" className="flex absolute left-[332px] top-[26px] rounded-[6px] bg-[#FDF0F0] px-2.5 py-1.5">${T('Pen Text', 'So what? Say the answer.', 'text-[#C23434] text-[13px] font-semibold')}</div>
        <div data-node-label="Pen Note" className="flex absolute left-[340px] top-[166px] rounded-[6px] bg-[#FDF0F0] px-2.5 py-1.5">${T('Pen Text', 'Which rows matter?', 'text-[#C23434] text-[13px] font-semibold')}</div>
      </div></div>
    <div data-node-label="Pen Arrow" className="flex flex-col items-center gap-2 pt-8">${tileG(`<div data-node-label="Spark" className="size-[18px] block">${SPARK}</div>`, 44, 13)}${T('Pen Arrow Text', 'Aira', `${mut} text-[12px] font-medium`)}</div>
    <div data-node-label="Fixed Side" className="flex flex-col gap-4">${T('Compare Label', 'After Aira', `[color:var(--paper-blue-link)] text-[13px] font-medium`)}${lSlide({ w: 540, kicker: 'GROWTH', title: 'North and East hold four fifths of next year’s growth', body: insightBody(540 / 640), source: 'Source: Brightwater finance pack, FY plan. Example, sample data.' })}</div>
  </div>`;
const WALLTEXT = WALL.map(([t]) => t);
const tldr = `<div data-node-label="TLDR" className="flex w-full items-stretch rounded-[18px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_8px_24px_#0000000a]">
    <div data-node-label="TLDR Label" className="flex w-[200px] shrink-0 flex-col justify-center border-r [border-right-color:var(--paper-gray-200)] px-7 py-6 gap-1">${T('TLDR Kicker', 'In short', '[color:var(--paper-blue-link)] text-[13px] font-semibold')}${T('TLDR Sub', 'Three things to know', `${sub} text-[13px]`)}</div>
    ${[['Aira frames the answer before it designs a slide.'], ['You edit alongside it, on the same slides.'], ['You leave with a PowerPoint you can edit.']].map(([t], j) => `<div data-node-label="TLDR Item" className="flex flex-1 items-start px-7 py-6 gap-3 ${j ? 'border-l [border-left-color:var(--paper-gray-200)]' : ''}">${T('TLDR Number', String(j + 1), '[color:var(--ad-brand)] text-[22px] font-semibold leading-[1] tracking-[-0.5px]')}<span data-node-label="TLDR Text" className="${F} block w-[240px] ${ink} text-[15px] leading-[1.45] font-medium">${t}</span></div>`).join('')}
  </div>`;
const dark = (label, inner, extra = '') => `<div data-node-label="${label}" className="flex w-full flex-col items-center px-[120px] py-[120px] ${extra}" style={{backgroundColor:'${NAVY}'}}>${inner}</div>`;
const landing3 = `<div data-node-id="ed39" data-node-label="S11.01 Discover / Landing / Default" className="flex w-[${LW}px] flex-col bg-[#FCFCF9] [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Nav" className="flex h-[76px] items-center justify-between px-[120px]">
    <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[24px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[17px] font-semibold tracking-[-0.3px]`)}</div>
    <div data-node-label="Nav Links" className="flex items-center gap-8">${['The method', 'PowerPoint', 'Agents', 'Pricing'].map(x => T('Nav Link', x, `${mut} text-[14px]`)).join('')}</div>
    <div data-node-label="Nav Actions" className="flex items-center gap-5">${T('Nav Sign In', 'Sign in', `${ink} text-[14px] font-medium`)}${lBtn('Start free', 'primary', false, 38)}</div>
  </div>
  <div data-node-label="Hero" className="flex w-full flex-col pl-[120px] pr-[40px] pt-[40px] pb-[88px] gap-16 [background-image:radial-gradient(circle_at_78%_36%,#E9F1FE_0%,#FCFCF9_55%)]">
    <div data-node-label="Hero Row" className="flex w-full items-center justify-between">
      <div data-node-label="Hero Text" className="flex w-[560px] flex-col gap-7">
        <div data-node-label="Hero Badge" className="flex self-start h-8 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] pl-1.5 pr-3.5 gap-2"><div data-node-label="Badge Spark" className="flex size-5 justify-center items-center rounded-full bg-[#EEF4FE] [color:var(--ad-brand)]"><div data-node-label="Spark" className="size-[11px] block">${SPARK}</div></div>${T('Badge Text', 'For decks that have to win', `${mut} text-[13px]`)}</div>
        <div data-node-label="Hero Headline" className="flex flex-col">${['Win the room', 'before you', 'walk in.'].map(l => T('Headline Line', l, `${ink} text-[88px] font-semibold leading-[0.98] tracking-[-3.4px]`)).join('')}</div>
        <span data-node-label="Hero Sub" className="${F} block w-[500px] ${mut} text-[19px] leading-[1.5]">Board-ready decks, built the way top consultants build them. Aira frames the answer, writes the action titles and sources every number. You make the call.</span>
        <div data-node-label="Hero Actions" className="flex items-center gap-3 pt-1">${lBtn('Start free')}${lBtn('Import a PowerPoint', 'secondary')}</div>
        <div data-node-label="Hero Notes" className="flex items-center gap-5">${T('Hero Note', 'Free with weekly usage', `${sub} text-[13px]`)}<div data-node-label="Divider" className="w-px h-3.5 block [background-color:var(--paper-gray-300)]"></div><div data-node-label="Own Agent Link" className="flex items-center gap-2"><div data-node-label="Mini Claude" className="size-[14px] block text-[#d97757]">${CLAUDE}</div><div data-node-label="Mini OpenAI" className="size-[14px] block [color:var(--paper-gray-900)]">${OPENAI}</div>${T('Own Agent Text', 'Or use Claude or Codex', `${ink} text-[13px] font-medium`)}</div></div>
      </div>
      ${heroCollage}
    </div>
    <div data-node-label="TLDR Wrap" className="flex w-[1200px]">${tldr}</div>
  </div>
  ${dark('Rewrite Section', `${head(2, 'The title', ['Nobody reads a label.', 'Everyone reads an answer.'], 'Executives read the title, then decide whether to keep listening. Aira writes every title as the point, so the first ten seconds carry the case.', { dark: true, leadW: 400 })}<div data-node-label="Rewrites" className="flex w-full flex-col">${rewriteRows}</div>`)}
  ${section('Pyramid Section', `${head(3, 'The method', ['Answer first. Three reasons.', 'Then the proof.'], 'You work from the evidence up. The board hears it from the answer down. Aira builds the deck in that order, and cuts what does not hold the argument.')}${pyramid}`, 'bg-white')}
  ${dark('Wall Section', `${head(4, 'The storyline', ['Read only the titles.', 'The case still holds.'], 'Hide every chart and every bullet. If the titles alone make the argument, the deck is ready. Aira checks this on every deck it builds.', { dark: true, leadW: 400 })}
    <div data-node-label="Wall" className="flex w-full flex-col gap-6">${[0, 4].map(k => `<div data-node-label="Wall Row" className="flex gap-6">${WALL.slice(k, k + 4).map(([t, kind], j) => mini({ w: 282, n: k + j + 1, title: t, kind, dark: true, glow: k + j === 2, dim: true })).join('')}</div>`).join('')}</div>
    <div data-node-label="Read Aloud" className="flex w-full flex-col pt-14 gap-4">${T('Read Label', 'The titles, read as one paragraph', 'text-[#7F93A6] text-[13px] font-medium')}<div data-node-label="Read Text" className="flex w-[1100px] flex-wrap gap-x-[10px] gap-y-[6px]">${WALLTEXT.map((t, j) => T('Read Title', t + '.', `${j === 2 ? 'text-white font-semibold' : 'text-[#C9D4DE]'} text-[26px] leading-[1.45] tracking-[-0.4px]`)).join('')}</div></div>`)}
  ${section('So What Section', `${head(5, 'The review', 'Data in. A decision out.', 'A table is not a point of view. Aira finds the rows that matter, puts the numbers in context and says what to do, like a partner with a red pen.')}${soWhat}`)}
  ${section('Import Section', `${head(6, 'PowerPoint in and out', 'Your deck stays a real PowerPoint.', 'Import a .pptx and keep its layouts, fonts and notes. Export it back with titles as text and charts as charts.')}
    <div data-node-label="Compare" className="flex w-full items-start gap-8">
      <div data-node-label="Compare Side" className="flex flex-col gap-4">${T('Compare Label', 'In PowerPoint', `${sub} text-[13px] font-medium`)}${lSlide({ w: 560, kicker: 'BRIGHTWATER', title: 'Keep the launch on schedule', body: rowsBody(BW_ROWS, 560 / 640), source: 'Source: Brightwater launch plan. Example, sample data.' })}</div>
      <div data-node-label="Compare Arrow" className="flex size-10 shrink-0 justify-center items-center self-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] mt-8 [color:var(--paper-gray-600)]">${ic('arrowr', 16)}</div>
      <div data-node-label="Compare Side" className="flex flex-col gap-4">${T('Compare Label', 'In AirDesign', `[color:var(--paper-blue-link)] text-[13px] font-medium`)}${lSlide({ w: 560, kicker: 'BRIGHTWATER', title: 'Keep the launch on schedule', body: rowsBody(BW_ROWS, 560 / 640), source: 'Source: Brightwater launch plan. Example, sample data.' })}</div>
    </div>
    <div data-node-label="Kept List" className="flex w-full items-center gap-10 pt-10">${keptItem('Layouts and masters')}${keptItem('Fonts and colors')}${keptItem('Speaker notes')}${keptItem('Editable text and charts')}</div>`, 'bg-white')}
  ${section('Agents Section', `${head(7, 'Agents', 'Aira is built in. Or bring your own.', 'Connect Claude or Codex over MCP. Their edits land in the same editor, under the same rules.', { center: true, leadW: 620 })}
    <div data-node-label="Agent Cards" className="flex w-full gap-6">${agentCard(airaTile, 'Aira', 'Built in. Plans the story, writes the titles and builds every slide.')}${agentCard(claudeTile, 'Claude', 'Connect once, then ask Claude to build or edit your decks.')}${agentCard(codexTile, 'Codex', 'Work from Codex on this computer, with the same canvas.')}</div>
    <div data-node-label="MCP Row" className="flex w-full items-center justify-between rounded-[14px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] mt-6 pl-6 pr-2 py-2"><div data-node-label="MCP Text" className="flex items-center gap-4">${T('MCP Label', 'MCP server', `${sub} text-[13px] font-medium`)}${T('MCP Address', 'https://mcp.airdesign.app/mcp', `${ink} text-[15px]`)}</div><div data-node-label="MCP Actions" className="flex items-center gap-4">${T('Guide Link', 'Read the setup guides', '[color:var(--paper-blue-link)] text-[14px] font-medium')}${lBtn('Copy address', 'secondary', false, 40)}</div></div>`)}
  <div data-node-label="Final Section" className="flex w-full flex-col items-center px-[120px] py-[140px] gap-7 [background-image:radial-gradient(circle_at_50%_0%,#1D4A7A_0%,${NAVY}_60%)]">
    ${T('Final Eyebrow', 'Next step', 'text-[#93B8EF] text-[13px] font-semibold tracking-[0.2px]')}
    ${mini({ w: 340, n: 8, title: 'Approve the plan and review hiring in Q1', kind: 'cols', glow: true })}
    ${T('Final Title', 'Your next deck has to win.', 'text-white text-[64px] font-semibold leading-[1.05] tracking-[-2px] pt-6')}
    <span data-node-label="Final Lead" className="${F} block w-[520px] text-center text-[#A9B8C6] text-[18px] leading-[1.55]">Start free. Weekly usage resets every Monday. Your decks stay private to you.</span>
    <div data-node-label="Final Actions" className="flex items-center gap-3 pt-2">${lBtn('Start free')}<div data-node-label="Ghost Button" className="flex h-[44px] items-center rounded-[10px] shadow-[0px_0px_0px_1px_#ffffff33] px-5">${T('Ghost Label', 'Import a PowerPoint', 'text-white text-[15px] font-medium')}</div></div>
  </div>
  <div data-node-label="Footer" className="flex w-full items-center justify-between px-[120px] py-10 border-t border-[#ffffff14]" style={{backgroundColor:'${NAVY}'}}>
    <div data-node-label="Footer Brand" className="flex items-center gap-2.5">${T('Footer Name', 'AirDesign', 'text-white text-[14px] font-semibold')}${T('Footer Line', 'Slides for decisions.', 'text-[#7F93A6] text-[14px]')}</div>
    <div data-node-label="Footer Links" className="flex items-center gap-7">${['Pricing', 'Agent guides', 'Sign in', 'Privacy', 'Terms'].map(x => T('Footer Link', x, 'text-[#A9B8C6] text-[13px]')).join('')}</div>
  </div>
</div>`;

// ---------- Landing v4: council round 1 ----------
const exCap = (t, darkCap = false) => T('Exhibit Caption', t, `${darkCap ? 'text-[#7F93A6]' : sub} text-[12px] font-medium`);
const segBig = (s = 1) => `<div data-node-label="Segments" className="flex flex-1 flex-col justify-center gap-[${Math.round(14 * s)}px]">${[['Enterprise', 66, '#0F2433'], ['Mid-market', 22, '#A9BFCF'], ['Self-serve', 12, '#A9BFCF']].map(([a, v, c]) => `<div data-node-label="Segment" className="flex items-center gap-[${Math.round(12 * s)}px]">${`<div data-node-label="Segment Name" className="flex w-[${Math.round(96 * s)}px] shrink-0">${T('Segment Label', a, `[color:var(--deck-navy)] text-[${Math.round(12 * s)}px] ${v > 50 ? 'font-semibold' : ''}`)}</div>`}<div data-node-label="Segment Bar" className="block h-[${Math.round(22 * s)}px]" style={{width:'${Math.round(v * 4.2 * s)}px',backgroundColor:'${c}'}}></div>${T('Segment Value', v + '% of growth', `[color:var(--deck-navy)] text-[${Math.round(12 * s)}px] ${v > 50 ? 'font-semibold' : ''}`)}</div>`).join('')}</div>`;
const heroSlide = `<div data-node-label="Hero Exhibit" className="flex relative w-[700px] h-[520px] shrink-0">
    <div data-node-label="Hero Slide" className="flex absolute left-[10px] top-[56px]">${lSlide({ w: 680, kicker: 'GROWTH', title: 'Enterprise carried the quarter', body: segBig(680 / 640), source: 'Source: Q3 pipeline report. Halden, sample data.', glow: true, selTitle: true, was: 'Q3 revenue by segment', srcPx: 11 })}</div>
    <div data-node-label="Hero Caption" className="flex absolute left-[10px] top-[0px]">${exCap('Sample deck: Halden, Q3 board review')}</div>
    <div data-node-label="Aira Card" className="flex absolute left-[420px] top-[436px] w-[260px] flex-col rounded-[14px] bg-white shadow-[0px_0px_0px_1px_#0000000d,0px_20px_48px_#00000024] p-4 gap-2.5">
      <div data-node-label="Card Head" className="flex items-center gap-2"><div data-node-label="Spark" className="size-[14px] block [color:var(--ad-brand)]">${SPARK}</div>${T('Card Title', 'Aira', `${ink} text-[13px] font-semibold`)}${T('Card State', 'Slide 3', `${sub} text-[12px]`)}</div>
      <div data-node-label="Activity" className="flex flex-col gap-2">${step('done', 'Found the point in the data')}${step('now', 'Writing the title as the answer')}</div>
    </div>
  </div>`;
const tldr4 = `<div data-node-label="TLDR" className="flex w-full items-stretch rounded-[18px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_8px_24px_#0000000a]">
    <div data-node-label="TLDR Label" className="flex w-[160px] shrink-0 items-center border-r [border-right-color:var(--paper-gray-200)] px-7 py-4">${T('TLDR Kicker', 'In short', '[color:var(--paper-blue-link)] text-[14px] font-semibold')}</div>
    ${[['Every title states the answer.', 'The title'], ['Every number shows where it came from.', 'The review'], ['It leaves as a PowerPoint you can edit.', 'PowerPoint in and out']].map(([t, ref], j) => `<div data-node-label="TLDR Item" className="flex flex-1 items-start px-7 py-4 gap-3 ${j ? 'border-l [border-left-color:var(--paper-gray-200)]' : ''}">${T('TLDR Number', String(j + 1), '[color:var(--ad-brand)] text-[22px] font-semibold leading-[1] tracking-[-0.5px]')}<div data-node-label="TLDR Body" className="flex flex-col gap-0.5"><span data-node-label="TLDR Text" className="${F} block w-[250px] ${ink} text-[15px] leading-[1.45] font-medium">${t}</span>${T('TLDR Ref', 'See ' + ref, `${sub} text-[12px]`)}</div></div>`).join('')}
  </div>`;
const REWRITES4 = [
  ['Q3 revenue by segment', 'Enterprise carried the quarter', true],
  ['Retention update', 'Mid-market churn is down to 4%', false],
  ['Hiring update', 'Hiring can wait one quarter', false],
  ['Recommendation', 'Keep the growth plan. Review hiring in Q1.', false],
];
const rewriteRows4 = REWRITES4.map(([a, b, on], j) => `<div data-node-label="Rewrite Row" className="flex w-full items-center py-7 ${j ? 'border-t border-[#ffffff14]' : ''}">
    <div data-node-label="Label Side" className="flex w-[420px] shrink-0 flex-col gap-2">${T('Row Tag', 'Label', 'text-[#5B7080] text-[12px] font-medium tracking-[0.5px]')}${struck(a, 'text-[#5B7080] text-[30px] font-medium leading-[1.15] tracking-[-0.6px]', 19)}</div>
    <div data-node-label="Row Arrow" className="flex w-[90px] shrink-0 [color:#4D94FB]">${ic('arrowr', 22)}</div>
    <div data-node-label="Answer Side" className="flex flex-1 flex-col gap-2">${T('Row Tag', on ? 'Answer, written by Aira' : 'Answer', `${on ? 'text-[#93B8EF]' : 'text-[#7F93A6]'} text-[12px] font-medium tracking-[0.5px]`)}<div data-node-label="Answer Wrap" className="flex self-start relative ${on ? 'border border-[#4D94FB] rounded-none' : ''}">${T('Answer Text', b, 'text-white text-[44px] font-semibold leading-[1.1] tracking-[-1.3px]')}${on ? handlesAbs : ''}</div></div>
  </div>`).join('');
const pyramid4 = (() => {
  const top = `<div data-node-label="Governing" className="flex absolute left-[420px] top-[0px] flex-col items-center gap-3">${T('Tier Label', 'The answer', `[color:var(--paper-blue-link)] text-[12px] font-semibold tracking-[0.3px]`)}${mini({ w: 360, n: 1, title: 'Keep the growth plan. Review hiring in Q1.', kind: 'table', rows: [['Revenue, year over year', '+39%'], ['Enterprise share of growth', '66%'], ['Mid-market churn', '4.0%']] })}</div>`;
  const args = [
    ['Growth', 'Enterprise carried the quarter', { kind: 'segl' }, 'Pipeline report, p. 4'],
    ['Quality', 'Mid-market churn is down to 4%', { kind: 'downl' }, 'Retention data, p. 9'],
    ['Capacity', 'Hiring can wait one quarter', { kind: 'capbars', rows: [['Sales', 82], ['Success', 61], ['Product', 79]] }, 'Capacity model, projected Q1 load, p. 2'],
  ];
  const kids = args.map(([tier, t, k, ev], j) => `<div data-node-label="Argument" className="flex absolute top-[320px] flex-col items-center gap-3" style={{left:'${j * 410}px'}}>${T('Tier Label', 'Reason ' + (j + 1) + ': ' + tier, `${sub} text-[12px] font-semibold tracking-[0.3px]`)}${mini({ w: 380, n: [3, 5, 6][j], title: t, ...k })}<div data-node-label="Evidence" className="flex h-8 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] px-3 gap-2">${ic('doc', 13, mut)}${T('Evidence Text', ev, `${mut} text-[12px]`)}</div></div>`).join('');
  const lines = `<div data-node-label="Pyramid Lines" className="flex absolute left-0 top-0 w-[1200px] h-[340px]"><svg viewBox="0 0 1200 340" width="1200" height="340"><path d="M600 245 V285 H190 V325 M600 285 V325 M600 285 H1010 V325" fill="none" stroke="#C1C1C0" strokeWidth="1.5"></path><circle cx="600" cy="285" r="4" fill="#4D94FB"></circle></svg></div>`;
  return `<div data-node-label="Pyramid" className="flex relative w-[1200px] h-[640px]">${lines}${top}${kids}</div>`;
})();
const STORY = ['Keep the growth plan. Review hiring in Q1', 'Revenue grew 39% year over year', 'Enterprise carried the quarter', 'Pipeline covers the Q4 plan 1.4 times', 'Mid-market churn is down to 4%', 'Hiring can wait one quarter', 'Pricing is the one risk to watch', 'Keep the growth plan. Review hiring in Q1'];
const STORY_TEXT = STORY.map((x, j) => String(j + 1).padStart(2, '0') + ' ' + x + '.').join('   ');
const storyPara = `<span data-node-label="Story Paragraph Text" className="${F} block w-[1200px] text-[#71879A] text-[38px] font-semibold leading-[1.4] tracking-[-0.9px]">${STORY_TEXT}</span>`;
const dumpBody4 = (s) => {
  const rows = [['South', '$48M', '+6%'], ['North', '$42M', '+31%'], ['East', '$35M', '+27%'], ['West', '$30M', '+4%'], ['Central', '$18M', '+3%']];
  const W = [130, 100, 90].map(x => Math.round(x * s));
  const f = 11;
  return `<div data-node-label="Dump Table" className="flex flex-1 flex-col pt-1">
    <div data-node-label="Table Head" className="flex border-b-[1.5px] border-[#0F2433] pb-1">${['Region', 'Revenue', 'Growth'].map((h, i) => tCell(h, `[color:var(--deck-navy)] text-[${f}px] font-semibold`, W[i])).join('')}</div>
    ${rows.map(r => `<div data-node-label="Table Row" className="flex border-b border-[#E4E9EE] py-[2px]">${r.map((c, i) => tCell(c, `[color:#3B4B57] text-[${f}px]`, W[i])).join('')}</div>`).join('')}
  </div>`;
};
const insightBody4 = (s) => {
  const W = [86, 76, 66, 110].map(x => Math.round(x * s));
  const f = Math.max(12, Math.round(10 * s));
  const g = Math.round(40 * s);
  return `<div data-node-label="Insight" className="flex flex-1 items-stretch gap-[${Math.round(14 * s)}px] pt-1">
    <div data-node-label="Insight Table" className="flex flex-col">
      <div data-node-label="Table Head" className="flex border-b-[1.5px] border-[#0F2433] pb-1.5 pl-[${g}px]">${['Region', 'Revenue', 'Growth', 'Projected increase'].map((h, i) => tCell(h, `[color:var(--deck-navy)] text-[${f - 1}px] font-semibold`, W[i])).join('')}</div>
      ${REG.map((r, j) => `<div data-node-label="Table Row" className="flex items-center border-b border-[#E4E9EE] py-[${Math.round(5 * s)}px] ${j < 2 ? '[background-color:#EEF4FE]' : ''}"><div data-node-label="Group" className="flex shrink-0 w-[${g}px]">${j === 0 ? T('Group Text', 'Grow', `[color:var(--paper-blue-link)] text-[${f - 2}px] font-semibold pl-1`) : j === 2 ? T('Group Text', 'Hold', `[color:#909090] text-[${f - 2}px] font-semibold pl-1`) : ''}</div>${r.map((c, i) => i === 3 && j < 2
        ? `<div data-node-label="Cell" className="flex shrink-0 w-[${W[i]}px]"><div data-node-label="Circled" className="flex rounded-full border-[1.5px] border-[#4D94FB] px-1.5">${T('Cell Text', c, `[color:var(--deck-navy)] text-[${f}px] font-semibold`)}</div>${T('Ref Mark', '1', '[color:var(--paper-blue-link)] text-[10px] font-semibold pl-1')}</div>`
        : tCell(c, `${j < 2 ? '[color:var(--deck-navy)] font-medium' : '[color:#3B4B57]'} text-[${f}px]`, W[i])).join('')}</div>`).join('')}
      <div data-node-label="Ref Note" className="flex items-start gap-1.5 pt-2 pl-[${g}px]">${T('Ref Mark', '1', '[color:var(--paper-blue-link)] text-[11px] font-semibold')}${T('Ref Text', 'Revenue × current growth rate. Brightwater FY plan, p. 4.', `[color:#666666] text-[12px]`)}</div>
    </div>
    <div data-node-label="Callout" className="flex flex-1 flex-col justify-center rounded-[3px] [background-color:#0F2433] gap-[${Math.round(6 * s)}px]" style={{padding:'${Math.round(14 * s)}px'}}>${T('Callout Kicker', 'SO WHAT', `text-[#93B8EF] text-[${f - 2}px] font-semibold tracking-[1px]`)}${T('Callout Text', 'Fund North and East first', `text-white text-[18px] font-semibold leading-[1.25]`)}${T('Callout Context', '$22.5M of the $27.1M projected increase.', `text-[#A9B8C6] text-[12px] leading-[1.4]`)}</div>
  </div>`;
};
const soWhat4 = (() => {
  const k = 420 / 540;
  const note = (t, x, y) => `<div data-node-label="Pen Note" className="flex absolute px-1 py-1" style={{left:'${Math.round(x * k)}px',top:'${Math.round(y * k)}px'}}>${T('Pen Text', t, 'text-[#C23434] text-[14px] font-semibold italic')}</div>`;
  return `<div data-node-label="So What" className="flex w-full items-start justify-between">
    <div data-node-label="Draft Side" className="flex w-[420px] flex-col gap-4">${exCap('Your draft')}
      <div data-node-label="Draft" className="flex relative">${lSlide({ w: 420, kicker: 'SECTION 2', title: 'Regional results', body: dumpBody4(420 / 640), source: 'FY plan, p. 4', srcPx: 11, kPx: 10 })}
        <div data-node-label="Pen Marks" className="flex absolute left-0 top-0 w-[420px] h-[236px]"><svg viewBox="0 0 540 304" width="420" height="236"><ellipse cx="122" cy="60" rx="112" ry="30" fill="none" stroke="#D93F3F" strokeWidth="3" transform="rotate(-3 128 62)"></ellipse><path d="M300 110 C 340 150, 340 210, 300 250" fill="none" stroke="#D93F3F" strokeWidth="3" strokeLinecap="round"></path></svg></div>
        ${note('So what?', 250, 44)}${note('Which rows matter?', 350, 160)}
      </div></div>
    <div data-node-label="Pen Arrow" className="flex w-[80px] flex-col items-center gap-2 pt-[150px]">${tileG(`<div data-node-label="Spark" className="size-[18px] block">${SPARK}</div>`, 44, 13)}${T('Pen Arrow Text', 'Aira', `${mut} text-[12px] font-medium`)}</div>
    <div data-node-label="Fixed Side" className="flex w-[700px] flex-col gap-4">${exCap('After Aira: Brightwater, sample data')}${lSlide({ w: 700, kicker: 'GROWTH', title: 'North and East bring 83% of next year’s growth', body: insightBody4(700 / 640), source: 'Source: Brightwater FY plan, p. 4. Sample data.', srcPx: 12 })}</div>
  </div>`;
})();
const pptExhibit = `<div data-node-label="PPT Exhibit" className="flex w-full items-start gap-14">
    <div data-node-label="PPT Wrap" className="flex relative">
      <div data-node-label="PPT Window" className="flex w-[820px] flex-col rounded-[14px] bg-white shadow-[0px_0px_0px_1px_#0000000f,0px_24px_56px_#00000017] overflow-clip">
        <div data-node-label="PPT Bar" className="flex h-10 items-center [background-color:#2B2B2B] px-4 gap-2"><div data-node-label="PPT Icon" className="flex size-5 justify-center items-center rounded-[4px] bg-[#0F2433]">${T('PPT Letter', 'P', 'text-white text-[12px] font-bold')}</div>${T('PPT Name', 'Halden Q3 board review.pptx', 'text-white text-[13px] font-medium')}</div>
        <div data-node-label="PPT Ribbon" className="flex flex-col border-b [border-bottom-color:var(--paper-gray-200)] bg-white">
          <div data-node-label="Ribbon Tabs" className="flex items-center px-4 pt-2 gap-5">${['Home', 'Insert', 'Design', 'Transitions', 'Slide Show', 'Chart Design'].map((x, i) => `<div data-node-label="Ribbon Tab" className="flex pb-1.5 ${i === 5 ? 'border-b-2 border-[#222222]' : ''}">${T('Tab Text', x, `${i === 5 ? `${ink} font-semibold` : mut} text-[12px]`)}</div>`).join('')}</div>
          <div data-node-label="Ribbon Tools" className="flex items-center px-4 py-2 gap-2 border-t [border-top-color:var(--paper-gray-100)]">${['Layout: Title and chart', 'Font: Geist', 'Edit data', 'Chart type'].map((x, i) => `<div data-node-label="Ribbon Tool" className="flex h-7 items-center rounded-[5px] px-2.5 ${i < 2 ? 'shadow-[0px_0px_0px_1px_var(--paper-gray-300)]' : '[background-color:var(--paper-gray-100)]'}">${T('Tool Text', x, `${ink} text-[12px]`)}</div>`).join('')}</div>
        </div>
        <div data-node-label="PPT Canvas" className="flex justify-center [background-color:var(--paper-gray-100)] px-8 pt-8 pb-6">${lSlide({ w: 620, kicker: 'REVENUE', title: 'Revenue grew 39% year over year', source: 'Source: Q3 board notes, unaudited. Halden, sample data.', selChart: true, srcPx: 10 })}</div>
        <div data-node-label="PPT Notes" className="flex flex-col border-t [border-top-color:var(--paper-gray-200)] px-6 py-4 gap-1">${T('Notes Label', 'Notes', `${sub} text-[11px] font-semibold`)}${T('Notes Text', 'Open with the answer: Keep the growth plan. Review hiring in Q1.', `${mut} text-[13px]`)}</div>
      </div>
      <div data-node-label="Pin 1" className="flex absolute left-[86px] top-[168px]">${annotDot(1)}</div>
      <div data-node-label="Pin 2" className="flex absolute left-[706px] top-[300px]">${annotDot(2)}</div>
      <div data-node-label="Pin 3" className="flex absolute left-[-14px] top-[92px]">${annotDot(3)}</div>
      <div data-node-label="Pin 4" className="flex absolute left-[-14px] top-[560px]">${annotDot(4)}</div>
    </div>
    <div data-node-label="PPT Notes List" className="flex flex-1 flex-col">${noteRow(1, 'Titles stay text', 'Edit the words in PowerPoint. Nothing is an image.')}${noteRow(2, 'Charts stay charts', 'Change a number and the bar moves.')}${noteRow(3, 'Your master and fonts', 'Layouts, colors and fonts come from your template.')}${noteRow(4, 'Speaker notes kept', 'What you plan to say travels with the slide.')}</div>
  </div>`;
const monoTile = (logo, name) => `<div data-node-label="${name} Tile" className="flex size-10 justify-center items-center rounded-[11px] [background-color:#222222] text-white"><div data-node-label="${name} Logo" className="size-[20px] block">${logo}</div></div>`;
const agentItem = (tile, name, line) => `<div data-node-label="Agent Item" className="flex flex-1 items-center gap-4 px-6 py-6">${tile}<div data-node-label="Agent Text" className="flex flex-col gap-1">${T('Agent Name', name, `${ink} text-[16px] font-semibold`)}${T('Agent Line', line, `${mut} text-[14px]`)}</div></div>`;
const agentsRow = `<div data-node-label="Agents Row" className="flex w-full flex-col rounded-[18px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_8px_24px_#0000000a]">
    <div data-node-label="Agents Items" className="flex w-full items-stretch">${agentItem(airaTile.replace('size-11', 'size-10'), 'Aira', 'Built in. Ready when you sign in.')}<div data-node-label="Divider" className="w-px block [background-color:var(--paper-gray-200)]"></div>${agentItem(monoTile(CLAUDE, 'Claude'), 'Claude', 'Connect once from claude.ai.')}<div data-node-label="Divider" className="w-px block [background-color:var(--paper-gray-200)]"></div>${agentItem(monoTile(OPENAI, 'Codex'), 'Codex', 'Connect from Codex on this computer.')}</div>
    <div data-node-label="Agents Foot" className="flex w-full items-center justify-between border-t [border-top-color:var(--paper-gray-200)] px-6 py-4">${T('Agents Foot Text', 'Same editor, same rules, whichever agent does the work.', `${mut} text-[14px]`)}${T('Guide Link', 'Read the setup guides', '[color:var(--paper-blue-link)] text-[14px] font-medium')}</div>
  </div>`;
const caretField = `<div data-node-label="Answer Field" className="flex w-[640px] items-center justify-between rounded-[10px] bg-white shadow-[0px_0px_0px_1px_#ffffff26,0px_24px_64px_#00000066] pl-9 pr-4 py-6 gap-6">
    <div data-node-label="Field Text" className="flex flex-col gap-2">${T('Field Kicker', 'NEXT STEP', '[color:var(--deck-teal)] text-[11px] font-semibold tracking-[1px]')}<div data-node-label="Field Line" className="flex items-center gap-1">${T('Field Placeholder', 'Your answer goes here', 'text-[#A9B3BC] text-[30px] font-semibold tracking-[-0.6px]')}<div data-node-label="Caret" className="block w-[2px] h-[34px] [background-color:#4D94FB]"></div></div></div>
  </div>`;
const landing4 = `<div data-node-id="ed39" data-node-label="S11.01 Discover / Landing / Default" className="flex w-[${LW}px] flex-col bg-white [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  <div data-node-label="Nav" className="flex h-[76px] items-center justify-between px-[120px]">
    <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[24px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[17px] font-semibold tracking-[-0.3px]`)}</div>
    <div data-node-label="Nav Links" className="flex items-center gap-8">${['The method', 'PowerPoint', 'Agents', 'Pricing'].map(x => T('Nav Link', x, `${mut} text-[14px]`)).join('')}</div>
    <div data-node-label="Nav Actions" className="flex items-center gap-5">${T('Nav Sign In', 'Sign in', `${ink} text-[14px] font-medium`)}${lBtn('Start free', 'primary', false, 38)}</div>
  </div>
  <div data-node-label="Hero" className="flex w-full flex-col pl-[120px] pr-[30px] pt-[56px] pb-[88px] gap-16 [background-image:radial-gradient(circle_at_76%_42%,#E6EFFD_0%,#FFFFFF_55%)]">
    <div data-node-label="Hero Row" className="flex w-full items-center justify-between">
      <div data-node-label="Hero Text" className="flex w-[560px] flex-col gap-7">
        <div data-node-label="Hero Headline" className="flex flex-col">${['Win the room', 'before you', 'walk in.'].map(l => T('Headline Line', l, `${ink} text-[88px] font-semibold leading-[0.98] tracking-[-3.4px]`)).join('')}</div>
        <span data-node-label="Hero Sub" className="${F} block w-[500px] ${mut} text-[19px] leading-[1.5]">Aira writes every title as the answer, keeps one point per slide and sources every number. You make the call.</span>
        <div data-node-label="Hero Actions" className="flex items-center gap-3 pt-1">${lBtn('Start free')}${lBtn('Import a PowerPoint', 'secondary')}</div>
        <div data-node-label="Hero Notes" className="flex items-center gap-5">${T('Hero Note', 'Free with weekly usage', `${sub} text-[13px]`)}<div data-node-label="Divider" className="w-px h-3.5 block [background-color:var(--paper-gray-300)]"></div>${T('Own Agent Text', 'Works with Claude and Codex', `${ink} text-[13px] font-medium`)}</div>
      </div>
      ${heroSlide}
    </div>
    <div data-node-label="TLDR Wrap" className="flex w-[1200px]">${tldr4}</div>
  </div>
  ${dark('Rewrite Section', `${head(2, 'The title', ['Nobody reads a label.', 'Everyone reads an answer.'], 'Executives read the title, then decide whether to keep listening. Aira writes every title as the point, so the first ten seconds carry the case.', { dark: true, leadW: 400 })}<div data-node-label="Rewrites" className="flex w-full flex-col">${rewriteRows4}</div><div data-node-label="Rewrite Note" className="flex w-full pt-6">${exCap('From the Halden Q3 board review. Sample data.', true)}</div>`)}
  ${section('Pyramid Section', `${head(3, 'The method', ['Answer first. Three reasons.', 'Then the proof.'], 'You work from the evidence up. The board hears it from the answer down. Aira builds the deck in that order, and cuts what does not hold the argument.')}${pyramid4}`, '[background-color:#F5F5F2]')}
  ${dark('Story Section', `${head(4, 'The storyline', ['Read only the titles.', 'The case still holds.'], 'Hide every chart and every bullet. If the titles alone make the argument, the deck is ready. Aira checks this on every deck it builds.', { dark: true, leadW: 400 })}${storyPara}<div data-node-label="Story Note" className="flex w-full pt-10">${exCap('Halden, Q3 board review, eight slides. Sample data.', true)}</div>`)}
  ${section('So What Section', `${head(5, 'The review', 'Data in. A decision out.', 'A table is not a point of view. Aira finds the rows that matter, puts the numbers in context and says what to do.')}${soWhat4}`, 'bg-white')}
  ${section('PowerPoint Section', `${head(6, 'PowerPoint in and out', ['Your deck stays', 'a real PowerPoint.'], 'Import a .pptx and keep its layouts, fonts and notes. Export it back and edit anything in PowerPoint.')}${pptExhibit}`, '[background-color:#F5F5F2]')}
  ${section('Agents Section', `${head(7, 'Agents', 'Aira is built in. Or bring your own.', 'Connect Claude or Codex over MCP. Their edits land in the same editor, under the same rules.')}${agentsRow}`, 'bg-white')}
  <div data-node-label="Final Section" className="flex w-full flex-col items-center relative" style={{backgroundColor:'${NAVY}'}}>
    <div data-node-label="Dither Band" className="flex absolute left-0 top-0 w-full h-[440px] [background-image:radial-gradient(circle_at_50%_0%,#1D4A7A_0%,${NAVY}_70%)]"></div>
    <div data-node-label="Final Body" className="flex w-full flex-col items-center px-[120px] pt-[190px] pb-[140px] gap-7">
      ${caretField}
      ${T('Final Title', 'Your next deck has to win.', 'text-white text-[64px] font-semibold leading-[1.05] tracking-[-2px] pt-8')}
      <span data-node-label="Final Lead" className="${F} block w-[560px] text-center text-[#A9B8C6] text-[18px] leading-[1.55]">Free with weekly usage. A reset is $5 when you need more. Your decks stay private to you.</span>
      <div data-node-label="Final Actions" className="flex items-center gap-3 pt-2">${lBtn('Start free')}<div data-node-label="Ghost Button" className="flex h-[44px] items-center rounded-[10px] border border-[#ffffff40] px-5">${T('Ghost Label', 'Import a PowerPoint', 'text-white text-[15px] font-medium')}</div></div>
    </div>
  </div>
  <div data-node-label="Footer" className="flex w-full items-center justify-between px-[120px] py-10 border-t border-[#ffffff14]" style={{backgroundColor:'${NAVY}'}}>
    <div data-node-label="Footer Brand" className="flex items-center gap-2.5">${T('Footer Name', 'AirDesign', 'text-white text-[14px] font-semibold')}${T('Footer Line', 'Slides for decisions.', 'text-[#7F93A6] text-[14px]')}</div>
    <div data-node-label="Footer Links" className="flex items-center gap-7">${['Pricing', 'Agent guides', 'Sign in', 'Privacy', 'Terms'].map(x => T('Footer Link', x, 'text-[#A9B8C6] text-[13px]')).join('')}</div>
  </div>
</div>`;

// ---------- Landing v5: MBB-grade sample slides ----------
const NV = '#0F2433', TEAL = '#1B6B8F', MIST = '#A9BFCF', INK2 = '#3B4B57';
const mbb = ({ wasBig = '', titlePx = 0, w = 680, tracker = ['Context', 'Growth', 'Quality', 'Capacity', 'Decision'], active = 1, title, unit, body, foot = '', source, page = 3, sticker = 'Sample data', glow = false, selTitle = false, was = '' }) => {
  const s = w / 680, px = (n, min = 9) => Math.max(min, Math.round(n * s));
  const trk = `<div data-node-label="Tracker" className="flex items-center gap-[${px(4, 3)}px]">${tracker.map((x, i) => `<div data-node-label="Tracker Item" className="flex items-center px-[${px(6, 4)}px] h-[${px(16, 12)}px] ${i === active ? `[background-color:${NV}]` : '[background-color:#EEF1F4]'}">${T('Tracker Text', x, `${i === active ? 'text-white' : `[color:#7B8A96]`} text-[${px(8, 7)}px] font-semibold tracking-[0.4px]`)}</div>`).join('')}</div>`;
  const stk = `<div data-node-label="Sticker" className="flex items-center border border-[#9AA7B2] px-[${px(6, 4)}px] h-[${px(16, 12)}px]">${T('Sticker Text', sticker.toUpperCase(), `[color:#5B6B77] text-[${px(8, 7)}px] font-semibold tracking-[0.6px]`)}</div>`;
  const titleEl = `<div data-node-label="Slide Title Wrap" className="flex flex-col self-start relative ${selTitle ? 'shadow-[0px_0px_0px_1px_#4D94FB]' : ''}">${was ? `<div data-node-label="Was Tag" className="flex absolute right-[6px] top-[4px] h-6 items-center rounded-[6px] bg-white shadow-[0px_0px_0px_1px_#EAEAE7,0px_2px_6px_#0000000f] px-2 gap-1.5">${T('Was Label', 'Was', `${sub} text-[11px] font-medium`)}<div data-node-label="Was Struck" className="flex relative">${T('Was Text', was, `${mut} text-[11px]`)}<div data-node-label="Strike" className="flex absolute left-0 top-[7px] w-full h-px [background-color:var(--paper-gray-500)]"></div></div></div>` : ''}${T('Slide Headline', title, `[color:${NV}] text-[${titlePx || px(23, 10)}px] font-semibold leading-[1.15] tracking-[-0.4px]`)}</div>`;
  const wasEl = wasBig ? struck(wasBig, 'text-[#9AA5B1] text-[20px] font-medium tracking-[-0.3px]', 13) : '';
  const el = `<div data-node-label="MBB Slide" className="flex w-[${w}px] h-[${Math.round(w * 9 / 16)}px] shrink-0 flex-col bg-white rounded-[${glow ? 4 : 3}px] ${glow ? '' : 'shadow-[0px_0px_0px_1px_#0000000f,0px_8px_24px_#0000000d]'}" style={{padding:'${px(20, 8)}px ${px(30, 12)}px ${px(14, 6)}px'}}>
      <div data-node-label="Slide Top" className="flex w-full items-center justify-between pb-[${px(14, 6)}px]">${trk}${stk}</div>
      ${wasEl}${titleEl}
      ${T('Unit Line', unit, `[color:#6B7A86] text-[${px(11, 8)}px] pt-[${px(4, 2)}px]`)}
      <div data-node-label="Exhibit" className="flex flex-1 flex-col pt-[${px(10, 4)}px]">${body}</div>
      <div data-node-label="Slide Foot" className="flex w-full items-end justify-between border-t border-[#E1E6EA] pt-[${px(6, 3)}px] gap-4"><div data-node-label="Foot Text" className="flex flex-col gap-[1px]">${foot ? T('Footnote', foot, `[color:#7B8A96] text-[${px(8.5, 7)}px]`) : ''}${T('Source', source, `[color:#7B8A96] text-[${px(8.5, 7)}px]`)}</div>${T('Page Number', String(page), `[color:#7B8A96] text-[${px(8.5, 7)}px] font-medium`)}</div>
    </div>`;
  return glow ? `<div data-node-label="Working Glow" className="flex shrink-0 p-[2px] rounded-[6px] [background-image:linear-gradient(135deg,#4D94FB_0%,#A9C8FF_35%,#B9A8FF_65%,#4D94FB_100%)] shadow-[0px_0px_32px_#4d94fb59,-20px_-14px_64px_#93b8ef47,20px_16px_64px_#b39dff47]">${el}</div>` : el;
};
// waterfall bridge Q3 24 -> Q3 25
const waterfall = (s = 1) => {
  const px = (n, min = 9) => Math.max(min, Math.round(n * s));
  const H = Math.round(150 * s), k = H / 5.7;
  const cols = [['Q3 24', 0, 4.1, 'total', '$4.1M'], ['Enterprise', 4.1, 1.06, 'accent', '+$1.06M'], ['Mid-market', 5.16, 0.35, 'ctx', '+$0.35M'], ['Self-serve', 5.51, 0.19, 'ctx', '+$0.19M'], ['Q3 25', 0, 5.7, 'total', '$5.7M']];
  const col = ([lab, base, v, kind, txt], i) => `<div data-node-label="WF Column" className="flex flex-1 flex-col items-center">
      <div data-node-label="WF Plot" className="flex w-full flex-col items-center justify-end relative" style={{height:'${H + px(40)}px'}}>
        ${kind === 'accent' ? `<div data-node-label="WF Callout" className="flex flex-col items-center pb-[${px(4, 2)}px]"><div data-node-label="Callout Bubble" className="flex items-center rounded-full border border-[${TEAL}] bg-white px-[${px(6, 4)}px] h-[${px(16, 12)}px]">${T('Callout Text', '66% of growth', `[color:${TEAL}] text-[${px(9, 8)}px] font-semibold`)}</div><div data-node-label="Callout Stem" className="block w-px h-[${px(8, 4)}px] [background-color:${TEAL}]"></div></div>` : ''}
        ${T('WF Value', txt, `[color:${NV}] text-[${px(10.5, 8)}px] ${kind !== 'ctx' ? 'font-semibold' : ''} pb-[${px(3, 2)}px]`)}
        <div data-node-label="WF Bar" className="flex relative w-[${px(58, 14)}px]" style={{height:'${Math.max(2, Math.round(v * k))}px',backgroundColor:'${kind === 'total' ? NV : kind === 'accent' ? TEAL : MIST}'}}>${i < 4 ? `<div data-node-label="WF Connector" className="flex absolute left-full top-0 h-0 border-t border-dashed border-[#9AA7B2]" style={{width:'${Math.round((620 * s / 0.92 - 4 * px(10, 3)) / 5 - px(58, 14) + px(10, 3))}px'}}></div>` : ''}</div>
        <div data-node-label="WF Base" className="block w-[${px(58, 14)}px]" style={{height:'${Math.round(base * k)}px'}}></div>

      </div>
      <div data-node-label="WF Axis" className="flex w-full justify-center border-t border-[#C9D1D8] pt-[${px(5, 2)}px]">${T('WF Label', i === 1 ? lab + '¹' : lab, `[color:${i === 1 ? NV : INK2}] text-[${px(10, 8)}px] ${i === 1 ? 'font-semibold' : ''}`)}</div>
    </div>`;
  return `<div data-node-label="Waterfall" className="flex flex-1 flex-col"><div data-node-label="WF Row" className="flex w-full items-end gap-[${px(10, 3)}px] relative">${cols.map(col).join('')}</div></div>`;
};
const heroSlide5 = `<div data-node-label="Hero Exhibit" className="flex relative w-[700px] h-[520px] shrink-0">
    <div data-node-label="Hero Slide" className="flex absolute left-[10px] top-[56px]">${mbb({ w: 680, active: 1, title: 'Enterprise carried the quarter', titlePx: 32, wasBig: 'Q3 revenue by segment', unit: 'Revenue bridge by segment, Q3 24 to Q3 25, $M', body: waterfall(0.92), foot: '1. Recognized revenue, split by account segment.', source: 'Source: Halden CRM, Q3 pipeline report; Halden analysis. Sample data.', page: 3, glow: true, selTitle: true })}</div>
    <div data-node-label="Hero Caption" className="flex absolute left-[10px] top-[0px]">${exCap('Sample deck: Halden, Q3 board review')}</div>
    <div data-node-label="Aira Card" className="flex absolute left-[440px] top-[452px] w-[250px] flex-col rounded-[14px] bg-white shadow-[0px_0px_0px_1px_#0000000d,0px_20px_48px_#00000024] p-4 gap-2.5">
      <div data-node-label="Card Head" className="flex items-center gap-2"><div data-node-label="Spark" className="size-[14px] block [color:var(--ad-brand)]">${SPARK}</div>${T('Card Title', 'Aira', `${ink} text-[13px] font-semibold`)}${T('Card State', 'Slide 3', `${sub} text-[12px]`)}</div>
      <div data-node-label="Activity" className="flex flex-col gap-2">${step('done', 'Found the point in the data')}${step('now', 'Writing the title as the answer')}</div>
    </div>
  </div>`;
// bar-in-table result slide
const insight5 = (s = 1) => {
  const px = (n, min = 11) => Math.max(min, Math.round(n * s));
  const max = 13;
  const W = [72, 62, 54].map(x => Math.round(x * s)), bw = Math.round(150 * s);
  return `<div data-node-label="Insight" className="flex flex-1 items-stretch gap-[${Math.round(16 * s)}px]">
    <div data-node-label="Insight Table" className="flex flex-col">
      <div data-node-label="Table Head" className="flex items-end border-b-[1.5px] border-[${NV}] pb-1">${['Region', 'Revenue', 'Growth'].map((h, i) => tCell(h, `[color:${NV}] text-[${px(9)}px] font-semibold`, W[i])).join('')}<div data-node-label="Cell" className="flex shrink-0 w-[${bw + 48}px]">${T('Cell Text', 'Projected increase¹, $M', `[color:${NV}] text-[${px(9)}px] font-semibold`)}</div></div>
      ${REG.map((r, j) => `<div data-node-label="Table Row" className="flex items-center border-b border-[#E4E9EE] py-[${Math.round(5 * s)}px]">${tCell(r[0], `[color:${NV}] text-[${px(10)}px] ${j < 2 ? 'font-semibold' : ''}`, W[0])}${tCell(r[1], `[color:${INK2}] text-[${px(10)}px]`, W[1])}${tCell(r[2], `[color:${INK2}] text-[${px(10)}px]`, W[2])}<div data-node-label="Bar Cell" className="flex items-center shrink-0 w-[${bw + 48}px] gap-1.5"><div data-node-label="Cell Bar" className="block h-[${px(10, 8)}px]" style={{width:'${Math.max(3, Math.round(parseFloat(r[3].slice(1)) / max * bw))}px',backgroundColor:'${j < 2 ? TEAL : MIST}'}}></div>${T('Cell Text', r[3].replace('M', ''), `[color:${NV}] text-[${px(10)}px] ${j < 2 ? 'font-semibold' : ''}`)}</div></div>`).join('')}
      <div data-node-label="Group Bracket" className="flex items-center gap-2 pt-2">${T('Bracket Text', 'North and East: $22.5M of $27.1M', `[color:${TEAL}] text-[${px(10)}px] font-semibold`)}</div>
    </div>
    <div data-node-label="Takeaway" className="flex flex-1 flex-col justify-center [background-color:${NV}] gap-[${Math.round(6 * s)}px]" style={{padding:'${Math.round(14 * s)}px'}}>${T('Takeaway Kicker', 'SO WHAT', `text-[#93B8EF] text-[12px] font-semibold tracking-[1px]`)}${T('Takeaway Number', '$22.5M', 'text-white text-[38px] font-semibold leading-[1] tracking-[-1px]')}${T('Takeaway Context', 'of the $27.1M projected increase', 'text-[#A9B8C6] text-[13px] leading-[1.4]')}${T('Takeaway Text', 'Prioritize North and East in planning', 'text-white text-[15px] font-semibold leading-[1.25] pt-2')}</div>
  </div>`;
};
// column chart with growth arrow
const growthCols = (s = 1) => {
  const px = (n, min = 9) => Math.max(min, Math.round(n * s));
  const H = Math.round(96 * s), k = H / 5.7;
  return `<div data-node-label="Growth Chart" className="flex flex-col relative border border-[#4D94FB] rounded-none px-3 pt-2">${handlesAbs}
    <div data-node-label="Arrow Row" className="flex w-full items-center justify-center pb-1"><div data-node-label="Growth Pill" className="flex items-center rounded-full [background-color:${NV}] px-[${px(8, 4)}px] h-[${px(18, 12)}px]">${T('Pill Text', '+39%', `text-white text-[${px(9.5, 8)}px] font-semibold`)}</div></div>
    <div data-node-label="Arrow Line" className="flex w-full pl-[${Math.round(50 * s)}px] pb-1"><svg viewBox="0 0 400 14" preserveAspectRatio="none" width="${Math.round(494 * s)}" height="${px(14, 8)}"><path d="M4 12 V4 H396 V12" fill="none" stroke="${NV}" strokeWidth="1.2"></path><path d="M392 8 L396 13 L400 8" fill="none" stroke="${NV}" strokeWidth="1.2"></path></svg></div>
    <div data-node-label="Cols" className="flex items-end gap-[${px(22, 6)}px]">${BARS.map(([q, v], j) => `<div data-node-label="Col" className="flex flex-1 flex-col items-center gap-[${px(3, 2)}px]">${T('Col Value', '$' + v + 'M', `[color:${NV}] text-[${px(10.5, 8)}px] ${j === 4 ? 'font-semibold' : ''}`)}<div data-node-label="Col Bar" className="block w-full" style={{height:'${Math.round(v * k)}px',backgroundColor:'${j === 4 ? NV : MIST}'}}></div>${T('Col Label', q, `[color:${INK2}] text-[${px(9.5, 8)}px]`)}</div>`).join('')}</div>
  </div>`;
};
const s5 = landing4;
let landing5 = s5.replace(heroSlide, heroSlide5);
landing5 = landing5.replace(lSlide({ w: 700, kicker: 'GROWTH', title: 'North and East bring 83% of next year’s growth', body: insightBody4(700 / 640), source: 'Source: Brightwater FY plan, p. 4. Sample data.', srcPx: 12 }),
  mbb({ w: 700, tracker: ['Context', 'Regions', 'Plan', 'Risks'], active: 1, title: 'North and East bring 83% of next year’s growth', unit: 'Revenue, growth and projected increase by region, FY plan', body: insight5(700 / 680), foot: '1. Revenue × current growth rate.', source: 'Source: Brightwater FY plan, p. 4; Brightwater analysis. Sample data.', page: 12 }));
landing5 = landing5.replace(lSlide({ w: 620, kicker: 'REVENUE', title: 'Revenue grew 39% year over year', source: 'Source: Q3 board notes, unaudited. Halden, sample data.', selChart: true, srcPx: 10 }),
  mbb({ w: 620, active: 1, title: 'Revenue grew 39% year over year', unit: 'Quarterly revenue, Q3 24 to Q3 25, $M', body: growthCols(620 / 680), source: 'Source: Q3 board notes, unaudited; Halden analysis. Sample data.', page: 2 }));
if (landing5 === s5) throw new Error('no replacement');

// ---------- Landing v6: elite elements ----------
const cursorFlag = (label = 'Aira') => `<div data-node-label="Aira Cursor" className="flex items-start">
    <div data-node-label="Cursor Arrow" className="size-[18px] block"><svg viewBox="0 0 18 18" width="18" height="18"><path d="M2 1.5 L15.5 8.2 L9.2 9.6 L6.4 15.8 Z" fill="#4D94FB" stroke="#FFFFFF" strokeWidth="1.4" strokeLinejoin="round"></path></svg></div>
    <div data-node-label="Cursor Tag" className="flex h-[22px] items-center rounded-[7px] [background-image:linear-gradient(180deg,#93B8EF_0%,#4D94FB_100%)] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_#2D6FCD,0px_6px_16px_#4d94fb59] mt-[12px] ml-[-2px] pl-1.5 pr-2 gap-1"><div data-node-label="Tag Spark" className="size-[10px] block text-white">${SPARK}</div>${T('Cursor Name', label, 'text-white text-[11px] font-semibold')}</div>
  </div>`;
const navPill = `<div data-node-label="Nav Wrap" className="flex w-full justify-center pt-4 px-[120px]">
    <div data-node-label="Nav Pill" className="flex w-full h-[60px] items-center justify-between rounded-[18px] bg-[#FFFFFFB8] shadow-[0px_0px_0px_1px_#0000000d,0px_10px_30px_#0f24330f,inset_0px_1px_0px_#ffffff] pl-5 pr-2.5">
      <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[24px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[17px] font-semibold tracking-[-0.3px]`)}</div>
      <div data-node-label="Nav Links" className="flex items-center gap-8">${['The method', 'PowerPoint', 'Agents', 'Pricing'].map(x => T('Nav Link', x, `${mut} text-[14px]`)).join('')}</div>
      <div data-node-label="Nav Actions" className="flex items-center gap-4">${T('Nav Sign In', 'Sign in', `${ink} text-[14px] font-medium`)}${lBtn('Start free', 'primary', false, 40)}</div>
    </div>
  </div>`;
const wordmark = `<div data-node-label="Wordmark Band" className="flex w-full h-[230px] justify-center overflow-clip relative" style={{backgroundColor:'${NAVY}'}}>
    <div data-node-label="Wordmark" className="flex absolute left-[60px] top-[-10px]">${T('Wordmark Text', 'AirDesign', 'text-[#ffffff0f] text-[300px] font-semibold leading-[1] tracking-[-14px]')}</div>
  </div>`;
let landing6 = landing5;
const navStart = landing6.indexOf('<div data-node-label="Nav" className="flex h-[76px]');
const navEnd = landing6.indexOf('<div data-node-label="Hero"');
landing6 = landing6.slice(0, navStart) + navPill + '\n  ' + landing6.slice(navEnd);
landing6 = landing6.replace('<div data-node-label="Hero" className="flex w-full flex-col pl-[120px] pr-[30px] pt-[56px] pb-[88px] gap-16 [background-image:radial-gradient(circle_at_76%_42%,#E6EFFD_0%,#FFFFFF_55%)]">', '<div data-node-label="Hero" className="flex w-full flex-col pl-[120px] pr-[30px] pt-[48px] pb-[88px] gap-16 [background-image:radial-gradient(circle_at_76%_42%,#E6EFFD_0%,#FFFFFF_55%)]">');
// cursor flags
landing6 = landing6.replace('<div data-node-label="Hero Caption" className="flex absolute left-[10px] top-[0px]">', `<div data-node-label="Hero Cursor" className="flex absolute left-[612px] top-[150px]">${cursorFlag('Aira')}</div><div data-node-label="Hero Caption" className="flex absolute left-[10px] top-[0px]">`);

// footer wordmark
const footStart = landing6.indexOf('<div data-node-label="Footer"');
landing6 = landing6.slice(0, footStart) + landing6.slice(footStart).replace(/<\/div>\n<\/div>$/, `</div>\n  ${wordmark}\n</div>`);
if (!landing6.includes('Wordmark Band') || !landing6.includes('Hero Cursor')) throw new Error('v6 replace failed');

// ---------- Landing v10: elite hero, bento, shader seams ----------
const DEEP = '#0A1824';
const navDark = `<div data-node-label="Nav Wrap" className="flex w-full justify-center pt-4 px-[120px]">
    <div data-node-label="Nav Pill" className="flex w-full h-[60px] items-center justify-between rounded-[18px] bg-[#ffffff0d] shadow-[0px_0px_0px_1px_#ffffff1f,inset_0px_1px_0px_#ffffff14] pl-5 pr-2.5">
      <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[24px] block text-white">${MARK}</div>${T('Brand Name', 'AirDesign', 'text-white text-[17px] font-semibold tracking-[-0.3px]')}</div>
      <div data-node-label="Nav Links" className="flex items-center gap-8">${['The method', 'PowerPoint', 'Agents', 'Pricing'].map(x => T('Nav Link', x, 'text-[#A9B8C6] text-[14px]')).join('')}</div>
      <div data-node-label="Nav Actions" className="flex items-center gap-4">${T('Nav Sign In', 'Sign in', 'text-white text-[14px] font-medium')}${lBtn('Start free', 'primary', false, 40)}</div>
    </div>
  </div>`;
const glassBtn = (t) => `<div data-node-label="Glass Button" className="flex h-[48px] items-center rounded-[12px] bg-[#ffffff12] shadow-[0px_0px_0px_1px_#ffffff2e,inset_0px_1px_0px_#ffffff1f] px-6">${T('Glass Label', t, 'text-white text-[15px] font-medium')}</div>`;
const bigBtn = (t) => lBtn(t).replace('h-[44px]', 'h-[48px]');
const announce = `<div data-node-label="Announce" className="flex h-9 items-center rounded-full bg-[#ffffff0f] shadow-[0px_0px_0px_1px_#ffffff26] pl-1.5 pr-4 gap-2.5"><div data-node-label="Announce Tag" className="flex h-6 items-center rounded-full [background-image:linear-gradient(180deg,#93B8EF_0%,#4D94FB_100%)] px-2.5 gap-1.5"><div data-node-label="Spark" className="size-[11px] block text-white">${SPARK}</div>${T('Tag Text', 'Aira', 'text-white text-[12px] font-semibold')}</div>${T('Announce Text', 'The agent that writes the answer before the slide', 'text-[#C9D4DE] text-[13px]')}${ic('arrowr', 13, 'text-[#93B8EF]')}</div>`;
const frame10 = `<div data-node-label="Product Frame" className="flex w-[1120px] flex-col rounded-[18px] bg-white shadow-[0px_0px_0px_1px_#ffffff1f,0px_40px_120px_#00000080,0px_0px_80px_#4d94fb33] overflow-clip">
    <div data-node-label="Frame Bar" className="flex h-11 items-center border-b [border-bottom-color:var(--paper-gray-100)] px-4 gap-3">
      <div data-node-label="Mark" className="size-[18px] block">${MARK}</div>${T('Frame Deck', 'Halden Q3 board review', `${ink} text-[13px] font-medium`)}${T('Frame Saved', 'Saved', `${sub} text-[12px]`)}<div data-node-label="Grow" className="flex-1 block"></div>
      <div data-node-label="Frame Export" className="flex h-7 items-center rounded-[7px] [background-image:linear-gradient(180deg,_var(--paper-button-top)_0%,_var(--ad-brand)_100%)] shadow-[inset_0px_1px_0px_#ffffff59,0px_0px_0px_1px_var(--ad-brand-strong)] px-3">${T('Export Label', 'Export', 'text-white text-[12px] font-medium')}</div>
    </div>
    <div data-node-label="Frame Body" className="flex h-[540px]">
      <div data-node-label="Frame Canvas" className="flex flex-1 justify-center items-center relative [background-color:var(--paper-gray-50)]">${mbb({ w: 720, active: 1, title: 'Enterprise carried the quarter', titlePx: 33, wasBig: 'Q3 revenue by segment', unit: 'Revenue bridge by segment, Q3 24 to Q3 25, $M', body: waterfall(0.98), foot: '1. Recognized revenue, split by account segment.', source: 'Source: Halden CRM, Q3 pipeline report; Halden analysis. Sample data.', page: 3, glow: true, selTitle: true })}
        <div data-node-label="Frame Cursor" className="flex absolute left-[566px] top-[150px]">${cursorFlag('Aira')}</div>
      </div>
      <div data-node-label="Frame Panel" className="flex w-[300px] flex-col border-l [border-left-color:var(--paper-gray-100)] p-4 gap-4">
        <div data-node-label="Panel Head" className="flex items-center gap-2"><div data-node-label="Spark" className="size-[14px] block [color:var(--ad-brand)]">${SPARK}</div>${T('Panel Title', 'Aira', `${ink} text-[13px] font-semibold`)}</div>
        <div data-node-label="Person Bubble" className="flex self-end [background-color:var(--paper-gray-100)] rounded-[12px] px-3 py-2.5">${T('Person Text', 'Turn the Q3 notes into a board recommendation. Lead with the answer.', `${ink} text-[13px] leading-[1.5] w-[220px]`)}</div>
        <div data-node-label="Activity" className="flex flex-col gap-2.5">${step('done', 'Read Q3 board notes and CRM export')}${step('done', 'Framed the answer and three reasons')}${step('done', 'Built 8 slides, every number sourced')}${step('now', 'Writing the title on slide 3')}</div>
        <div data-node-label="Grow" className="flex-1 block"></div>
        <div data-node-label="Composer" className="flex h-11 items-center rounded-[12px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200)] px-3 gap-2"><div data-node-label="Context Chip" className="flex h-6 items-center rounded-[6px] [background-color:var(--paper-gray-100)] px-2">${T('Chip Label', 'Slide 3', `${mut} text-[12px]`)}</div>${T('Composer Hint', 'Add to the request', `${sub} text-[13px]`)}</div>
      </div>
    </div>
  </div>`;
const hero10 = `<div data-node-label="Hero" className="flex w-full flex-col items-center relative">
    <div data-node-label="Hero Light" className="flex absolute left-0 top-0 w-full h-[1060px]"></div>
    <div data-node-label="Hero Horizon" className="flex absolute left-0 top-[700px] w-full h-[260px]"></div>
    <div data-node-label="Hero Content" className="flex w-full flex-col items-center pt-[96px] gap-8">
      ${announce}
      <div data-node-label="Hero Headline" className="flex flex-col items-center">${T('Headline Line', 'Win the room', 'text-white text-[104px] font-semibold leading-[0.98] tracking-[-4.4px]')}${T('Headline Line Accent', 'before you walk in.', 'text-white text-[104px] font-semibold leading-[0.98] tracking-[-4.4px]')}</div>
      <span data-node-label="Hero Sub" className="${F} block w-[620px] text-center text-[#A9B8C6] text-[20px] leading-[1.5]">Aira turns your notes into a board deck that leads with the answer, sources every number and opens in PowerPoint. You make the call.</span>
      <div data-node-label="Hero Actions" className="flex items-center gap-3 pt-1">${bigBtn('Start free')}${glassBtn('Import a PowerPoint')}</div>
      <div data-node-label="Hero Notes" className="flex items-center gap-5">${T('Hero Note', 'Free with weekly usage', 'text-[#7F93A6] text-[13px]')}<div data-node-label="Divider" className="w-px h-3.5 block bg-[#ffffff26]"></div><div data-node-label="Own Agent Link" className="flex items-center gap-2"><div data-node-label="Mini Claude" className="size-[14px] block text-[#C9D4DE]">${CLAUDE}</div><div data-node-label="Mini OpenAI" className="size-[14px] block text-[#C9D4DE]">${OPENAI}</div>${T('Own Agent Text', 'Works with Claude and Codex', 'text-[#C9D4DE] text-[13px] font-medium')}</div></div>
      <div data-node-label="Frame Wrap" className="flex pt-14">${frame10}</div>
    </div>
  </div>`;
const bentoTile = (label, inner, w, dark = false) => `<div data-node-label="${label}" className="flex flex-col justify-between rounded-[22px] ${dark ? `[background-color:${NAVY}] shadow-[0px_0px_0px_1px_#ffffff14]` : 'bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_10px_30px_#0f24330a]'} overflow-clip relative h-[320px] w-[${w}px] shrink-0">${inner}</div>`;
const tileText = (n, t, b, dark = false) => `<div data-node-label="Tile Text" className="flex w-[330px] shrink-0 flex-col gap-2 p-7">${T('Tile Number', n, `${dark ? 'text-[#93B8EF]' : '[color:var(--paper-blue-link)]'} text-[13px] font-semibold`)}${T('Tile Title', t, `${dark ? 'text-white' : ink} text-[24px] font-semibold leading-[1.15] tracking-[-0.6px]`)}<span data-node-label="Tile Body" className="${F} block w-[276px] ${dark ? 'text-[#A9B8C6]' : mut} text-[15px] leading-[1.5]">${b}</span></div>`;
const bento = `<div data-node-label="Bento" className="flex w-full flex-col gap-6">
    <div data-node-label="Bento Row" className="flex w-full gap-6">
      ${bentoTile('Tile Titles', `<div data-node-label="Tile Split" className="flex w-full h-full">${tileText('01', 'Every title states the answer.', 'Labels become claims. The deck reads as an argument from the titles alone.')}<div data-node-label="Tile Visual" className="flex flex-1 flex-col justify-center pr-16 gap-3">${struck('Q3 revenue by segment', 'text-[#9AA5B1] text-[19px] font-medium tracking-[-0.3px]', 12)}<div data-node-label="Answer Wrap" className="flex self-start relative border border-[#4D94FB] rounded-none">${T('Tile Answer', 'Enterprise carried the quarter', `[color:${NV}] text-[23px] font-semibold tracking-[-0.6px]`)}${handlesAbs}<div data-node-label="Tile Cursor" className="flex absolute right-[-52px] top-[22px]">${cursorFlag('Aira')}</div></div></div></div>`, 776)}
      ${bentoTile('Tile Sources', `<div data-node-label="Tile Number Wrap" className="flex flex-col p-7 gap-1">${T('Tile Number', '02', '[color:var(--paper-blue-link)] text-[13px] font-semibold')}<div data-node-label="Big Num" className="flex items-start gap-1 pt-3">${T('Big Value', '$22.5M', `[color:${NV}] text-[64px] font-semibold leading-[1] tracking-[-2.4px]`)}${T('Big Ref', '1', '[color:var(--paper-blue-link)] text-[18px] font-semibold')}</div><div data-node-label="Ref Line" className="flex items-center gap-2 pt-2">${T('Ref Mark', '1', '[color:var(--paper-blue-link)] text-[12px] font-semibold')}${T('Ref Text', 'Brightwater FY plan, p. 4', `${mut} text-[13px]`)}</div></div>${`<div data-node-label="Tile Text" className="flex flex-col gap-2 px-7 pb-7">${T('Tile Title', 'Every number has a source.', `${ink} text-[24px] font-semibold leading-[1.15] tracking-[-0.6px]`)}</div>`}`, 400)}
    </div>
    <div data-node-label="Bento Row" className="flex w-full gap-6">
      ${bentoTile('Tile Point', `<div data-node-label="Tile Spacer" className="block h-[150px]"></div>${tileText('03', 'One point per slide.', 'One exhibit, one accent color on the number that proves the title.', true)}<div data-node-label="Tile Dither" className="flex absolute left-0 top-0 w-full h-[190px]"></div>`, 400, true)}
      ${bentoTile('Tile PowerPoint', `<div data-node-label="Tile Split" className="flex w-full h-full">${tileText('04', 'Opens in PowerPoint.', 'Titles stay text, charts stay charts, your master and fonts stay yours.')}<div data-node-label="Tile Visual" className="flex flex-1 items-center justify-center pr-9"><div data-node-label="File Card" className="flex w-[300px] flex-col rounded-[14px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_18px_40px_#0f24331a] p-5 gap-4"><div data-node-label="File Head" className="flex items-center gap-3"><div data-node-label="File Icon" className="flex size-10 justify-center items-center rounded-[10px] bg-[#0F2433]">${T('File Letter', 'P', 'text-white text-[18px] font-bold')}</div><div data-node-label="File Meta" className="flex flex-col gap-0.5">${T('File Name', 'Halden Q3 board review.pptx', `${ink} text-[13px] font-semibold`)}${T('File Info', '8 slides, editable', `${sub} text-[12px]`)}</div></div><div data-node-label="File Checks" className="flex flex-col gap-2">${['Titles are text', 'Charts are native', 'Notes kept'].map(x => `<div data-node-label="File Check" className="flex items-center gap-2">${tileG(ic('check', 10), 18, 6)}${T('Check Text', x, `${ink} text-[13px]`)}</div>`).join('')}</div></div></div></div>`, 776)}
    </div>
  </div>`;
const bentoSection = `<div data-node-label="Bento Section" className="flex w-full flex-col items-center px-[120px] pt-[120px] pb-[120px] bg-white">
    <div data-node-label="Section Head" className="flex w-full items-end justify-between pb-14"><div data-node-label="Head Text" className="flex flex-col gap-4">${lEyebrow('In short')}<div data-node-label="Section Title" className="flex flex-col">${['Everything a partner checks,', 'done before you present.'].map(l => T('Title Line', l, `${ink} text-[48px] font-semibold leading-[1.08] tracking-[-1.4px]`)).join('')}</div></div>${lLead('Four rules the best decks follow. Aira applies them to every slide it builds, and you see each one as it happens.', 400)}</div>
    ${bento}
  </div>`;
const seam = (label) => `<div data-node-label="${label}" className="flex w-full h-[120px]"></div>`;
let landing10 = landing6;
{
  const a = landing10.indexOf('<div data-node-label="Nav Wrap"');
  const b = landing10.indexOf('${dark(') >= 0 ? -1 : landing10.indexOf('<div data-node-label="Rewrite Section"');
  landing10 = landing10.slice(0, a) + `<div data-node-label="Dark Top" className="flex w-full flex-col items-center relative" style={{backgroundColor:'${DEEP}'}}>${navDark}${hero10}<div data-node-label="Hero Bottom" className="block h-[0px]"></div></div>\n  ${bentoSection}` + landing10.slice(b);
}
landing10 = landing10.replace(`<div data-node-label="Dark Top" className="flex w-full flex-col items-center relative" style={{backgroundColor:'${DEEP}'}}>`, `<div data-node-label="Dark Top" className="flex w-full flex-col items-center relative [background-image:linear-gradient(180deg,${DEEP}_0%,${DEEP}_80%,#FFFFFF_80%)]">`);
landing10 = landing10.replace(/(<span data-node-label="Footer Link"[^>]*>Terms<\/span>)(?![\s\S]*Footer Link)/, '$1' + T('Footer Link', 'Shaders by Paper', 'text-[#7F93A6] text-[13px]'));
if (!landing10.includes('Bento Section') || !landing10.includes('Rewrite Section')) throw new Error('v10 failed');
landing10 = landing10.replace('className="flex w-[${LW}px] flex-col bg-white', 'className="flex w-[${LW}px] flex-col bg-white');

// ---------- Landing v12: light, real product screens ----------
const slot = (label, w, h, extra = '') => `<div data-node-label="${label}" className="flex w-[${w}px] h-[${h}px] shrink-0 relative overflow-clip ${extra}"></div>`;
const navLight = navPill;
const ghostLight = (t) => `<div data-node-label="Secondary Button" className="flex h-[48px] items-center rounded-[12px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-300),0px_1px_2px_#0000000d] px-6">${T('Secondary Label', t, `${ink} text-[15px] font-medium`)}</div>`;
const announceLight = `<div data-node-label="Announce" className="flex h-9 items-center rounded-full bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_4px_14px_#0f24330d] pl-1.5 pr-4 gap-2.5"><div data-node-label="Announce Tag" className="flex h-6 items-center rounded-full [background-image:linear-gradient(180deg,#93B8EF_0%,#4D94FB_100%)] px-2.5 gap-1.5"><div data-node-label="Spark" className="size-[11px] block text-white">${SPARK}</div>${T('Tag Text', 'Aira', 'text-white text-[12px] font-semibold')}</div>${T('Announce Text', 'The agent that writes the answer before the slide', `${mut} text-[13px]`)}${ic('arrowr', 13, '[color:var(--ad-brand)]')}</div>`;
const fileSat = `<div data-node-label="File Satellite" className="flex w-[300px] flex-col rounded-[14px] bg-white shadow-[0px_0px_0px_1px_#0000000f,0px_12px_32px_#0f24331f,0px_2px_6px_#0f24330f] p-4 gap-3">
    <div data-node-label="File Head" className="flex items-center gap-3"><div data-node-label="File Icon" className="flex size-10 justify-center items-center rounded-[10px] bg-[#0F2433]">${T('File Letter', 'P', 'text-white text-[18px] font-bold')}</div><div data-node-label="File Meta" className="flex flex-col gap-0.5">${T('File Name', 'Q3 investor update.pptx', `${ink} text-[13px] font-semibold`)}${T('File Info', '8 slides, every chart editable', `${sub} text-[12px]`)}</div></div>
  </div>`;
const hero12 = `<div data-node-label="Hero" className="flex w-full flex-col items-center relative">
    <div data-node-label="Hero Light" className="flex absolute left-0 top-0 w-full h-[900px]"></div>
    <div data-node-label="Hero Horizon" className="flex absolute left-0 top-[600px] w-full h-[420px]"></div>
    <div data-node-label="Hero Content" className="flex w-full flex-col items-center pt-[88px] gap-8">
      ${announceLight}
      <div data-node-label="Hero Headline" className="flex flex-col items-center">${T('Headline Line', 'Win the room', `${ink} text-[104px] font-semibold leading-[0.98] tracking-[-4.4px]`)}${T('Headline Line Accent', 'before you walk in.', `${ink} text-[104px] font-semibold leading-[0.98] tracking-[-4.4px]`)}</div>
      <span data-node-label="Hero Sub" className="${F} block w-[620px] text-center ${mut} text-[20px] leading-[1.5]">Aira turns your notes into a board deck that leads with the answer, sources every number and opens in PowerPoint. You make the call.</span>
      <div data-node-label="Hero Actions" className="flex items-center gap-3 pt-1">${bigBtn('Start free')}${ghostLight('Import a PowerPoint')}</div>
      <div data-node-label="Hero Notes" className="flex items-center gap-5">${T('Hero Note', 'Free with weekly usage', `${sub} text-[13px]`)}<div data-node-label="Divider" className="w-px h-3.5 block [background-color:var(--paper-gray-300)]"></div>${T('Own Agent Text', 'Works with Claude and Codex', `${ink} text-[13px] font-medium`)}</div>
      <div data-node-label="Shot Wrap" className="flex relative pt-12 pb-0">
        ${slot('Real Hero Slot', 1200, 640, 'rounded-t-[18px] bg-white shadow-[0px_0px_0px_1px_#0000000f,0px_30px_80px_#0f24331f,0px_4px_12px_#0f24330d]')}
        <div data-node-label="Hero Satellite" className="flex absolute left-[-60px] top-[586px]">${fileSat}</div>
      </div>
    </div>
  </div>`;
const realTile = (label, w, h) => slot(label, w, h, 'rounded-[12px] bg-white shadow-[0px_0px_0px_1px_#0000000f,0px_16px_40px_#0f24331a]');
const bento12 = `<div data-node-label="Bento" className="flex w-full flex-col gap-6">
    <div data-node-label="Bento Row" className="flex w-full gap-6">
      ${bentoTile('Tile Ask', `<div data-node-label="Tile Split" className="flex w-full h-full items-end">${tileText('01', 'Point at it. Say what it should prove.', 'Select a chart or a slide, then ask in plain words. Aira keeps the selection as context.')}<div data-node-label="Tile Visual" className="flex flex-1 h-full items-start justify-end pt-7">${realTile('Real Composer Slot', 352, 252)}</div></div>`, 776)}
      ${bentoTile('Tile Sources', `<div data-node-label="Tile Number Wrap" className="flex flex-col p-7 gap-1">${T('Tile Number', '02', '[color:var(--paper-blue-link)] text-[13px] font-semibold')}<div data-node-label="Big Num" className="flex items-start gap-1 pt-3">${T('Big Value', '$22.5M', `[color:${NV}] text-[64px] font-semibold leading-[1] tracking-[-2.4px]`)}${T('Big Ref', '1', '[color:var(--paper-blue-link)] text-[18px] font-semibold')}</div><div data-node-label="Ref Line" className="flex items-center gap-2 pt-2">${T('Ref Mark', '1', '[color:var(--paper-blue-link)] text-[12px] font-semibold')}${T('Ref Text', 'Brightwater FY plan, p. 4', `${mut} text-[13px]`)}</div></div><div data-node-label="Tile Text" className="flex flex-col gap-2 px-7 pb-7">${T('Tile Title', 'Every number has a source.', `${ink} text-[24px] font-semibold leading-[1.15] tracking-[-0.6px]`)}</div>`, 400)}
    </div>
    <div data-node-label="Bento Row" className="flex w-full gap-6">
      ${bentoTile('Tile Point', `<div data-node-label="Tile Spacer" className="block h-[150px]"></div>${tileText('03', 'One point per slide.', 'One exhibit, one accent color on the number that proves the title.')}<div data-node-label="Tile Dither" className="flex absolute left-0 top-0 w-full h-[190px]"></div>`, 400).replace('bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-200),0px_10px_30px_#0f24330a]', '[background-color:#EEF4FE] shadow-[0px_0px_0px_1px_#DCE8FB]')}
      ${bentoTile('Tile PowerPoint', `<div data-node-label="Tile Split" className="flex w-full h-full items-end">${tileText('04', 'Opens in PowerPoint.', 'Titles stay text, charts stay charts, your master and fonts stay yours.').replace('w-[330px]', 'w-[290px]')}<div data-node-label="Tile Visual" className="flex flex-1 h-full items-center justify-end">${realTile('Real Export Slot', 478, 236).replace('rounded-[12px]', 'rounded-l-[12px]')}</div></div>`, 776)}
    </div>
  </div>`;
const bentoSection12 = bentoSection.replace(bento, bento12);
const agentsShot = `<div data-node-label="Agents Shot" className="flex w-full justify-center">${slot('Real Agents Slot', 860, 484, 'rounded-[14px] bg-white shadow-[0px_0px_0px_1px_#0000000f,0px_24px_60px_#0f24331a]')}</div>`;
const lighten = (chunk) => chunk
  .replace(/style=\{\{backgroundColor:'#0F2433'\}\}/g, 'style={{backgroundColor:\'#FFFFFF\'}}')
  .replace(/text-white/g, 'text-[#222222]')
  .replace(/text-\[#93B8EF\]/g, '[color:var(--paper-blue-link)]')
  .replace(/text-\[#A9B8C6\]/g, 'text-[#666666]')
  .replace(/text-\[#C9D4DE\]/g, 'text-[#444444]')
  .replace(/text-\[#7F93A6\]/g, 'text-[#909090]')
  .replace(/text-\[#5B7080\]/g, 'text-[#A3A3A3]')
  .replace(/\[background-color:#5B7080\]/g, '[background-color:#B5B5B5]')
  .replace(/border-\[#ffffff14\]/g, 'border-[#EAEAE7]')
  .replace(/#ffffff26/g, '#D7D7D6')
  .replace(/text-\[#71879A\]/g, 'text-[#A8A8A8]')
  .replace(/text-\[#ffffff0f\]/g, 'text-[#0000000a]')
  .replace(/border-\[#ffffff40\]/g, 'border-[#D7D7D6]');
let landing12 = landing10;
{
  const a = landing12.indexOf('<div data-node-label="Dark Top"');
  const b = landing12.indexOf('<div data-node-label="Bento Section"');
  landing12 = landing12.slice(0, a) + `<div data-node-label="Light Top" className="flex w-full flex-col items-center relative bg-white">${navLight}${hero12}</div>\n  ` + landing12.slice(b);
}
landing12 = landing12.replace(bentoSection, bentoSection12);
landing12 = landing12.replace(agentsRow, agentsShot);
for (const lab of ['Rewrite Section', 'Story Section', 'Final Section', 'Footer', 'Wordmark Band']) {
  const a = landing12.indexOf(`<div data-node-label="${lab}"`);
  if (a < 0) throw new Error('no ' + lab);
  const nexts = ['Pyramid Section', 'So What Section', 'Footer', 'Wordmark Band'].map(n => landing12.indexOf(`<div data-node-label="${n}"`, a + 10)).filter(x => x > a);
  const b = nexts.length ? Math.min(...nexts) : landing12.length;
  landing12 = landing12.slice(0, a) + lighten(landing12.slice(a, b)) + landing12.slice(b);
}
landing12 = landing12.replace('<div data-node-label="Rewrite Section" className="flex w-full flex-col items-center px-[120px] py-[120px] "', '<div data-node-label="Rewrite Section" className="flex w-full flex-col items-center px-[120px] py-[120px] border-t [border-top-color:var(--paper-gray-200)]"');
if (!landing12.includes('Real Hero Slot') || !landing12.includes('Real Agents Slot') || !landing12.includes('Real Export Slot')) throw new Error('v12 slots missing');

// ---------- Landing v13: editorial boardroom, from scratch ----------
const SERIF = '[font-family:Newsreader]';
const SV = (label, text, cls) => `<span data-node-label="${label}" className="${SERIF} block ${cls}">${text}</span>`;
const PAPER = '#F5F5F2';
const ruleEd = (label = 'Rule', extra = '') => `<div data-node-label="${label}" className="block w-full h-px [background-color:#D7D7D6] ${extra}"></div>`;
const figSlot = (label, w, h, extra = '') => `<div data-node-label="${label}" className="flex w-[${w}px] h-[${h}px] shrink-0 relative overflow-clip bg-white ${extra}"></div>`;
const figCap = (n, t) => `<div data-node-label="Caption" className="flex items-start gap-3 pt-3">${T('Fig Number', 'Fig. ' + n, `${ink} text-[12px] font-semibold whitespace-nowrap`)}${T('Fig Text', t, `${mut} text-[12px] leading-[1.45]`)}</div>`;
const shadowFig = 'shadow-[0px_0px_0px_1px_#0000000f,0px_24px_60px_#0f24331a,0px_3px_8px_#0f24330d]';
const mastheadEd = `<div data-node-label="Masthead" className="flex w-full flex-col px-[120px] pt-6">
    <div data-node-label="Mast Row" className="flex w-full items-center justify-between pb-5">
      <div data-node-label="Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[24px] block">${MARK}</div>${T('Brand Name', 'AirDesign', `${ink} text-[18px] font-semibold tracking-[-0.3px]`)}</div>
      <div data-node-label="Nav Links" className="flex items-center gap-8">${['The standard', 'PowerPoint', 'Agents', 'Pricing'].map(x => T('Nav Link', x, `${mut} text-[14px]`)).join('')}</div>
      <div data-node-label="Nav Actions" className="flex items-center gap-5">${T('Nav Sign In', 'Sign in', `${ink} text-[14px] font-medium`)}${lBtn('Start free', 'primary', false, 38)}</div>
    </div>
    ${ruleEd('Mast Rule')}
    <div data-node-label="Date Line" className="flex w-full items-center justify-between py-2.5">${T('Date Left', 'For consultants and strategy teams', `${sub} text-[12px] font-medium tracking-[0.3px]`)}${T('Date Mid', 'The board-ready deck, built with Aira', `${sub} text-[12px] font-medium tracking-[0.3px]`)}${T('Date Right', 'Free every week', `${sub} text-[12px] font-medium tracking-[0.3px]`)}</div>
    ${ruleEd('Mast Rule 2')}
  </div>`;
const heroEd = `<div data-node-label="Hero" className="flex w-full flex-col relative">
    <div data-node-label="Hero Plate" className="flex absolute left-[880px] top-[40px] w-[560px] h-[600px]"></div>
    <div data-node-label="Hero Top" className="flex w-full items-start px-[120px] pt-[72px] pb-[72px]">
      <div data-node-label="Hero Left" className="flex w-[760px] shrink-0 flex-col gap-10">
        <div data-node-label="Hero Headline" className="flex flex-col">${SV('Headline Line', 'Win the room', `${ink} text-[128px] font-medium leading-[0.92] tracking-[-4.6px]`)}${SV('Headline Line', 'before you', `${ink} text-[128px] font-medium leading-[0.92] tracking-[-4.6px]`)}${SV('Headline Italic', 'walk in.', `[color:#2D6FCD] text-[128px] font-medium italic leading-[0.92] tracking-[-4.6px]`)}</div>
        <div data-node-label="Standfirst" className="flex w-[520px] flex-col gap-6">
          <span data-node-label="Standfirst Text" className="${F} block w-[520px] ${ink} text-[20px] leading-[1.5]">Aira builds the deck the way a partner would: the answer first, one point per slide, a source under every number. It opens in PowerPoint when you are done.</span>
          <div data-node-label="Hero Actions" className="flex items-center gap-4">${lBtn('Start free')}${T('Hero Note', 'Free every week. A reset is $5.', `${mut} text-[13px]`)}</div>
        </div>
      </div>
    </div>
    <div data-node-label="Fig One" className="flex w-full flex-col pl-[120px]">
      ${figSlot('Real Hero Slot', 1320, 700, `rounded-tl-[14px] ${shadowFig}`)}
      <div data-node-label="Fig One Cap" className="flex w-[1200px]">${figCap(1, 'Aira building an eight-slide investor update from a page of notes. Real AirDesign screen, sample data.')}</div>
    </div>
  </div>`;
const ruleRow = (n, title, body, fig, cap, reverse = false, sat = '') => `<div data-node-label="Standard Row" className="flex w-full items-start justify-between py-16 ${n > 1 ? 'border-t [border-top-color:#D7D7D6]' : ''}">
    <div data-node-label="Row Text" className="flex w-[440px] flex-col gap-5">${SV('Row Numeral', String(n), `[color:#2D6FCD] text-[96px] font-medium italic leading-[0.9]`)}${SV('Row Title', title, `${ink} text-[40px] font-medium leading-[1.1] tracking-[-1px]`)}<span data-node-label="Row Body" className="${F} block w-[400px] ${mut} text-[17px] leading-[1.55]">${body}</span></div>
    <div data-node-label="Row Figure" className="flex flex-col relative">${fig}${cap}${sat}</div>
  </div>`;
const standardEd = `<div data-node-label="Standard Section" className="flex w-full flex-col px-[120px] pt-[120px] pb-[60px] bg-white">
    <div data-node-label="Section Head" className="flex w-full items-end justify-between pb-10">${SV('Section Title', 'Three rules every board deck follows.', `${ink} text-[56px] font-medium leading-[1.05] tracking-[-1.6px] w-[720px]`)}<span data-node-label="Section Lead" className="${F} block w-[380px] ${mut} text-[17px] leading-[1.55]">Partners check the same three things on every slide. Aira applies them while it builds, so the review starts at the answer.</span></div>
    ${ruleRow(1, 'The title states the answer.', 'Read the titles alone and the argument holds. Labels like “Q3 revenue” become claims like “Revenue grew 39% year over year.”', figSlot('Real Title Slot', 640, 300, `rounded-[12px] ${shadowFig}`), figCap(2, 'A slide Aira wrote. The title is the point, not the topic.'))}
    ${ruleRow(2, 'One point per slide.', 'One exhibit, one accent on the number that proves the title. Select anything and tell Aira what it should prove.', figSlot('Real Chart Slot', 640, 300, `rounded-[12px] ${shadowFig}`), figCap(3, 'A chart selected, with the request that reshapes it.'), false, `<div data-node-label="Composer Satellite" className="flex absolute left-[330px] top-[112px]">${figSlot('Real Composer Slot', 348, 250, `rounded-[14px] shadow-[0px_0px_0px_1px_#0000000f,0px_16px_40px_#0f24332e]`)}</div>`)}
    ${ruleRow(3, 'Every number has a source.', 'Aira reads your files first and says what it used. Every chart carries its source line, ready for the partner who asks.', figSlot('Real Source Slot', 380, 330, `rounded-[12px] ${shadowFig}`), figCap(4, 'Aira’s working notes: the file it read and what it built from it.'))}
  </div>`;
const spreadEd = (label, kicker, title, body, fig, cap, bg = '', facts = []) => `<div data-node-label="${label}" className="flex w-full items-start justify-between px-[120px] py-[120px] ${bg}">
    <div data-node-label="Spread Text" className="flex w-[400px] flex-col gap-5 pt-2">${T('Spread Kicker', kicker, '[color:#2D6FCD] text-[13px] font-semibold tracking-[0.3px]')}${SV('Spread Title', title, `${ink} text-[48px] font-medium leading-[1.06] tracking-[-1.3px]`)}<span data-node-label="Spread Body" className="${F} block w-[380px] ${mut} text-[17px] leading-[1.55]">${body}</span>${facts.length ? `<div data-node-label="Facts" className="flex flex-col pt-2">${facts.map((f, i) => `<div data-node-label="Fact" className="flex items-baseline gap-3 py-3 ${i ? 'border-t [border-top-color:#D7D7D6]' : 'border-t [border-top-color:#D7D7D6]'}">${SV('Fact Num', String(i + 1), '[color:#2D6FCD] text-[18px] italic')}${T('Fact Text', f, `${ink} text-[15px]`)}</div>`).join('')}</div>` : ''}</div>
    <div data-node-label="Spread Figure" className="flex flex-col">${fig}${cap}</div>
  </div>`;
const pptEd = spreadEd('PowerPoint Section', 'PowerPoint in and out', 'Leaves as a PowerPoint you can edit.', 'Start from your own deck or from notes. Export when you are done; your firm’s template, fonts and notes come with it.', figSlot('Real Export Slot', 680, 400, `rounded-[12px] ${shadowFig}`), figCap(5, 'Export, as it appears in AirDesign.'), '', ['Titles stay text', 'Charts stay native charts', 'Speaker notes stay with the slide']);
const agentsEd0 = 0;
const agentsEd = spreadEd('Agents Section', 'Agents', 'Aira is built in. Bring Claude or Codex.', 'Connect your own agent over MCP. It works in the same editor, under the same rules, and you can switch it off any time.', figSlot('Real Agents Slot', 860, 312, `rounded-[12px] ${shadowFig}`), figCap(6, 'Settings, Agents. Aira on, Claude connected, Codex ready to connect.'), 'border-t [border-top-color:#D7D7D6]').replace('flex w-[400px] flex-col gap-5 pt-2', 'flex w-[280px] flex-col gap-5 pt-2').replace('block w-[380px] ${mut}'.replace('${mut}', mut), 'block w-[280px] ' + mut).replace("text-[48px] font-medium leading-[1.06]", "text-[40px] font-medium leading-[1.08]");
const priceCol = (big, unit, title, lines) => `<div data-node-label="Price Col" className="flex flex-1 flex-col gap-3 pr-10">${`<div data-node-label="Price Big" className="flex items-baseline gap-2">${SV('Price Value', big, `${ink} text-[88px] font-medium leading-[0.95] tracking-[-3px]`)}${T('Price Unit', unit, `${mut} text-[15px]`)}</div>`}${T('Price Title', title, `${ink} text-[17px] font-semibold pt-2`)}${lines.map(l => T('Price Line', l, `${mut} text-[15px] leading-[1.5]`)).join('')}</div>`;
const pricingEd = `<div data-node-label="Pricing Section" className="flex w-full flex-col px-[120px] py-[120px] bg-white">
    <div data-node-label="Section Head" className="flex w-full items-end justify-between pb-12">${SV('Section Title', 'Free every week. Five dollars when you need more.', `${ink} text-[56px] font-medium leading-[1.05] tracking-[-1.6px] w-[760px]`)}${lBtn('Start free')}</div>
    ${ruleEd()}
    <div data-node-label="Price Body" className="flex w-full items-start justify-between pt-12">
      <div data-node-label="Price Cols" className="flex w-[300px] flex-col gap-12">
        ${priceCol('Free', 'every week', 'Weekly usage', ['Resets every Monday at 8:00 AM.', 'Your request is saved if you run out.'])}
        ${priceCol('$5', 'per reset', 'Reset when you need more', ['Pay from credits, added from $10.', 'Credits never expire. Auto reset is optional.'])}
      </div>
      <div data-node-label="Price Figure" className="flex flex-col">${figSlot('Real Usage Slot', 860, 330, `rounded-[12px] ${shadowFig}`)}${figCap(7, 'Settings, Usage. What you have used this week and your credits.')}</div>
    </div>
  </div>`;
const closeEd = `<div data-node-label="Close Section" className="flex w-full flex-col relative px-[120px] pt-[140px] pb-[120px]">
    <div data-node-label="Close Plate" className="flex absolute left-[900px] top-[40px] w-[540px] h-[520px]"></div>
    ${SV('Close Title', 'Your next deck', `${ink} text-[128px] font-medium leading-[0.92] tracking-[-4.6px]`)}${SV('Close Italic', 'has to win.', `[color:#2D6FCD] text-[128px] font-medium italic leading-[0.92] tracking-[-4.6px]`)}
    <div data-node-label="Close Actions" className="flex items-center gap-4 pt-12">${lBtn('Start free')}<div data-node-label="Secondary Button" className="flex h-[44px] items-center rounded-[10px] bg-white shadow-[0px_0px_0px_1px_var(--paper-gray-300)] px-5">${T('Secondary Label', 'Import a PowerPoint', `${ink} text-[15px] font-medium`)}</div></div>
  </div>`;
const colophonEd = `<div data-node-label="Colophon" className="flex w-full flex-col px-[120px] pb-12">
    ${ruleEd()}
    <div data-node-label="Colophon Row" className="flex w-full items-start justify-between pt-6">
      <div data-node-label="Colophon Brand" className="flex items-center gap-2.5"><div data-node-label="Mark" className="size-[20px] block">${MARK}</div>${T('Footer Name', 'AirDesign', `${ink} text-[14px] font-semibold`)}${T('Footer Line', 'Slides for decisions.', `${sub} text-[14px]`)}</div>
      <div data-node-label="Colophon Note" className="flex flex-col gap-1">${T('Colophon Title', 'Colophon', `${ink} text-[12px] font-semibold`)}${T('Colophon Text', 'Set in Newsreader and Geist. Shaders by Paper. Product screens are real; their data is sample data.', `${sub} text-[12px] w-[360px] leading-[1.5]`)}</div>
      <div data-node-label="Footer Links" className="flex items-center gap-7">${['Pricing', 'Agent guides', 'Sign in', 'Privacy', 'Terms'].map(x => T('Footer Link', x, `${mut} text-[13px]`)).join('')}</div>
    </div>
  </div>`;
const landing13 = `<div data-node-id="ed39" data-node-label="S11.01 Discover / Landing / Default" className="flex w-[${LW}px] flex-col [background-color:${PAPER}] [color:var(--ad-ink)] [font-family:var(--ad-font)] [line-height:normal] overflow-clip">
  ${mastheadEd}
  ${heroEd}
  <div data-node-label="Hero Gap" className="block h-[120px]"></div>
  ${standardEd}
  ${pptEd}
  ${agentsEd}
  ${pricingEd}
  ${closeEd}
  ${colophonEd}
</div>`;
fs.writeFileSync('/tmp/strat/ed/ed39.jsx', fix(landing13));
