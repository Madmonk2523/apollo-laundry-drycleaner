(() => {
  'use strict';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const header = $('#siteHeader');
  const menuToggle = $('#menuToggle');
  const navLinks = $('#navLinks');
  const modal = $('#requestModal');
  const dialog = $('.modal', modal);
  const form = $('#requestForm');
  const modalContent = $('#modalContent');
  const modalSuccess = $('#modalSuccess');
  const requestTypeField = $('#requestType');
  const modalTitle = $('#modalTitle');
  const modalSubtitle = $('#modalSubtitle');
  const pickupServiceGroup = $('#pickupServiceGroup');
  const deliveryOrderGroup = $('#deliveryOrderGroup');
  const formError = $('#formError');
  const backButton = $('#formBack');
  const nextButton = $('#formNext');
  const submitButton = $('#formSubmit');
  const dateInput = $('#requestedDate');
  let step = 0;
  let lastFocused = null;
  let isSending = false;

  $('#year').textContent = String(new Date().getFullYear());

  function updateHeader() { header.classList.toggle('scrolled', window.scrollY > 25); }
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && motionOK) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -35px 0px', threshold: 0.08 });
    $$('.reveal').forEach(el => observer.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('visible'));
  }

  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
  $$('#navLinks a').forEach(link => link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));
  document.addEventListener('click', e => {
    if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  function localISODate(d) {
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function updateDateMin() {
    dateInput.min = localISODate(new Date());
    if (dateInput.value && dateInput.value < dateInput.min) dateInput.value = '';
  }

  function setType(type) {
    const pickup = type !== 'delivery';
    requestTypeField.value = pickup ? 'pickup' : 'delivery';
    $$('.type-tab', modal).forEach(tab => {
      const selected = tab.dataset.type === requestTypeField.value;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });
    pickupServiceGroup.classList.toggle('hidden', !pickup);
    deliveryOrderGroup.classList.toggle('hidden', pickup);
    $('#service').required = pickup;
    modalTitle.innerHTML = pickup ? 'Tell us about your <em>pickup.</em>' : 'Let’s arrange your <em>delivery.</em>';
    modalSubtitle.textContent = pickup ? 'A few details now. More free time later.' : 'Your clean clothes are one request away.';
    hideError();
  }

  function hideError() {
    formError.hidden = true;
    formError.textContent = '';
    $$('.invalid', form).forEach(el => el.classList.remove('invalid'));
  }

  function showError(message, field) {
    formError.textContent = message;
    formError.hidden = false;
    if (field) {
      field.classList.add('invalid');
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto', block: 'center' });
    } else {
      formError.scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto', block: 'nearest' });
    }
  }

  function setStep(nextStep) {
    step = Math.max(0, Math.min(2, nextStep));
    $$('.form-step', form).forEach(el => el.classList.toggle('hidden', Number(el.dataset.step) !== step));
    $$('.progress-part', modal).forEach((el, idx) => {
      el.classList.toggle('active', idx === step);
      el.classList.toggle('complete', idx < step);
      $('span', el).textContent = idx < step ? '✓' : String(idx + 1);
    });
    backButton.hidden = step === 0;
    nextButton.classList.toggle('hidden', step === 2);
    submitButton.classList.toggle('hidden', step !== 2);
    if (step === 2) updateSummary();
    hideError();
    dialog.scrollTo({ top: 0, behavior: motionOK ? 'smooth' : 'auto' });
  }

  function validCurrentStep() {
    const current = $(`.form-step[data-step="${step}"]`, form);
    const fields = $$('input,select,textarea', current).filter(el => !el.closest('.hidden') && el.type !== 'hidden');
    for (const field of fields) {
      if (!field.checkValidity()) {
        const label = $('label[for="' + field.id + '"]');
        const friendly = label?.textContent?.replace(/\*|\(.*?\)/g, '').trim().toLowerCase() || 'this field';
        return showError(`Please check ${friendly} and try again.`, field), false;
      }
    }
    if (step === 1 && $('#zip').value && !/^\d{5}(?:-\d{4})?$/.test($('#zip').value.trim())) {
      showError('Please enter a valid 5-digit ZIP code.', $('#zip'));
      return false;
    }
    if (step === 1 && dateInput.value < dateInput.min) {
      showError('Please choose today or a future preferred date.', dateInput);
      return false;
    }
    if (step === 2 && $('#phone').value.replace(/\D/g, '').length < 10) {
      showError('Please enter a phone number with at least 10 digits.', $('#phone'));
      return false;
    }
    if (step === 2 && !$('#contactConsent').checked) {
      showError('Please allow Apollo to contact you about your request.', $('#contactConsent'));
      return false;
    }
    hideError();
    return true;
  }

  function prettyDate(rawDate) {
    if (!rawDate) return 'date to be selected';
    const [y, m, d] = rawDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function updateSummary() {
    const type = requestTypeField.value;
    const service = type === 'pickup' ? ($('#service').value || 'Laundry service') : 'Laundry delivery';
    $('#requestSummary').textContent = `${type === 'pickup' ? 'Pickup' : 'Delivery'} · ${service} · ${prettyDate(dateInput.value)} (${($('#timeWindow').value || 'preferred time pending').toLowerCase()}) · ${$('#city').value || 'location to be provided'}`;
  }

  function openModal(type) {
    if (isSending) return;
    lastFocused = document.activeElement;
    form.reset();
    updateDateMin();
    modalContent.classList.remove('hidden');
    modalSuccess.classList.add('hidden');
    setType(type);
    setStep(0);
    document.body.classList.add('modal-open');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    $('#modalClose').focus({ preventScroll: true });
  }
  function closeModal() {
    if (isSending) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus({ preventScroll: true });
  }

  $$('.request-trigger').forEach(el => el.addEventListener('click', () => openModal(el.dataset.type || 'pickup')));
  $$('.type-tab').forEach(tab => tab.addEventListener('click', () => setType(tab.dataset.type)));
  $('#modalClose').addEventListener('click', closeModal);
  $('#successClose').addEventListener('click', closeModal);
  modal.addEventListener('mousedown', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]):not(.hidden),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]', modal).filter(el => el.getClientRects().length && !el.closest('.hidden') && !el.classList.contains('honeypot') && !el.hidden);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  nextButton.addEventListener('click', () => { if (validCurrentStep()) setStep(step + 1); });
  backButton.addEventListener('click', () => setStep(step - 1));
  $$('#requestForm input,#requestForm select,#requestForm textarea').forEach(el => {
    el.addEventListener('input', () => {
      if (!formError.hidden) hideError();
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSending || !validCurrentStep()) return;
    updateDateMin();
    if (dateInput.value < dateInput.min || !dateInput.value) {
      setStep(1);
      showError('Please select a preferred date that is today or later.', dateInput);
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    const fields = ['requestType','service','orderNumber','items','address','unit','city','zip','requestedDate','timeWindow','firstName','lastName','email','phone','contactConsent','website'];
    const payload = Object.fromEntries(fields.map(name => [name, String(data[name] ?? '').trim()]));
    isSending = true;
    submitButton.disabled = true;
    submitButton.innerHTML = 'Sending… <span>↗</span>';
    hideError();
    try {
      const response = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let result = {};
      try { result = await response.json(); } catch (_) { /* Clear error below */ }
      if (!response.ok || !result.success) {
        const message = response.status === 404 || response.status === 503
          ? 'Online requests are not activated yet. Please contact Apollo directly while the email setup is completed.'
          : (result.error || 'We couldn’t send that request. Please try again.');
        throw new Error(message);
      }
      modalContent.classList.add('hidden');
      modalSuccess.classList.remove('hidden');
      $('#successReference').textContent = result.reference || 'Received';
      dialog.scrollTo({ top: 0, behavior: 'auto' });
      $('#successClose').focus();
    } catch (error) {
      showError(error.message || 'The request could not be sent. Please try again.');
    } finally {
      isSending = false;
      submitButton.disabled = false;
      submitButton.innerHTML = 'Send request <span>↗</span>';
    }
  });
})();