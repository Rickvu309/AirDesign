const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc7ea"/><stop offset="0.62" stop-color="#f6e3c6"/><stop offset="1" stop-color="#f7d9b5"/></linearGradient>
<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a9cc0"/><stop offset="1" stop-color="#2d6a8e"/></linearGradient>
</defs>
<rect width="1200" height="800" fill="url(#sky)"/>
<circle cx="760" cy="270" r="92" fill="#ffd166"/>
<circle cx="760" cy="270" r="150" fill="#ffd166" opacity="0.22"/>
<polygon points="0,520 170,360 300,470 470,300 640,480 820,340 1000,470 1200,380 1200,560 0,560" fill="#87a9c4"/>
<polygon points="0,560 220,430 380,540 600,330 820,560 1010,450 1200,560 1200,600 0,600" fill="#35637f"/>
<rect y="560" width="1200" height="240" fill="url(#lake)"/>
<polygon points="600,330 560,600 640,600" fill="#d9e6ee" opacity="0.5"/>
<polygon points="600,620 540,800 660,800" fill="#9ec5da" opacity="0.5"/>
<polygon points="0,700 260,650 520,720 780,670 1040,730 1200,690 1200,800 0,800" fill="#1d4a46"/>
</svg>`

export const landscapeUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
