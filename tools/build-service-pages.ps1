# Builds src/services/<slug>.html for every service in tools/services.json.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File tools/build-service-pages.ps1
# The pages share this one template (header, footer and search are the same as the other
# pages, with paths one folder deeper), so edit the template here, not the generated files.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$data = Get-Content (Join-Path $PSScriptRoot 'services.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outDir = Join-Path $root 'src\services'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)

function Esc([string]$s) { return $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;') }

$icons = @{
  'i-rocket'    = '<symbol id="i-rocket" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></symbol>'
  'i-cash'      = '<symbol id="i-cash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="17" height="12" rx="2"/><circle cx="10.5" cy="10" r="2.6"/><path d="M22 8v9a3 3 0 0 1-3 3H5"/></symbol>'
  'i-handshake' = '<symbol id="i-handshake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/></symbol>'
  'i-compass'   = '<symbol id="i-compass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 5.4-5.4 2.1 2.1-5.4z"/></symbol>'
  'i-market'    = '<symbol id="i-market" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 14 8 9l3 3 5-6"/><path d="M13.5 6H16v2.5"/><circle cx="15.5" cy="15.5" r="3.3"/><path d="m18 18 2.5 2.5"/></symbol>'
}

foreach ($s in $data.services) {
  $title = Esc $s.title
  $leads = ($s.lead | ForEach-Object { "        <p class=`"svc__lead text-reveal`">$(Esc $_)</p>" }) -join "`n"
  $i = 0
  $items = ($s.items | ForEach-Object {
    $i++
    "          <div class=`"svc-detail__item reveal-up`">`n            <span class=`"svc-detail__index`" aria-hidden=`"true`">$('{0:D2}' -f $i)</span>`n            <dt>$(Esc $_.title)</dt>`n            <dd>$(Esc $_.text)</dd>`n          </div>"
  }) -join "`n"
  $others = ($data.services | Where-Object { $_.slug -ne $s.slug } | ForEach-Object {
    "          <li><a href=`"$($_.slug).html`">$(Esc $_.short) <svg class=`"icon`" aria-hidden=`"true`" focusable=`"false`"><use href=`"#i-arrow-right`"/></svg></a></li>"
  }) -join "`n"
  $description = Esc $s.summary
  $iconSymbol = $icons[$s.icon]

  $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$title | Services | Illumexa Solutions</title>
  <meta name="description" content="$description">
  <meta name="theme-color" content="#000000">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23000'/%3E%3Cg transform='rotate(32 16 16)'%3E%3Crect x='12' y='4' width='8' height='12' rx='4' fill='%23cdf200'/%3E%3Crect x='14' y='16' width='8' height='12' rx='4' fill='%23cdf200'/%3E%3C/g%3E%3C/svg%3E">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Illumexa Solutions">
  <meta property="og:title" content="$title | Illumexa Solutions">
  <meta property="og:description" content="$description">
  <meta property="og:image" content="../../assets/images/services/$($s.image).jpg">

  <link rel="preload" href="../../assets/fonts/poppins-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../assets/images/logo/illumexa-mark.png" as="image" fetchpriority="high">

  <link rel="stylesheet" href="../styles/base.css">
  <link rel="stylesheet" href="../styles/service.css">

  <script>
    // Gate the reveal styles on JS (dropped again if the scripts never run), and open the
    // page with the intro on the first page of a visit, or a short veil after that.
    (function (root) {
      root.classList.add('js');
      try {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          root.classList.add(sessionStorage.getItem('illumexa-visited') ? 'is-arriving' : 'is-intro');
          sessionStorage.setItem('illumexa-visited', '1');
        }
      } catch (error) {}
      setTimeout(function () {
        if (!window.illumexaReady) root.classList.remove('js');
      }, 3000);
    })(document.documentElement);
  </script>
  <script src="../scripts/main.js" defer></script>
</head>
<body id="top">
  <a class="skip-link" href="#main">Skip to content</a>

  <!-- Generated by tools/build-service-pages.ps1 from tools/services.json — edit those, not this file. -->

  <!-- Icon sprite (kept renderable, not display:none, as the sprites that hold gradients need it). -->
  <svg class="sprite" aria-hidden="true" focusable="false">
    <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>
    </symbol>
    <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12h15M13 6l6 6-6 6"/>
    </symbol>
    <symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>
    </symbol>
    <symbol id="i-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>
    </symbol>
    $iconSymbol
  </svg>

  <!-- ============ HEADER ============ -->
  <header class="site-header" data-header data-motion>
    <nav class="site-nav" aria-label="Primary">
      <a class="brand" href="../index.html" aria-label="Illumexa Solutions — home">
        <img class="brand__mark" src="../../assets/images/logo/illumexa-mark.png" alt="" width="127" height="176" decoding="async">
        <span class="brand__word" aria-hidden="true">
          <span class="brand__name">illumexa</span>
          <span class="brand__sub">SOLUTIONS</span>
        </span>
      </a>

      <div class="site-nav__menu" id="site-menu" data-menu>
        <ul class="nav-list">
          <li><a class="nav-link" href="../index.html">Home</a></li>
          <li><a class="nav-link" href="../about-us.html">About us</a></li>
          <li><a class="nav-link" href="../services.html" aria-current="page">Services</a></li>
          <li><a class="nav-link" href="#" data-page="investment-models">Investment models</a></li>
          <li><a class="nav-link" href="#" data-page="portfolio">Portfolio</a></li>
          <li><a class="nav-link" href="../contact.html">Contact us</a></li>
          <li class="nav-list__cta"><a class="btn btn--lime btn--sm" href="../contact.html">Pitch to us <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></a></li>
        </ul>
      </div>

      <div class="site-nav__actions">
        <button class="nav-search" type="button" aria-label="Search" aria-haspopup="dialog" aria-controls="site-search" data-search-open>
          <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-search"/></svg>
          <span class="nav-search__label" aria-hidden="true">Search</span>
        </button>
        <a class="btn btn--lime btn--sm site-nav__pitch" href="../contact.html">Pitch to us <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu" data-menu-toggle>
          <span class="nav-toggle__bar" aria-hidden="true"></span>
        </button>
      </div>
    </nav>
  </header>

  <main id="main">
    <!-- ============ SERVICE ============ -->
    <section class="svc page-top" aria-labelledby="svc-title">
      <div class="container svc__grid">
        <div class="svc__intro" data-stagger>
          <nav class="svc__crumbs reveal" aria-label="Breadcrumb">
            <a href="../services.html">Services</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">$(Esc $s.short)</span>
          </nav>
          <p class="eyebrow eyebrow--dash wipe-reveal">Service $($s.index)</p>
          <h1 class="svc__title word-reveal" id="svc-title">$title</h1>
$leads
          <div class="svc__actions reveal-group" data-stagger>
            <a class="btn btn--lime reveal-item" href="../contact.html">Pitch to us <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></a>
            <a class="svc__back reveal-item" href="../services.html"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg> Back to Services</a>
          </div>
        </div>
        <figure class="svc__media image-reveal" data-reveal-threshold="0.2">
          <img src="../../assets/images/services/$($s.image).jpg"
               srcset="../../assets/images/services/$($s.image)-480.jpg 480w, ../../assets/images/services/$($s.image).jpg 842w"
               sizes="(max-width: 1023px) 92vw, 480px"
               alt="$(Esc $s.alt)" width="842" height="1122" decoding="async">
        </figure>
      </div>
    </section>

    <!-- ============ WHAT'S INCLUDED ============ -->
    <section class="svc-detail" aria-labelledby="svc-detail-title" data-observe data-seam>
      <div class="container">
        <div class="svc-detail__head" data-stagger>
          <h2 class="svc-detail__title word-reveal" id="svc-detail-title">$(Esc $s.sectionTitle)</h2>
          <p class="svc-detail__note text-reveal">$($s.note)</p>
        </div>
        <dl class="svc-detail__list" data-stagger data-search-type="$title">
$items
        </dl>
      </div>
    </section>

    <!-- ============ CLOSING CALL ============ -->
    <section class="svc-close" aria-labelledby="svc-close-title" data-observe>
      <div class="container svc-close__inner" data-stagger>
        <h2 class="svc-close__title word-reveal" id="svc-close-title">Ready to build with us?</h2>
        <p class="svc-close__text text-reveal">Submit your vision and our team will review it personally and respond within 7 working days.</p>
        <div class="svc-close__actions reveal-group" data-stagger>
          <a class="btn btn--lime reveal-item" href="../contact.html">Pitch to us <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></a>
          <a class="svc__back reveal-item" href="../services.html"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg> Back to Services</a>
        </div>
      </div>
    </section>

    <!-- ============ OTHER SERVICES ============ -->
    <section class="svc-more" aria-labelledby="svc-more-title">
      <div class="container" data-reveal>
        <h2 class="svc-more__title" id="svc-more-title">Other services</h2>
        <ul class="svc-more__list" role="list">
$others
        </ul>
      </div>
    </section>
  </main>

  <!-- ============ FOOTER ============ -->
  <!-- data-motion: the ILLUMEXA outline draws itself as the footer scrolls in, a single light
       passes through it, and the columns, links and rule reveal in sequence. -->
  <footer class="site-footer" data-observe data-motion>
    <svg class="site-footer__outline" viewBox="0 0 4606 1000" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="outline-sweep-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".5" stop-color="#fff"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <mask id="outline-sweep" maskUnits="userSpaceOnUse" x="0" y="0" width="4606" height="1000">
          <rect class="site-footer__sweep" x="-1400" y="0" width="1400" height="1000" fill="url(#outline-sweep-fill)"/>
        </mask>
      </defs>
      <text class="site-footer__outline-text" x="2303" y="849" text-anchor="middle">ILLUMEXA</text>
      <text class="site-footer__outline-text site-footer__outline-text--light" x="2303" y="849" text-anchor="middle" mask="url(#outline-sweep)">ILLUMEXA</text>
    </svg>

    <div class="container site-footer__grid">
      <div class="site-footer__brand">
        <p class="site-footer__name word-reveal">ILLUMEXA SOLUTIONS</p>
        <p class="site-footer__about text-reveal">Architecting the future through strategic capital and technical excellence. The blueprint for modern innovation.</p>
        <div class="site-footer__social reveal-group" data-stagger>
          <a class="icon-btn reveal-item" href="../index.html" aria-label="Illumexa Solutions website">
            <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-globe"/></svg>
          </a>
          <button class="icon-btn reveal-item" type="button" aria-label="Share this page" data-share>
            <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-share"/></svg>
          </button>
          <span class="visually-hidden" aria-live="polite" data-share-status></span>
        </div>
      </div>

      <nav class="site-footer__col" aria-labelledby="footer-quick">
        <h2 class="site-footer__heading char-reveal" id="footer-quick">Quick Links</h2>
        <ul class="site-footer__links reveal-group" role="list" data-stagger>
          <li class="reveal-item"><a href="../index.html">Home</a></li>
          <li class="reveal-item"><a href="../services.html">Services</a></li>
          <li class="reveal-item"><a href="../about-us.html">About Us</a></li>
          <li class="reveal-item"><a href="../contact.html">Contact</a></li>
        </ul>
      </nav>

      <nav class="site-footer__col" aria-labelledby="footer-legal">
        <h2 class="site-footer__heading char-reveal" id="footer-legal">Legal</h2>
        <ul class="site-footer__links reveal-group" role="list" data-stagger>
          <li class="reveal-item"><a href="#" data-page="privacy">Privacy</a></li>
          <li class="reveal-item"><a href="#" data-page="terms">Terms</a></li>
          <li class="reveal-item"><a href="../faq.html">FAQ</a></li>
        </ul>
      </nav>
    </div>

    <div class="site-footer__bottom">
      <span class="site-footer__rule line-reveal" aria-hidden="true"></span>
      <div class="container site-footer__bar reveal">
        <p>© 2026 Illumexa Solutions. The blueprint for innovation.</p>
        <p class="site-footer__meta"><span>Est. 2026</span><span>Global Ops</span></p>
      </div>
    </div>
  </footer>

  <!-- ============ SEARCH ============ -->
  <dialog class="search" id="site-search" aria-labelledby="search-title" data-search>
    <h2 class="visually-hidden" id="search-title">Search the site</h2>
    <form class="search__form" role="search" data-search-form>
      <img class="search__icon" src="../../assets/images/logo/illumexa-mark.png" alt="" width="127" height="176" decoding="async">
      <label class="visually-hidden" for="search-input">Search services, steps and questions</label>
      <input class="search__input" id="search-input" type="search" placeholder="Search services, steps, FAQs…" autocomplete="off" spellcheck="false" data-search-input>
      <button class="search__close" type="button" data-search-close>Esc<span class="visually-hidden"> — close search</span></button>
    </form>
    <ul class="search__results" role="list" data-search-results></ul>
    <p class="visually-hidden" aria-live="polite" data-search-status></p>
  </dialog>
</body>
</html>
"@
  [IO.File]::WriteAllText((Join-Path $outDir "$($s.slug).html"), $html.Replace("`r`n", "`n"), $utf8)
  "wrote src/services/$($s.slug).html"
}
