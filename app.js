(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const header = $('#siteHeader');
  const menuToggle = $('#menuToggle');
  const navLinks = $('#navLinks');
  const backdrop = $('#requestModal');
  const dialog = $('.modal', backdrop);
  const form = $('#requestForm');
  const content = $('#modalContent');
  const success = $('#modalSuccess');
  const typeField = $('#requestType');
  const dateField = $('#requestedDate');
  const formError = $('#formError');
  const back = $('#formBack');
  const next = $('#formNext');
  const submit = $('#formSubmit');
  const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let step = 0;
  let lastFocused = null;
  let sending = false;

  $('#year').textContent = String(new Date().getFullYear());
  // Rotate the main service word without changing the headline for assistive technology.
  const rotatingHeadline = $('#heroRotate');
  if (rotatingHeadline && motionOK) {
    const terms = ['Laundry care.', 'Dry cleaning.', 'Garment care.'];
    let activeTerm = 0;
    window.setInterval(() => {
      if (document.hidden || backdrop.classList.contains('open')) return;
      rotatingHeadline.classList.add('is-exiting');
      window.setTimeout(() => {
        activeTerm = (activeTerm + 1) % terms.length;
        rotatingHeadline.textContent = terms[activeTerm];
        rotatingHeadline.classList.remove('is-exiting');
      }, 240);
    }, 4200);
  }

  function syncHeader() { header.classList.toggle('scrolled', scrollY > 25); }
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  if (motionOK && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { rootMargin: '0px 0px -35px 0px', threshold: .08 });
    $$('.reveal').forEach(el => observer.observe(el));
  } else $$('.reveal').forEach(el => el.classList.add('visible'));

  function closeMenu() {
    navLinks.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
  $$('#navLinks a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => {
    if (navLinks.classList.contains('open') && !navLinks.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
  });

  function localISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function syncDateLimits() {
    const today = new Date();
    const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 180);
    dateField.min = localISO(today);
    dateField.max = localISO(last);
    if (dateField.value && (dateField.value < dateField.min || dateField.value > dateField.max)) dateField.value = '';
  }

  function clearErrors() {
    formError.hidden = true;
    formError.textContent = '';
    $$('.invalid', form).forEach(el => el.classList.remove('invalid'));
    $$('[aria-invalid="true"]', form).forEach(el => el.removeAttribute('aria-invalid'));
  }
  function showError(message, field) {
    formError.textContent = message;
    formError.hidden = false;
    if (field) {
      field.classList.add('invalid');
      field.setAttribute('aria-invalid', 'true');
      field.focus({preventScroll:true});
      field.scrollIntoView({behavior:motionOK ? 'smooth' : 'auto',block:'center'});
    } else formError.scrollIntoView({behavior:'auto',block:'nearest'});
  }

  function setType(type) {
    const isPickup = type !== 'delivery';
    typeField.value = isPickup ? 'pickup' : 'delivery';
    $$('.type-tab', backdrop).forEach(tab => {
      const active = tab.dataset.type === typeField.value;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    $('#pickupServiceGroup').classList.toggle('hidden', !isPickup);
    $('#pickupQuantityGroup').classList.toggle('hidden', !isPickup);
    $('#deliveryOrderGroup').classList.toggle('hidden', isPickup);
    $('#service').required = isPickup;
    $('#modalTitle').innerHTML = isPickup ? 'Request a <em>pickup.</em>' : 'Request a <em>delivery.</em>';
    $('#modalSubtitle').textContent = isPickup
      ? 'What would you like us to collect?'
      : 'For an existing order already being cleaned by Apollo.';
    $('.progress-label', backdrop).textContent = isPickup ? 'Service' : 'Order';
    clearErrors();
  }

  function renderReview() {
    const requestType = typeField.value;
    const isPickup = requestType === 'pickup';
    const address = [$('#address').value.trim(), $('#unit').value.trim(), $('#city').value.trim(), $('#zip').value.trim()].filter(Boolean).join(', ');
    const values = [
      ['Request', isPickup ? 'Pickup' : 'Delivery'],
      [isPickup ? 'Service' : 'Order', isPickup ? $('#service').value : ($('#orderNumber').value.trim() || 'Reference not provided')],
      ...(isPickup && $('#quantity').value ? [['Amount', $('#quantity').value]] : []),
      ['Address', address],
      ['Preferred date', formatDate(dateField.value)],
      ['Time window', $('#timeWindow').selectedOptions[0]?.textContent || 'Not selected'],
      ['Contact', $('#contactMethod').value || 'Not selected']
    ];
    const review = $('#requestSummary');
    review.replaceChildren();
    for (const [label, value] of values) {
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      review.append(dt, dd);
    }
  }
  function formatDate(iso) {
    if (!iso) return 'Not selected';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {weekday:'short',month:'short',day:'numeric',year:'numeric'});
  }
  function focusStepTitle() {
    const title = $('#modalTitle');
    title.setAttribute('tabindex', '-1');
    title.focus({preventScroll:true});
  }
  function setStep(target, focusTitle = false) {
    step = Math.min(2, Math.max(0, target));
    $$('.form-step', form).forEach(el => el.classList.toggle('hidden', Number(el.dataset.step) !== step));
    $$('.progress-part', backdrop).forEach((el, index) => {
      el.classList.toggle('active', index === step);
      el.classList.toggle('complete', index < step);
      $('span', el).textContent = String(index + 1);
    });
    $('#stepStatus').textContent = `Step ${step+1} of 3: ${['Service or order','Address and time','Contact and review'][step]}`;
    back.hidden = step === 0;
    next.classList.toggle('hidden', step === 2);
    submit.classList.toggle('hidden', step !== 2);
    if (step === 2) renderReview();
    clearErrors();
    dialog.scrollTo({top:0,behavior:motionOK ? 'smooth' : 'auto'});
    if (focusTitle) focusStepTitle();
  }

  function validateStep(number = step) {
    const container = $(`.form-step[data-step="${number}"]`, form);
    const fields = $$('input,select,textarea', container).filter(field => !field.closest('.hidden') && field.type !== 'hidden');
    for (const field of fields) {
      if (!field.checkValidity()) {
        const name = $('label[for="' + field.id + '"]')?.textContent?.replace(/\*|\([^)]*\)/g,'').trim().toLowerCase() || (field.name === 'contactConsent' ? 'consent to be contacted' : 'this field');
        showError(field.validity.valueMissing ? `Please complete ${name}.` : `Please enter a valid ${name}.`, field);
        return false;
      }
    }
    if (number === 1) {
      const zip = $('#zip');
      if (!/^\d{5}(?:-\d{4})?$/.test(zip.value.trim())) { showError('Please use a valid five-digit ZIP code.', zip); return false; }
      const date = dateField.value;
      if (!date || date < dateField.min || date > dateField.max) { showError('Please choose a date within the next 180 days.', dateField); return false; }
    }
    if (number === 2) {
      const phone = $('#phone');
      if (phone.value.replace(/\D/g, '').length < 10) { showError('Please enter a valid phone number.', phone); return false; }
    }
    clearErrors();
    return true;
  }

  function openRequest(type, service) {
    if (sending) return;
    lastFocused = document.activeElement;
    form.reset();
    syncDateLimits();
    content.classList.remove('hidden');
    success.classList.add('hidden');
    setType(type);
    if (type !== 'delivery' && service) $('#service').value = service;
    setStep(0);
    closeMenu();
    document.body.classList.add('modal-open');
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden','false');
    $('#modalClose').focus({preventScroll:true});
  }
  function closeRequest() {
    if (sending) return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus({preventScroll:true});
  }
  $$('.request-trigger').forEach(button => button.addEventListener('click', () => openRequest(button.dataset.type || 'pickup', button.dataset.service)));
  $$('.type-tab').forEach(tab => tab.addEventListener('click', () => setType(tab.dataset.type)));
  $('#modalClose').addEventListener('click', closeRequest);
  $('#successClose').addEventListener('click', closeRequest);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) closeRequest(); });

  document.addEventListener('keydown', event => {
    if (!backdrop.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeRequest(); return; }
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not(:disabled), input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]', backdrop)
      .filter(el => el.getClientRects().length && !el.closest('.hidden') && !el.classList.contains('honeypot') && !el.hidden);
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
  });

  next.addEventListener('click', () => { if (validateStep()) setStep(step + 1, true); });
  back.addEventListener('click', () => setStep(step - 1, true));
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && step < 2 && event.target.matches('input:not([type="checkbox"]), select')) {
      event.preventDefault();
      if (validateStep()) setStep(step + 1, true);
    }
  });
  $$('input,select,textarea', form).forEach(input => {
    input.addEventListener('input', () => { if (!formError.hidden) clearErrors(); });
    input.addEventListener('change', () => { if (!formError.hidden) clearErrors(); });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    syncDateLimits();
    // Validate all steps again so Enter / scripted submit can't skip steps.
    for (const index of [0,1,2]) {
      if (index !== step) setStep(index);
      if (!validateStep(index)) return;
    }
    setStep(2);
    const raw = Object.fromEntries(new FormData(form));
    const fields = ['requestType','service','quantity','orderNumber','items','address','unit','city','zip','requestedDate','timeWindow','firstName','lastName','email','phone','contactMethod','contactConsent','website'];
    const payload = Object.fromEntries(fields.map(field => [field, String(raw[field] || '').trim()]));
    sending = true;
    submit.disabled = true;
    submit.textContent = 'Sending request…';
    clearErrors();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch('/api/request', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        const unavailable = response.status === 404 || response.status === 503;
        throw new Error(unavailable
          ? 'Online requests are not active yet. Please try again after Apollo has enabled the email service.'
          : (result.error || 'The request could not be sent. Please try again.'));
      }
      content.classList.add('hidden');
      success.classList.remove('hidden');
      $('#successReference').textContent = result.reference || 'Received';
      dialog.scrollTo({top:0,behavior:'auto'});
      $('#successClose').focus({preventScroll:true});
    } catch (error) {
      showError(error.name === 'AbortError'
        ? 'The request timed out. Please try again. If you are unsure it was received, contact Apollo before resending.'
        : error.message || 'Could not send your request. Check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submit.textContent = 'Send request';
    }
  });
})();
