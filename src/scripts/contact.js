/* Illumexa — contact page: pitch deck drop zone, validation and submission. */
(() => {
  'use strict';

  const form = document.querySelector('[data-pitch-form]');
  if (!form) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const dropzone = form.querySelector('[data-dropzone]');
  const dropHint = form.querySelector('[data-dropzone-hint]');
  const fileInput = form.elements.deck;
  const fileLabel = form.querySelector('[data-dropzone-file]');
  const MAX_BYTES = 20 * 1024 * 1024;
  const FIELDS = ['name', 'company', 'email', 'deck'];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SUBMIT_TEXT = submitLabel.textContent;
  const DROP_HINT = dropHint.innerHTML;
  const touched = new Set();

  const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms));

  // Restarts a one-shot entrance animation on an element whose content just changed.
  const replay = (el) => {
    el.classList.remove('is-new');
    void el.offsetWidth;
    el.classList.add('is-new');
  };

  const checkFile = (file) => {
    if (!file) return 'Please attach your pitch deck as a PDF.';
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return 'Your pitch deck needs to be a PDF file.';
    if (file.size > MAX_BYTES) return 'Please keep your pitch deck under 20 MB.';
    return '';
  };

  const check = (name) => {
    if (name === 'deck') return checkFile(fileInput.files[0]);
    const value = form.elements[name].value.trim();
    if (!value) {
      return {
        name: 'Please enter your full name.',
        company: 'Please enter your company name.',
        email: 'Please enter your email address.'
      }[name];
    }
    if (name === 'email' && !EMAIL.test(value)) return 'Please enter a valid email address, like you@company.com.';
    return '';
  };

  const show = (name, message) => {
    const field = form.querySelector(`[data-field="${name}"]`);
    const error = form.querySelector(`[data-error-for="${name}"]`);
    field.classList.toggle('has-error', Boolean(message));
    form.elements[name].setAttribute('aria-invalid', String(Boolean(message)));
    error.textContent = message;
    error.hidden = !message;
  };

  const validate = (name) => {
    const message = check(name);
    show(name, message);
    return message;
  };

  // Fields are checked once the visitor has left them, then live as they fix them.
  FIELDS.forEach((name) => {
    const control = form.elements[name];
    control.addEventListener('blur', () => {
      touched.add(name);
      validate(name);
    });
    control.addEventListener(name === 'deck' ? 'change' : 'input', () => {
      if (touched.has(name)) validate(name);
    });
  });

  // The zone confirms a usable PDF with a tick; a rejected file leaves it in its plain state.
  const showFile = () => {
    const file = fileInput.files[0];
    fileLabel.textContent = file ? `${file.name} · ${formatSize(file.size)}` : '';
    dropzone.classList.toggle('has-file', Boolean(file) && !checkFile(file));
  };

  fileInput.addEventListener('change', () => {
    touched.add('deck');
    showFile();
    validate('deck');
  });

  // Drag and drop onto the zone fills the real file input, so the form submits it normally.
  // dragenter/dragleave also fire for the zone's children, so depth is counted to avoid flicker.
  let dragDepth = 0;
  const setDragging = (on) => {
    dropzone.classList.toggle('is-dragging', on);
    if (on) dropHint.textContent = 'Release to attach your PDF';
    else dropHint.innerHTML = DROP_HINT;
  };

  dropzone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    if (dragDepth++ === 0) setDragging(true);
  });
  dropzone.addEventListener('dragover', (event) => event.preventDefault());
  dropzone.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      setDragging(false);
    }
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    setDragging(false);
    const { files } = event.dataTransfer;
    if (!files.length) return;
    const transfer = new DataTransfer();
    transfer.items.add(files[0]);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const setStatus = (message, state) => {
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
    if (message) replay(status);
  };

  // Button states: loading (spinner + travelling light), then success or error for a few seconds.
  let resetTimer = 0;
  const setButton = (state, text) => {
    clearTimeout(resetTimer);
    if (state) submit.dataset.state = state;
    else delete submit.dataset.state;
    // aria-disabled rather than disabled, so keyboard focus stays on the button while it works.
    submit.setAttribute('aria-disabled', String(state === 'loading'));
    form.setAttribute('aria-busy', String(state === 'loading'));
    submitLabel.textContent = text || SUBMIT_TEXT;
    replay(submitLabel);
    if (state === 'success' || state === 'error') {
      resetTimer = setTimeout(() => setButton(null), state === 'success' ? 5000 : 3200);
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.dataset.state === 'loading') return;
    FIELDS.forEach((name) => touched.add(name));
    const invalid = FIELDS.filter((name) => validate(name));
    if (invalid.length) {
      setButton(null);
      setStatus(`Please check ${invalid.length === 1 ? 'the highlighted field' : `the ${invalid.length} highlighted fields`}.`, 'error');
      form.elements[invalid[0]].focus();
      return;
    }

    const firstName = form.elements.name.value.trim().split(/\s+/)[0];
    const endpoint = form.dataset.endpoint;
    setStatus('');

    if (!endpoint) {
      // No backend is configured yet: say so plainly rather than pretend it was sent.
      setButton('loading', 'Processing');
      await wait(700);
      setButton('error', 'Not sent');
      setStatus(`Thanks, ${firstName}. Online submissions aren't switched on yet, so your pitch hasn't been sent.`, 'error');
      return;
    }

    setButton('loading', 'Sending');
    setStatus('Sending your pitch…');
    try {
      const response = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      touched.clear();
      showFile();
      setButton('success', 'Blueprint received');
      setStatus(`Thank you, ${firstName}. Your pitch is in. We review every application personally and respond within 7 working days.`, 'success');
    } catch (error) {
      setButton('error', 'Not sent');
      setStatus("We couldn't send your pitch. Please check your connection and try again.", 'error');
    }
  });
})();
