// Hazel, head on, with an acorn held in her mouth. 100x100 artboard.
export function hazel({ mono = false } = {}) {
  const c = mono
    ? { fur: '#fff', furLight: '#fff', cream: '#fff', pink: '#fff', acorn: '#fff', cap: '#fff', capLine: '#fff', tooth: '#fff', top: '#fff' }
    : { fur: '#C8642B', furLight: '#E08A4A', cream: '#F6DDBE', pink: '#F2A7A0', acorn: '#B5672F', cap: '#6E4220', capLine: '#53311A', tooth: '#FFFDF8', top: '#D47437' };
  // In the monochrome icon, eyes / nose / mouth are cut out of the white silhouette.
  const holes = `
    <ellipse cx="39" cy="46" rx="4.4" ry="5.5"/>
    <ellipse cx="61" cy="46" rx="4.4" ry="5.5"/>
    <path d="M46.3 54.6 Q50 52 53.7 54.6 Q52.2 57.8 50 58.2 Q47.8 57.8 46.3 54.6 Z"/>`;
  return `
  ${mono ? `<defs><mask id="m"><rect x="0" y="0" width="100" height="100" fill="#fff"/><g fill="#000">${holes}
    <path d="M37 69.5 C 45 72.5 55 72.5 63 69.5" stroke="#000" stroke-width="1.6" fill="none"/></g></mask></defs><g mask="url(#m)">` : '<g>'}
    <path d="M25.5 40 C 19 27 19.5 13 24 6.5 C 33 10.5 41 19 44.5 30 Z" fill="${c.fur}"/>
    <path d="M74.5 40 C 81 27 80.5 13 76 6.5 C 67 10.5 59 19 55.5 30 Z" fill="${c.fur}"/>
    ${mono ? '' : `
    <path d="M28.5 34 C 25.5 25 25.8 17 27.6 13 C 33 16.5 37.5 22 40 29 Z" fill="${c.pink}"/>
    <path d="M71.5 34 C 74.5 25 74.2 17 72.4 13 C 67 16.5 62.5 22 60 29 Z" fill="${c.pink}"/>`}
    <ellipse cx="50" cy="50" rx="31.5" ry="28.5" fill="${c.fur}"/>
    ${mono ? '' : `<ellipse cx="50" cy="34" rx="14" ry="6" fill="${c.top}" opacity="0.45"/>`}
    <circle cx="30.5" cy="61" r="14.5" fill="${c.furLight}"/>
    <circle cx="69.5" cy="61" r="14.5" fill="${c.furLight}"/>
    <ellipse cx="50" cy="63.5" rx="16.5" ry="12" fill="${c.cream}"/>
    ${mono ? '' : `
    <circle cx="26.5" cy="56.5" r="4.4" fill="${c.pink}" opacity="0.9"/>
    <circle cx="73.5" cy="56.5" r="4.4" fill="${c.pink}" opacity="0.9"/>
    <ellipse cx="39" cy="46" rx="4.4" ry="5.5" fill="#16121F"/>
    <ellipse cx="61" cy="46" rx="4.4" ry="5.5" fill="#16121F"/>
    <circle cx="40.7" cy="43.8" r="1.7" fill="#fff"/>
    <circle cx="62.7" cy="43.8" r="1.7" fill="#fff"/>
    <path d="M46.3 54.6 Q50 52 53.7 54.6 Q52.2 57.8 50 58.2 Q47.8 57.8 46.3 54.6 Z" fill="#3A1E12"/>`}
    <g transform="rotate(-12 50 74)">
      <ellipse cx="50" cy="76" rx="13" ry="11" fill="${c.acorn}"/>
      ${mono ? '' : `<ellipse cx="45.5" cy="77" rx="3.6" ry="5" fill="#CF8247" opacity="0.75"/>`}
      <path d="M35.6 71.5 C 36.5 61 63.5 61 64.4 71.5 C 56 75 44 75 35.6 71.5 Z" fill="${c.cap}"/>
      ${mono ? '' : `<path d="M40 67 L 44 71 M46 65 L 50 70.5 M52 65 L 56 70.5 M58 66.5 L 61 70" stroke="${c.capLine}" stroke-width="1.1" stroke-linecap="round"/>`}
    </g>
    ${mono ? '' : `
    <rect x="46.9" y="58.4" width="2.9" height="4.4" rx="0.9" fill="${c.tooth}"/>
    <rect x="50.2" y="58.4" width="2.9" height="4.4" rx="0.9" fill="${c.tooth}"/>`}
  </g>`;
}

/** Full SVG document. `scale` is how much of the canvas the artwork spans. */
export function doc({ size, scale, bg, mono = false, dy = 0 }) {
  const s = (size * scale) / 100;
  const off = (size - size * scale) / 2;
  const back = bg === 'forest'
    ? `<defs><radialGradient id="g" cx="50%" cy="44%" r="62%"><stop offset="0%" stop-color="#2E6448"/><stop offset="100%" stop-color="#173A2A"/></radialGradient></defs>
       <rect width="${size}" height="${size}" fill="url(#g)"/>
       <circle cx="${size / 2}" cy="${size * 0.52}" r="${size * 0.37}" fill="#FFF4DF" opacity="0.06"/>`
    : bg === 'oat' ? `<rect width="${size}" height="${size}" fill="#F7F0E2"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${back}
    <g transform="translate(${off} ${off + dy * size}) scale(${s})">${hazel({ mono })}</g></svg>`;
}
