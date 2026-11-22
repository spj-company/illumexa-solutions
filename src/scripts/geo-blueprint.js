/* Illumexa global blueprint (Contact, About)
   One drawing system for the three service regions on the shared world map. A page supplies
   the root and its map window; this script adds the drawing, and geo-blueprint.css plays it.
     .geo-blueprint[data-geo-blueprint]   root. --panel: a small plate of its own (Contact),
                                          hubs from data-hubs="id lat lon; …" and the land
                                          from data-land. --overlay: laid over an existing
                                          map (About), hubs read from its .map-pin[data-hub].
       .world-map > .world-map__canvas    the map window and its world-map.svg canvas
   Added here: coastline trace, graticule, construction lines to the rulers, measured chords,
   arcs between the hubs, a travelling light, hub markers, rulers and corner marks. main.js
   adds .is-visible once a quarter of the root is in view (data-reveal-threshold) and the CSS
   sequence runs: grid, coastline, technical lines, connections, India, Europe, USA, light.
   Hover or focus on a hub (or its key) lights it, its connections and its label; a click
   keeps it lit and sends the light out along its connections. */
(() => {
  const roots = document.querySelectorAll('[data-geo-blueprint]');
  if (!roots.length) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAP_W = 1440;
  const MAP_H = 962;

  // world-map.svg is Mercator, 170°W–190°E and 84°N–58°S.
  const WEST = -170;
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const NORTH = merc(84);
  const SOUTH = merc(-58);
  const project = (lat, lon) => ({
    x: ((lon - WEST) / 360) * MAP_W,
    y: ((NORTH - merc(lat)) / (NORTH - SOUTH)) * MAP_H,
  });
  const unproject = (x, y) => ({
    lon: (x / MAP_W) * 360 + WEST,
    lat: (Math.atan(Math.exp(NORTH - (y / MAP_H) * (NORTH - SOUTH))) * 360) / Math.PI - 90,
  });

  // Hubs appear in this order; links bow north, the long return link south.
  const HUBS = {
    india: { index: '01', name: 'India' },
    europe: { index: '02', name: 'Europe' },
    usa: { index: '03', name: 'USA' },
  };
  const ORDER = ['india', 'europe', 'usa'];
  const LINKS = [
    { a: 'india', b: 'europe', bow: 0.2 },
    { a: 'europe', b: 'usa', bow: 0.2 },
    { a: 'usa', b: 'india', bow: -0.12, faint: true },
  ];

  const svgNode = (tag, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.append(node);
    return node;
  };

  const htmlNode = (tag, className, parent) => {
    const node = document.createElement(tag);
    node.className = className;
    if (parent) parent.append(node);
    return node;
  };

  const pct = (value, total) => `${((value / total) * 100).toFixed(3)}%`;
  const round = (value) => Math.round(value * 10) / 10;

  const degrees = (value, digits, positive, negative) =>
    `${Math.abs(value).toFixed(digits)}° ${value >= 0 ? positive : negative}`;

  const coordinates = (hub, digits) =>
    `${degrees(hub.lat, digits, 'N', 'S')} · ${degrees(hub.lon, digits, 'E', 'W')}`;

  // Great-circle distance, to the nearest 10 km.
  const distance = (a, b) => {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(h));
    return `${(Math.round(km / 10) * 10).toLocaleString('en-US')} km`;
  };

  // Control point of a curve from p to q, bowed north (bow > 0) or south by bow × its length.
  const control = (p, q, bow) => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const length = Math.hypot(dx, dy);
    let nx = -dy / length;
    let ny = dx / length;
    if ((bow > 0 && ny > 0) || (bow < 0 && ny < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const offset = Math.abs(bow) * length;
    return { x: (p.x + q.x) / 2 + nx * offset, y: (p.y + q.y) / 2 + ny * offset };
  };

  const point = (p) => `${round(p.x)} ${round(p.y)}`;

  const readHubs = (root) => {
    const hubs = {};
    if (root.dataset.hubs) {
      root.dataset.hubs.split(';').forEach((entry) => {
        const [id, lat, lon] = entry.trim().split(/\s+/);
        if (!HUBS[id]) return;
        hubs[id] = { id, ...HUBS[id], lat: Number(lat), lon: Number(lon), ...project(Number(lat), Number(lon)) };
      });
    } else {
      root.querySelectorAll('.map-pin[data-hub]').forEach((pin) => {
        const id = pin.dataset.hub;
        const style = getComputedStyle(pin);
        const x = (parseFloat(style.getPropertyValue('--x')) / 100) * MAP_W;
        const y = (parseFloat(style.getPropertyValue('--y')) / 100) * MAP_H;
        if (!HUBS[id] || Number.isNaN(x) || Number.isNaN(y)) return;
        hubs[id] = { id, ...HUBS[id], x, y, ...unproject(x, y) };
      });
    }
    return ORDER.filter((id) => hubs[id]).map((id) => hubs[id]);
  };

  // The land outline is the path of world-map.svg itself, fetched once and shared.
  const landCache = new Map();
  const loadLand = (src) => {
    if (!landCache.has(src)) {
      landCache.set(
        src,
        fetch(src)
          .then((response) => (response.ok ? response.text() : Promise.reject(new Error(response.status))))
          .then((text) => new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('path')?.getAttribute('d') || '')
          .catch(() => '')
      );
    }
    return landCache.get(src);
  };

  const build = (root) => {
    const stage = root.querySelector('.geo-blueprint__stage') || root;
    const canvas = stage.querySelector('.world-map__canvas');
    if (!canvas) return;
    const hubs = readHubs(root);
    if (!hubs.length) return;
    const byId = Object.fromEntries(hubs.map((hub) => [hub.id, hub]));
    const digits = root.dataset.hubs ? 2 : 1;
    const keys = root.querySelectorAll('.geo-blueprint__key[data-hub]');
    const after = canvas.querySelector('.world-map__land, .geo-blueprint__land');

    // Grid behind the map, then coastline and line work over the land (under any pins).
    let grid = stage.querySelector('.geo-blueprint__grid');
    if (!grid) {
      grid = htmlNode('div', 'geo-blueprint__grid', null);
      stage.prepend(grid);
    }
    grid.setAttribute('aria-hidden', 'true');

    const coast = svgNode('svg', { class: 'geo-blueprint__coast', viewBox: `0 0 ${MAP_W} ${MAP_H}`, 'aria-hidden': 'true', focusable: 'false' }, null);
    const lines = svgNode('svg', { class: 'geo-blueprint__lines', viewBox: `0 0 ${MAP_W} ${MAP_H}`, 'aria-hidden': 'true', focusable: 'false' }, null);
    const scan = htmlNode('span', 'geo-blueprint__scan', null);
    scan.setAttribute('aria-hidden', 'true');
    if (after) after.after(coast, lines, scan);
    else canvas.prepend(coast, lines, scan);

    const landSrc = root.dataset.land || canvas.querySelector('.world-map__land')?.getAttribute('src');

    // Graticule: meridians every 30°, parallels at 60°N, 30°N, the equator and 30°S.
    const graticule = svgNode('g', { class: 'bp-graticule' }, lines);
    let order = 0;
    for (let lon = -150; lon <= 180; lon += 30) {
      const { x } = project(0, lon);
      svgNode('path', { class: 'bp-grat bp-draw', d: `M${round(x)} 0V${MAP_H}`, pathLength: 1, style: `--d:${order++}` }, graticule);
    }
    [60, 30, 0, -30].forEach((lat) => {
      const { y } = project(lat, 0);
      svgNode('path', { class: 'bp-grat bp-draw', d: `M0 ${round(y)}H${MAP_W}`, pathLength: 1, style: `--d:${order++}` }, graticule);
    });

    // Construction lines from each hub out to the rulers on the top and left edges.
    const guides = svgNode('g', { class: 'bp-guides' }, lines);
    hubs.forEach((hub, n) => {
      svgNode('path', { class: 'bp-guide bp-draw', d: `M${point(hub)}V0`, pathLength: 1, style: `--n:${n}` }, guides);
      svgNode('path', { class: 'bp-guide bp-draw', d: `M${point(hub)}H0`, pathLength: 1, style: `--n:${n}` }, guides);
    });

    // Measured chords with end ticks, the arcs, and a send path per arc for clicks.
    const measure = svgNode('g', { class: 'bp-measure' }, lines);
    const links = svgNode('g', { class: 'bp-links' }, lines);
    const route = [];
    LINKS.forEach((link, i) => {
      const a = byId[link.a];
      const b = byId[link.b];
      if (!a || !b) return;
      const c = control(a, b, link.bow);
      const d = `M${point(a)}Q${point(c)} ${point(b)}`;
      const ids = `${a.id} ${b.id}`;
      svgNode('path', { class: `bp-link${link.faint ? ' bp-link--faint' : ' bp-draw'}`, d, pathLength: 1, 'data-link': ids, style: `--d:${i}` }, links);
      if (link.faint) return;

      svgNode('path', { class: 'bp-send', d, pathLength: 1, 'data-link': ids }, links);
      route.push({ a, b, c });

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const tx = (-dy / length) * 9;
      const ty = (dx / length) * 9;
      svgNode('path', { class: 'bp-chord bp-draw', d: `M${point(a)}L${point(b)}`, pathLength: 1, 'data-link': ids, style: `--d:${i}` }, measure);
      svgNode('path', {
        class: 'bp-chord-ends',
        d: `M${round(a.x - tx)} ${round(a.y - ty)}L${round(a.x + tx)} ${round(a.y + ty)}M${round(b.x - tx)} ${round(b.y - ty)}L${round(b.x + tx)} ${round(b.y + ty)}`,
        'data-link': ids,
        style: `--d:${i}`,
      }, measure);

      // The distance reads along the chord, on its north side, never upside down.
      const label = htmlNode('span', 'geo-blueprint__measure', canvas);
      label.setAttribute('aria-hidden', 'true');
      label.dataset.link = ids;
      label.textContent = distance(a, b);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      label.style.setProperty('--x', pct((a.x + b.x) / 2, MAP_W));
      label.style.setProperty('--y', pct((a.y + b.y) / 2, MAP_H));
      label.style.setProperty('--a', `${round(Math.abs(angle) > 90 ? angle - 180 * Math.sign(angle) : angle)}deg`);
      label.style.setProperty('--d', i);
    });

    // The travelling light follows the arcs India → Europe → USA.
    if (route.length) {
      const energy = svgNode('g', { class: 'bp-energy' }, lines);
      const d = route.reduce((path, leg, i) => `${path}${i ? '' : `M${point(leg.a)}`}Q${point(leg.c)} ${point(leg.b)}`, '');
      svgNode('path', { class: 'bp-energy__halo', d, pathLength: 1 }, energy);
      svgNode('path', { class: 'bp-energy__core', d, pathLength: 1 }, energy);
    }

    // Hub markers. Where the plate lists keys, those are the controls and markers are pointer-only.
    hubs.forEach((hub, n) => {
      const button = htmlNode('button', 'geo-hub', canvas);
      button.type = 'button';
      button.dataset.hub = hub.id;
      button.style.setProperty('--x', pct(hub.x, MAP_W));
      button.style.setProperty('--y', pct(hub.y, MAP_H));
      button.style.setProperty('--n', n);
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${hub.name}, ${coordinates(hub, digits)}`);
      if (keys.length) {
        button.tabIndex = -1;
        button.setAttribute('aria-hidden', 'true');
      }
      button.innerHTML =
        '<span class="geo-hub__hit"></span>' +
        '<svg class="geo-hub__reticle" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false">' +
        '<circle class="geo-hub__ring" r="11" pathLength="1"/>' +
        '<path class="geo-hub__ticks" d="M0-19v5M19 0h-5M0 19v-5M-19 0h5"/></svg>' +
        '<span class="geo-hub__dot"></span>' +
        `<span class="geo-hub__label"><span class="geo-hub__index">${hub.index}</span>${hub.name}</span>` +
        `<span class="geo-hub__coords">${coordinates(hub, digits)}</span>`;
    });

    // Frame: corner marks, and rulers whose ticks sit on the map's own meridians and parallels.
    const frame = htmlNode('div', 'geo-blueprint__frame', stage);
    frame.setAttribute('aria-hidden', 'true');
    ['tl', 'tr', 'bl', 'br'].forEach((corner) => htmlNode('span', `geo-blueprint__corner geo-blueprint__corner--${corner}`, frame));

    const rulerX = htmlNode('div', 'geo-blueprint__ruler geo-blueprint__ruler--x', frame);
    for (let lon = -165; lon <= 180; lon += 15) {
      const tick = htmlNode('span', `geo-blueprint__tick${lon % 60 === 0 ? ' is-major' : ''}`, rulerX);
      tick.style.setProperty('--m', (project(0, lon).x / MAP_W).toFixed(5));
      if (lon % 60 === 0) tick.dataset.label = lon === 0 || lon === 180 ? `${Math.abs(lon)}°` : degrees(lon, 0, 'E', 'W').replace(' ', '');
    }
    const rulerY = htmlNode('div', 'geo-blueprint__ruler geo-blueprint__ruler--y', frame);
    for (let lat = -45; lat <= 75; lat += 15) {
      const tick = htmlNode('span', `geo-blueprint__tick${lat % 30 === 0 ? ' is-major' : ''}`, rulerY);
      tick.style.setProperty('--m', (project(lat, 0).y / MAP_H).toFixed(5));
      if (lat % 30 === 0) tick.dataset.label = lat === 0 ? '0°' : degrees(lat, 0, 'N', 'S').replace(' ', '');
    }
    hubs.forEach((hub, n) => {
      [[rulerX, hub.x / MAP_W], [rulerY, hub.y / MAP_H]].forEach(([ruler, m]) => {
        const mark = htmlNode('span', 'geo-blueprint__mark', ruler);
        mark.dataset.hub = hub.id;
        mark.dataset.label = hub.index;
        mark.style.setProperty('--m', m.toFixed(5));
        mark.style.setProperty('--n', n);
      });
    });

    // Strokes are drawn in map units; --u keeps them at screen-pixel widths at any size.
    const scale = () => {
      if (canvas.clientWidth) canvas.style.setProperty('--u', (MAP_W / canvas.clientWidth).toFixed(3));
    };
    scale();
    if ('ResizeObserver' in window) new ResizeObserver(scale).observe(canvas);

    // Fetch the land outline only as the drawing comes near the screen.
    const addLand = () => {
      if (!landSrc) return;
      loadLand(landSrc).then((d) => {
        if (d) svgNode('path', { class: 'bp-coast-line', d }, coast);
      });
    };
    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        near.disconnect();
        addLand();
      }, { rootMargin: '600px 0px' });
      near.observe(root);
    } else {
      addLand();
    }

    // Interaction. "Hot" follows hover and focus; "active" is set by a click and stays.
    let hot = null;
    let active = null;
    const lit = root.querySelectorAll('[data-hub]');
    const linked = root.querySelectorAll('[data-link]');

    const paint = () => {
      const current = hot || active;
      root.classList.toggle('has-hot', Boolean(current));
      lit.forEach((node) => {
        node.classList.toggle('is-hot', node.dataset.hub === current);
        node.classList.toggle('is-active', node.dataset.hub === active);
        if (node.hasAttribute('aria-pressed')) node.setAttribute('aria-pressed', String(node.dataset.hub === active));
      });
      linked.forEach((node) => node.classList.toggle('is-hot', Boolean(current) && node.dataset.link.split(' ').includes(current)));
    };

    const send = (id) => {
      const paths = root.querySelectorAll('.bp-send');
      paths.forEach((path) => path.classList.remove('is-sending', 'is-reverse'));
      void root.offsetWidth; // restart the pass if it is already running
      paths.forEach((path) => {
        const [a, b] = path.dataset.link.split(' ');
        if (a !== id && b !== id) return;
        path.classList.toggle('is-reverse', b === id);
        path.classList.add('is-sending');
      });
    };

    const hubOf = (target) => {
      const node = target instanceof Element ? target.closest('[data-hub]') : null;
      return node && root.contains(node) ? node.dataset.hub : null;
    };

    root.addEventListener('pointerover', (event) => {
      const id = hubOf(event.target);
      if (id && id !== hot) {
        hot = id;
        paint();
      }
    });
    root.addEventListener('pointerout', (event) => {
      const id = hubOf(event.target);
      if (!id || hubOf(event.relatedTarget) === id) return;
      hot = null;
      paint();
    });
    root.addEventListener('focusin', (event) => {
      const id = hubOf(event.target);
      if (!id) return;
      hot = id;
      paint();
    });
    root.addEventListener('focusout', () => {
      hot = null;
      paint();
    });
    root.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('button[data-hub]') : null;
      if (!button || !root.contains(button)) return;
      active = active === button.dataset.hub ? null : button.dataset.hub;
      paint();
      if (active) send(active);
    });
  };

  roots.forEach(build);
})();
