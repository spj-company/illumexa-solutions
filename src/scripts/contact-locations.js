/* Illumexa — contact page locations: the rail joining the Presence cards' pins, the arcs
   between the three regions further down, and the hover link between the two.
   This script only lays the lines out (from the laid-out positions, so a card mid-entrance
   or mid-tilt doesn't skew them) and redraws them when the layout changes size; drawing
   them in and the light that travels along them are CSS. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const wrap = document.querySelector('[data-locations]');
  const rail = document.querySelector('[data-rail]');
  const stage = document.querySelector('[data-regions]');
  const linkLayer = document.querySelector('[data-region-links]');
  const cards = [...document.querySelectorAll('[data-location]')];
  const regions = [...document.querySelectorAll('[data-region]')];

  // Region arcs: the chain 01 → 02 → 03 bowing upward, and a faint arc closing the loop below.
  const LINKS = [
    { a: 'india', b: 'europe', lift: 0.24 },
    { a: 'europe', b: 'usa', lift: 0.24 },
    { a: 'usa', b: 'india', lift: -0.14, faint: true }
  ];

  const makePath = (svg, className, index, a, b) => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', className);
    path.setAttribute('pathLength', '1'); // lets CSS draw and dash it in fractions of its length
    path.style.setProperty('--seg', index);
    path.dataset.a = a;
    path.dataset.b = b;
    svg.append(path);
    return path;
  };

  // Position of an element's centre inside an ancestor, from layout offsets (transforms ignored).
  const centreWithin = (el, ancestor) => {
    let x = el.offsetWidth / 2;
    let y = el.offsetHeight / 2;
    for (let node = el; node && node !== ancestor; node = node.offsetParent) {
      x += node.offsetLeft;
      y += node.offsetTop;
    }
    return { x, y };
  };

  // A quadratic arc from a to b, bowed along the normal that points up the screen.
  const arc = (a, b, lift) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    let nx = -dy / length;
    let ny = dx / length;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const cx = (a.x + b.x) / 2 + nx * lift * length;
    const cy = (a.y + b.y) / 2 + ny * lift * length;
    const f = (n) => n.toFixed(1);
    return `M${f(a.x)} ${f(a.y)}Q${f(cx)} ${f(cy)} ${f(b.x)} ${f(b.y)}`;
  };

  /* Presence rail: a straight segment between each pair of neighbouring pins, stopping short
     of the pin rings, with a light that hops from one pin to the next. */
  const railSegments = [];
  const drawRail = () => {
    if (!wrap || !rail || cards.length < 2) return;
    const pins = cards.map((card) => card.querySelector('.location__pin'));
    if (!railSegments.length) {
      for (let i = 0; i < pins.length - 1; i += 1) {
        const a = cards[i].dataset.location;
        const b = cards[i + 1].dataset.location;
        railSegments.push([makePath(rail, 'rail-line', i, a, b), makePath(rail, 'rail-pulse', i, a, b)]);
      }
    }
    railSegments.forEach((paths, i) => {
      const from = centreWithin(pins[i], wrap);
      const to = centreWithin(pins[i + 1], wrap);
      const gap = pins[i].offsetHeight / 2 + 6;
      const d = `M${from.x} ${from.y + gap}L${to.x} ${to.y - gap}`;
      paths.forEach((path) => path.setAttribute('d', d));
    });
  };

  /* Region arcs, redrawn from wherever the pins sit at this screen size. */
  const arcs = [];
  const drawArcs = () => {
    if (!stage || !linkLayer || !regions.length) return;
    const at = Object.fromEntries(regions.map((region) => [region.dataset.region, { x: region.offsetLeft, y: region.offsetTop }]));
    if (!arcs.length) {
      LINKS.forEach((link, i) => {
        const line = makePath(linkLayer, link.faint ? 'link-line link-line--faint' : 'link-line', i, link.a, link.b);
        const pulse = link.faint ? null : makePath(linkLayer, 'link-pulse', i, link.a, link.b);
        arcs.push({ link, paths: [line, pulse].filter(Boolean) });
      });
    }
    arcs.forEach(({ link, paths }) => {
      if (!at[link.a] || !at[link.b]) return;
      const d = arc(at[link.a], at[link.b], link.lift);
      paths.forEach((path) => path.setAttribute('d', d));
    });
  };

  const draw = () => {
    drawRail();
    drawArcs();
  };

  draw();
  if (document.fonts) document.fonts.ready.then(draw);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(draw);
    [wrap, stage].filter(Boolean).forEach((el) => observer.observe(el));
  }

  /* Hovering a card lights its rail segments and its region below; hovering a region
     lights its arcs and its card above. */
  const lines = () => document.querySelectorAll('.rail-line, .link-line');
  const setHot = (id, on) => {
    cards.forEach((card) => card.classList.toggle('is-hot', on && card.dataset.location === id));
    regions.forEach((region) => region.classList.toggle('is-hot', on && region.dataset.region === id));
    lines().forEach((line) => line.classList.toggle('is-hot', on && (line.dataset.a === id || line.dataset.b === id)));
  };

  const bind = (el, id) => {
    el.addEventListener('pointerenter', () => setHot(id, true));
    el.addEventListener('pointerleave', () => setHot(id, false));
  };
  cards.forEach((card) => bind(card, card.dataset.location));
  regions.forEach((region) => bind(region, region.dataset.region));
})();
