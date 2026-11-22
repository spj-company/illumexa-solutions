/* Illumexa — shared behaviour: header, mobile nav, page transitions, text splitting, line art,
   scroll reveals, stat counters, ambient motion, pointer depth, accordions, share, search. */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header: full at the top of the page, compact (.is-scrolled) once it has moved + mobile menu */
  function initHeader() {
    const header = document.querySelector('[data-header]');
    if (!header) return;

    // The bar thins once the page has scrolled past COMPACT_PAST and only grows back within
    // FULL_WITHIN of the top, so a position hovering around one value can't flicker it.
    // Checks are coalesced to one per frame.
    const COMPACT_PAST = 24;
    const FULL_WITHIN = 8;
    let frame = 0;
    let armed = false;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const compact = header.classList.contains('is-scrolled');
      if (!compact && y > COMPACT_PAST) header.classList.add('is-scrolled');
      else if (compact && y <= FULL_WITHIN) header.classList.remove('is-scrolled');
    };
    const schedule = () => {
      if (armed && !frame) frame = requestAnimationFrame(update);
    };
    const listen = () => window.addEventListener('scroll', schedule, { passive: true });
    const unlisten = () => {
      window.removeEventListener('scroll', schedule);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    // Every page opens with the full bar. Once the veil lifts (--page-delay) the bar is seen to
    // settle and, if the page opened part-way down (reload, #fragment), to thin at the same time.
    const arm = () => {
      armed = true;
      schedule();
    };
    listen();
    const delay = pageDelay();
    if (delay) setTimeout(arm, delay);
    else arm();

    window.addEventListener('pagehide', unlisten);
    // Back through the history cache the page returns as it was left: listen and check again.
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      listen();
      armed = true;
      schedule();
    });

    const toggle = header.querySelector('[data-menu-toggle]');
    const menu = header.querySelector('[data-menu]');
    if (!toggle || !menu) return;

    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      header.classList.toggle('is-menu-open', open);
    };

    toggle.addEventListener('click', () => setOpen(!isOpen()));

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (isOpen() && !header.contains(event.target)) setOpen(false);
    });

    window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  // Everything the reveal observer watches (see "Reveal system" in base.css).
  const REVEAL = [
    '[data-reveal]', '[data-observe]', '[data-draw]', '[data-reveal-threshold]', '.reveal', '.reveal-up', '.reveal-down', '.wipe-reveal',
    '.reveal-left', '.reveal-right', '.scale-reveal', '.card-reveal', '.image-reveal',
    '.reveal-group', '.line-reveal', '.text-reveal', '.word-reveal', '.char-reveal'
  ].join(', ');

  /* Text splitting: .word-reveal and .char-reveal text is wrapped word by word (and letter
     by letter) so it can rise into place in sequence. Skipped with reduced motion, where
     the text just fades in whole. */
  function initTextSplit() {
    if (reduceMotion) return;

    document.querySelectorAll('.word-reveal, .char-reveal').forEach((el) => {
      const byChar = el.classList.contains('char-reveal');
      const label = el.textContent.replace(/\s+/g, ' ').trim();
      const words = [];
      const chars = [];

      const split = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            split(child); // keeps wrappers such as .text-lime around their words
            return;
          }
          if (child.nodeType !== Node.TEXT_NODE) return;
          const pieces = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              pieces.append(' ');
              return;
            }
            const word = document.createElement('span');
            const inner = document.createElement('span');
            word.className = 'split-word';
            inner.className = 'split-word__inner';
            if (byChar) {
              [...part].forEach((letter) => {
                const char = document.createElement('span');
                char.className = 'split-char';
                char.textContent = letter;
                inner.append(char);
                chars.push(char);
              });
            } else {
              inner.textContent = part;
            }
            word.append(inner);
            pieces.append(word);
            words.push(inner);
          });
          child.replaceWith(pieces);
        });
      };
      split(el);

      // Longer text gets a tighter stagger, so every line lands in about the same time.
      words.forEach((word, i) => word.style.setProperty('--wi', i));
      el.style.setProperty('--word-step', `${Math.round(Math.min(110, 600 / Math.max(words.length - 1, 1)))}ms`);

      if (byChar) {
        const n = chars.length;
        el.style.setProperty('--char-step', `${Math.round(Math.max(14, Math.min(30, 460 / Math.max(n - 1, 1))))}ms`);
        chars.forEach((char, i) => {
          char.style.setProperty('--ci', i);
          // Letters start spread out from the middle and close up: tracking that settles.
          char.style.setProperty('--spread', (((i - (n - 1) / 2) / Math.max(n, 1)) * 0.6).toFixed(3));
        });
        // Read the word, not its letters: headings take a label; other text a hidden copy.
        el.querySelectorAll('.split-word').forEach((word) => word.setAttribute('aria-hidden', 'true'));
        if (/^H[1-6]$/.test(el.tagName)) {
          el.setAttribute('aria-label', label);
        } else {
          const copy = document.createElement('span');
          copy.className = 'visually-hidden';
          copy.textContent = label;
          el.prepend(copy);
        }
      }
      el.classList.add('is-split');
    });
  }

  /* Page transitions -------------------------------------------------------
     The head script opens each page with .is-intro (first page of a visit) or .is-arriving;
     here internal links close the page into the same black-and-lime frame before moving on.
     New tabs, downloads, other sites, in-page anchors and placeholder "#" links are left
     alone, as is everything when reduced motion is preferred. */
  const root = document.documentElement;
  const LEAVE_MS = 320;

  const navigate = (href, from) => {
    if (reduceMotion) {
      location.href = href;
      return;
    }
    if (from) from.classList.add('is-pending'); // a button shows it's working until the page goes
    root.classList.remove('is-intro', 'is-arriving');
    root.classList.add('is-leaving');
    setTimeout(() => { location.href = href; }, LEAVE_MS);
  };

  function initPageTransitions() {
    if (reduceMotion) return;
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page (e.g. an anchor)
      event.preventDefault();
      navigate(url.href, link);
    });
    // Coming back through the history cache shows the old page as it was left: reopen it.
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      root.classList.remove('is-leaving');
      document.querySelectorAll('.is-pending').forEach((el) => el.classList.remove('is-pending'));
    });
  }

  // How long the page stays veiled on arrival (matches --page-delay in base.css).
  const pageDelay = () => {
    if (root.classList.contains('is-intro')) return 720;
    if (root.classList.contains('is-arriving')) return 160;
    return 0;
  };

  /* Stat counters: [data-count] numbers count up once, the first time they're seen.
     The final value is already in the HTML, so without JS (or motion) nothing changes. */
  function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length || reduceMotion || !('IntersectionObserver' in window)) return;

    const DURATION = 1600;
    const render = (el, value) => {
      const { prefix = '', suffix = '' } = el.dataset;
      el.textContent = `${prefix}${value.toFixed(Number(el.dataset.decimals))}${suffix}`;
    };
    const animate = (el) => {
      const target = parseFloat(el.dataset.count);
      let start;
      const tick = (now) => {
        if (start === undefined) start = now;
        const progress = Math.min((now - start) / DURATION, 1);
        render(el, target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animate(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach((el) => {
      el.dataset.decimals = (el.dataset.count.split('.')[1] || '').length;
      render(el, 0);
      observer.observe(el);
    });
  }

  /* Line art: every stroked shape in an svg[data-draw] is measured so CSS can trace it;
     filled shapes are marked to fade in once the lines are drawn. */
  function initLineDraw() {
    if (reduceMotion) return;
    document.querySelectorAll('svg[data-draw]').forEach((svg) => {
      let i = 0;
      svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect').forEach((shape) => {
        if (shape.closest('defs, mask, clipPath, symbol')) return;
        const style = getComputedStyle(shape);
        if (style.stroke !== 'none' && typeof shape.getTotalLength === 'function') {
          shape.style.setProperty('--len', Math.ceil(shape.getTotalLength() + 1));
          shape.style.setProperty('--draw-i', i);
          shape.classList.add('draw-stroke');
          i += 1;
        } else if (style.fill !== 'none') {
          shape.style.setProperty('--draw-i', i);
          shape.classList.add('draw-fill');
        }
      });
    });
  }

  /* Scroll reveals --------------------------------------------------------- */
  function initReveal() {
    const targets = document.querySelectorAll(REVEAL);
    if (!targets.length) return;

    // With reduced motion everything is simply there; without an observer, too.
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
    } else {
      // One observer per threshold: most things reveal at 10% in view; an element can ask for
      // more with data-reveal-threshold (e.g. "0.25" = a quarter of it visible).
      const observers = new Map();
      const observerFor = (threshold) => {
        if (!observers.has(threshold)) {
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
              });
            },
            { rootMargin: '0px 0px -8% 0px', threshold }
          );
          observers.set(threshold, observer);
        }
        return observers.get(threshold);
      };
      const watch = () => targets.forEach((el) => {
        const threshold = Math.min(Math.max(parseFloat(el.dataset.revealThreshold) || 0.1, 0), 1);
        observerFor(threshold).observe(el);
      });

      // Hold the first reveals until the page veil has lifted, so they're seen.
      const delay = pageDelay();
      if (delay) setTimeout(watch, delay);
      else watch();
    }

    // Browsers jump to a URL #fragment while the target may still carry its reveal offset
    // and before late layout settles. Once loaded, show the target (and the revealed block
    // around it) instantly, then re-align it so it lands just below the header.
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target) return;
      let userScrolled = false;
      const stop = () => { userScrolled = true; };
      ['wheel', 'touchstart', 'keydown'].forEach((type) => window.addEventListener(type, stop, { once: true, passive: true }));

      const align = () => {
        if (userScrolled) return;
        // .is-instant stays on: removing it would restart the (animation-based) reveal.
        const blocks = [target.closest(REVEAL), ...target.querySelectorAll(REVEAL)].filter(Boolean);
        blocks.forEach((el) => el.classList.add('is-instant', 'is-visible'));
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      };
      const loaded = document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
      Promise.all([loaded, document.fonts ? document.fonts.ready : null]).then(() => requestAnimationFrame(align));
    }
  }

  /* Ambient loops only run while their section is on screen ---------------- */
  function initAmbient() {
    const sections = document.querySelectorAll('[data-ambient]');
    if (!sections.length) return;

    if (!('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('is-in-view'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.target.classList.toggle('is-in-view', entry.isIntersecting)),
      { rootMargin: '120px 0px' }
    );
    sections.forEach((section) => observer.observe(section));
  }

  /* Pointer depth: [data-glow] panels carry a soft light that follows the cursor and
     [data-tilt] cards lean a degree or two toward it. Mouse and trackpad only, and never
     with reduced motion; updates are batched to one per frame. */
  function initPointerEffects() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const track = (el, update) => {
      let frame = 0;
      let event = null;
      el.addEventListener('pointermove', (e) => {
        event = e;
        if (!frame) frame = requestAnimationFrame(() => {
          frame = 0;
          update(event, el.getBoundingClientRect());
        });
      });
    };

    document.querySelectorAll('[data-glow]').forEach((panel) => {
      const layer = document.createElement('span');
      const light = document.createElement('span');
      layer.className = 'pointer-glow';
      layer.setAttribute('aria-hidden', 'true');
      light.className = 'pointer-glow__light';
      layer.append(light);
      panel.prepend(layer);
      track(panel, (e, rect) => {
        light.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
      });
      panel.addEventListener('pointerenter', () => panel.classList.add('is-lit'));
      panel.addEventListener('pointerleave', () => panel.classList.remove('is-lit'));
    });

    document.querySelectorAll('[data-tilt]').forEach((card) => {
      track(card, (e, rect) => {
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--tilt-x', `${(y * -2.4).toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${(x * 1.6).toFixed(2)}deg`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--tilt-x');
        card.style.removeProperty('--tilt-y');
      });
    });
  }

  /* Accordions: one item open at a time, or independent with data-accordion="multiple".
     An item's open state starts from its trigger's aria-expanded. */
  function initAccordions() {
    document.querySelectorAll('[data-accordion]').forEach((accordion) => {
      const triggers = [...accordion.querySelectorAll('[data-accordion-trigger]')];
      const independent = accordion.dataset.accordion === 'multiple';

      const setItem = (trigger, open) => {
        trigger.setAttribute('aria-expanded', String(open));
        const item = trigger.closest('[data-accordion-item]');
        if (item) item.classList.toggle('is-open', open);
      };

      triggers.forEach((trigger) => {
        setItem(trigger, trigger.getAttribute('aria-expanded') === 'true');
        trigger.addEventListener('click', () => {
          const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
          if (independent) setItem(trigger, willOpen);
          else triggers.forEach((other) => setItem(other, other === trigger && willOpen));
        });
      });
    });

    // Arriving at an anchor inside a collapsed item opens it.
    const openTarget = () => {
      const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      const trigger = target && target.closest('[data-accordion-item]')?.querySelector('[data-accordion-trigger]');
      if (trigger && trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
    };
    openTarget();
    window.addEventListener('hashchange', openTarget);
  }

  /* Share button: native share sheet, clipboard fallback ------------------- */
  function initShare() {
    const status = document.querySelector('[data-share-status]');

    document.querySelectorAll('[data-share]').forEach((button) => {
      button.addEventListener('click', async () => {
        const data = { title: document.title, url: window.location.href.split('#')[0] };
        try {
          if (navigator.share) {
            await navigator.share(data);
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(data.url);
            if (status) status.textContent = 'Link copied to clipboard';
          }
        } catch (error) {
          // Share sheet dismissed or clipboard blocked: nothing to recover.
        }
      });
    });
  }

  /* Search: a dialog that finds sections, services, steps and FAQs on the page */
  function initSearch() {
    const dialog = document.querySelector('[data-search]');
    const openers = document.querySelectorAll('[data-search-open]');
    if (!dialog || !openers.length) return;

    if (typeof dialog.showModal !== 'function') {
      openers.forEach((opener) => opener.remove());
      return;
    }

    const form = dialog.querySelector('[data-search-form]');
    const input = dialog.querySelector('[data-search-input]');
    const list = dialog.querySelector('[data-search-results]');
    const status = dialog.querySelector('[data-search-status]');
    const MAX_RESULTS = 8;
    let index = null;
    let current = [];

    const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
    const pathOf = (href) => {
      const path = new URL(href, location.href).pathname;
      return path.endsWith('/') ? `${path}index.html` : path;
    };

    // Every page linked from the navigation or footer links, named by its link text.
    const pages = new Map();
    document.querySelectorAll('.nav-link[href$=".html"], .site-footer__links a[href$=".html"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!pages.has(href) && link.textContent.trim()) pages.set(href, link.textContent.trim());
    });
    const here = pathOf(location.href);

    // Headings become entries. The live page yields elements to scroll to; fetched pages yield URLs.
    const extract = (doc, pageHref) => {
      const pageName = pageHref ? pages.get(pageHref) : '';
      return [...doc.querySelectorAll('main h1, main h2, main h3')]
        .filter((heading) => !heading.closest('[aria-hidden="true"], .is-clone'))
        .map((heading) => {
          const label = text(heading);
          if (!label) return null;
          const trigger = heading.querySelector('[data-accordion-trigger]');
          const typed = heading.closest('[data-search-type]');
          const type = typed ? typed.dataset.searchType
            : trigger ? 'FAQ'
            : heading.tagName === 'H3' ? 'Detail' : heading.tagName === 'H1' ? 'Page' : 'Section';
          const panel = trigger && doc.getElementById(trigger.getAttribute('aria-controls'));
          const body = text(panel || heading.closest('li, article') || null);
          if (pageHref) {
            const anchor = heading.closest('[id]');
            const url = anchor && anchor.tagName !== 'MAIN' ? `${pageHref}#${anchor.id}` : pageHref;
            return { type, page: pageName, label, body, url };
          }
          return { type, label, body, target: trigger || heading, trigger, slide: heading.closest('.carousel__slide') };
        })
        .filter(Boolean);
    };

    const buildIndex = () => {
      index = extract(document, '');
      const others = [...pages.keys()].filter((href) => pathOf(href) !== here);
      others.forEach((href) => index.push({ type: 'Page', page: pages.get(href), label: pages.get(href), body: '', url: href }));
      // Other pages are read in the background; results refresh as each arrives.
      // (fetch is unavailable on file:// URLs, in which case search stays on this page.)
      others.forEach((href) => {
        fetch(href)
          .then((response) => (response.ok ? response.text() : ''))
          .then((html) => {
            if (!html) return;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            index.push(...extract(doc, href).filter((entry) => entry.type !== 'Page'));
            if (dialog.open) render();
          })
          .catch(() => {});
      });
    };

    const find = (query) => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) {
        // Default view: this page's sections, then the other pages.
        return index
          .filter((entry) => (!entry.url && entry.type === 'Section') || (entry.url && entry.type === 'Page'))
          .slice(0, MAX_RESULTS);
      }
      return index
        .map((entry) => {
          const label = entry.label.toLowerCase();
          const haystack = `${label} ${entry.body.toLowerCase()}`;
          if (!words.every((word) => haystack.includes(word))) return null;
          return { entry, score: words.reduce((sum, word) => sum + (label.includes(word) ? 2 : 1), 0) };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS)
        .map((match) => match.entry);
    };

    const go = (entry) => {
      dialog.close();
      if (entry.url) {
        navigate(new URL(entry.url, location.href).href);
        return;
      }
      if (entry.trigger && entry.trigger.getAttribute('aria-expanded') !== 'true') entry.trigger.click();

      // Services live in a horizontal carousel: scroll the page to it, let the carousel
      // slide the card into place, and focus the card's link.
      const carousel = entry.slide && entry.slide.closest('[data-carousel]');
      if (carousel) entry.slide.dispatchEvent(new CustomEvent('carousel:show', { bubbles: true }));
      const scrollTarget = carousel || entry.target;
      const focusTarget = carousel ? entry.slide.querySelector('a') : entry.target;

      if (!focusTarget.matches('a, button')) focusTarget.setAttribute('tabindex', '-1');
      scrollTarget.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: carousel ? 'center' : 'start' });
      focusTarget.focus({ preventScroll: true });
    };

    const render = () => {
      const query = input.value.trim();
      current = find(query);
      const items = current.map((entry) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        const type = document.createElement('span');
        const label = document.createElement('span');
        link.className = 'search__result';
        link.href = entry.url || '#';
        type.className = 'search__type';
        type.textContent = entry.url && entry.type !== 'Page' ? `${entry.page} · ${entry.type}` : entry.type;
        label.className = 'search__label';
        label.textContent = entry.label;
        link.append(type, label);
        link.addEventListener('click', (event) => {
          event.preventDefault();
          go(entry);
        });
        item.append(link);
        return item;
      });
      if (!items.length) {
        const empty = document.createElement('li');
        empty.className = 'search__empty';
        empty.textContent = `No matches for “${query}”`;
        items.push(empty);
      }
      list.replaceChildren(...items);
      status.textContent = query ? `${current.length} ${current.length === 1 ? 'result' : 'results'}` : '';
    };

    const open = () => {
      if (!index) buildIndex();
      input.value = '';
      render();
      dialog.showModal();
      input.focus();
    };

    openers.forEach((opener) => opener.addEventListener('click', open));
    input.addEventListener('input', render);
    dialog.querySelector('[data-search-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (current.length) go(current[0]);
    });

    // Arrow keys move between the input and the results.
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const stops = [input, ...list.querySelectorAll('.search__result')];
      const position = stops.indexOf(document.activeElement);
      if (position === -1) return;
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? Math.min(position + 1, stops.length - 1) : Math.max(position - 1, 0);
      stops[next].focus();
    });

    // Ctrl/Cmd + K opens search from anywhere.
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !dialog.open) {
        event.preventDefault();
        open();
      }
    });
  }

  initHeader();
  initPageTransitions();
  initTextSplit();
  initLineDraw();
  initReveal();
  initCounters();
  initAmbient();
  initPointerEffects();
  initAccordions();
  initShare();
  initSearch();

  window.illumexaReady = true;
})();
