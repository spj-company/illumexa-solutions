/* Illumexa — homepage behaviour: hero video, services carousel, image fallbacks.
   (Stat counters are shared, in main.js.) */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Hero video: it must run. The markup autoplays it (muted, looped, inline, phone-sized
     source on narrow screens); this keeps it running: a refused start is retried on the
     first gesture, it resumes after a tab switch or history navigation, and anything that
     pauses it while it is on screen is undone. Off screen it rests to save battery. ---- */
  function initHeroVideo() {
    const video = document.querySelector('[data-hero-video]');
    if (!video) return;

    // Belt and braces: the attributes that let browsers autoplay without a gesture.
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.setAttribute('playsinline', '');

    const GESTURES = ['pointerdown', 'touchstart', 'keydown', 'wheel'];
    let inView = true;
    let waitingForGesture = false;
    let nudge = 0;

    const retryOnGesture = () => {
      if (waitingForGesture) return;
      waitingForGesture = true;
      const retry = () => {
        GESTURES.forEach((type) => window.removeEventListener(type, retry));
        waitingForGesture = false;
        play();
      };
      GESTURES.forEach((type) => window.addEventListener(type, retry, { passive: true }));
    };

    const play = () => {
      if (document.hidden || !inView) return;
      const attempt = video.play();
      if (attempt) attempt.catch(retryOnGesture);
    };

    // Nothing on the page pauses the film on purpose while it is on screen, so a pause there
    // (power saving, a stalled start) is simply undone a moment later.
    video.addEventListener('pause', () => {
      clearTimeout(nudge);
      nudge = setTimeout(play, 400);
    });
    video.addEventListener('ended', play); // loop is set; this covers a browser that drops it

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) play();
    });
    // Reloads, and coming back through the history cache, both arrive here.
    window.addEventListener('pageshow', play);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
          if (inView) play();
          else video.pause();
        },
        { threshold: 0.05 }
      ).observe(video);
    }

    play();
  }

  /* Services carousel ------------------------------------------------------
     Loops endlessly: a full set of hidden clones sits on each side, and once a
     scroll settles inside the clones it jumps back to the identical real slides.
     There is one dot per service; the active one is the card in the middle of the view. */
  function initCarousel() {
    const root = document.querySelector('[data-carousel]');
    if (!root) return;

    const track = root.querySelector('[data-carousel-track]');
    const dotsWrap = root.querySelector('[data-carousel-dots]');
    const prevButton = root.querySelector('[data-carousel-prev]');
    const nextButton = root.querySelector('[data-carousel-next]');
    const originals = [...track.children];
    const count = originals.length;
    if (count < 2) return;

    const clone = (slide) => {
      const copy = slide.cloneNode(true);
      copy.classList.add('is-clone');
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      return copy;
    };
    track.prepend(...originals.map(clone));
    track.append(...originals.map(clone));

    const slides = [...track.children];
    const firstReal = count;
    let step = 1;
    let visible = 1;
    let active = -1;
    let frame = 0;
    let settleTimer;

    const measure = () => {
      const styles = getComputedStyle(track);
      const inner = track.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      step = slides[1].offsetLeft - slides[0].offsetLeft;
      visible = Math.max(1, Math.round((inner + parseFloat(styles.columnGap || 0)) / step));
    };

    const centreShift = () => Math.floor((visible - 1) / 2);
    const firstVisible = () => Math.round(track.scrollLeft / step);
    const activeFor = (first) => (((first - firstReal + centreShift()) % count) + count) % count;

    const jumpTo = (first) => {
      track.classList.add('is-jumping');
      track.scrollLeft = first * step;
      requestAnimationFrame(() => track.classList.remove('is-jumping'));
    };

    const dots = originals.map((slide, i) => {
      const dot = document.createElement('button');
      const title = slide.querySelector('h3');
      dot.type = 'button';
      dot.className = 'carousel__dot';
      dot.setAttribute('aria-label', `Show ${title ? title.textContent.trim() : `service ${i + 1}`}`);
      dot.addEventListener('click', () => goTo(i));
      return dot;
    });
    dotsWrap.replaceChildren(...dots);

    const updateDots = () => {
      frame = 0;
      const index = activeFor(firstVisible());
      if (index === active) return;
      active = index;
      dots.forEach((dot, i) => {
        const distance = Math.abs(i - index);
        dot.dataset.dist = String(Math.min(distance, count - distance, 2));
        if (i === index) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    };

    // After a scroll settles inside the clones, swap to the matching real slides.
    const settle = () => {
      const first = firstVisible();
      if (first >= firstReal && first < firstReal + count) return;
      jumpTo(first < firstReal ? first + count : first - count);
    };

    /* Slides the track to a slide index over GLIDE_MS with an ease, rather than leaving the
       pace to the browser's own smooth scroll. Snapping is off while it runs; it lands on a
       snap point, so nothing shifts when it comes back on. */
    const GLIDE_MS = 520;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    let glideFrame = 0;
    let glideTo = null;

    const stopGlide = () => {
      if (!glideFrame) return;
      cancelAnimationFrame(glideFrame);
      glideFrame = 0;
      glideTo = null;
      track.classList.remove('is-gliding');
    };

    const glide = (index) => {
      stopGlide();
      // Keep the run inside the track: a jump of one whole set lands on identical clones,
      // so presses near either end still move a full card.
      const last = slides.length - visible;
      let target = index;
      if (target < 0) {
        jumpTo(firstVisible() + count);
        target += count;
      } else if (target > last) {
        jumpTo(firstVisible() - count);
        target -= count;
      }
      target = Math.max(0, Math.min(target, last));
      const to = target * step;
      const from = track.scrollLeft;
      if (reduceMotion || Math.abs(to - from) < 1) {
        track.scrollLeft = to;
        settle();
        return;
      }
      glideTo = target;
      track.classList.add('is-gliding');
      const began = performance.now();
      const run = (now) => {
        const t = Math.min(1, (now - began) / GLIDE_MS);
        track.scrollLeft = from + (to - from) * ease(t);
        if (t < 1) {
          glideFrame = requestAnimationFrame(run);
          return;
        }
        stopGlide();
        settle();
      };
      glideFrame = requestAnimationFrame(run);
    };

    // One card per press, looping through the clones, so neither end is ever a dead stop.
    const nudge = (direction) => glide((glideTo === null ? firstVisible() : glideTo) + direction);

    function goTo(index) {
      const current = glideTo === null ? firstVisible() : glideTo;
      const base = firstReal + index - centreShift();
      const target = [base - count, base, base + count].reduce((best, option) =>
        Math.abs(option - current) < Math.abs(best - current) ? option : best
      );
      glide(target);
    }

    track.addEventListener(
      'scroll',
      () => {
        if (!frame) frame = requestAnimationFrame(updateDots);
        if (!('onscrollend' in window)) {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(settle, 150);
        }
      },
      { passive: true }
    );
    track.addEventListener('scrollend', settle);

    // Arrows move one card; a touch, drag or wheel takes the track back from them.
    prevButton?.addEventListener('click', () => nudge(-1));
    nextButton?.addEventListener('click', () => nudge(1));
    ['pointerdown', 'touchstart', 'wheel'].forEach((type) =>
      track.addEventListener(type, stopGlide, { passive: true })
    );

    // Search results can ask for a specific service to be brought into view.
    root.addEventListener('carousel:show', (event) => {
      const index = originals.indexOf(event.target.closest('.carousel__slide'));
      if (index !== -1) goTo(index);
    });

    const place = (index) => {
      stopGlide();
      measure();
      jumpTo(firstReal + ((index - centreShift() + count) % count));
      active = -1;
      updateDots();
    };

    // Opening view: the configured slide leads, which puts the mock's cards on screen.
    measure();
    const start = Number(root.dataset.carouselStart) || 0;
    jumpTo(firstReal + start);
    updateDots();

    let resizeTimer;
    let lastWidth = track.clientWidth;
    new ResizeObserver(() => {
      if (track.clientWidth === lastWidth) return;
      lastWidth = track.clientWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => place(active), 120);
    }).observe(track);
  }

  /* A photo that fails to load falls back to the card's dark background ---- */
  function initImageFallbacks() {
    document.querySelectorAll('img[data-fallback]').forEach((img) => {
      const markMissing = () => img.closest('[data-media]')?.classList.add('is-missing');
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) markMissing();
      else img.addEventListener('error', markMissing, { once: true });
    });
  }

  initHeroVideo();
  initCarousel();
  initImageFallbacks();
})();
