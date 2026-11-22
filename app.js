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
  const street = $('#address');
  const options = $('#addressOptions');
  const addressStatus = $('#addressStatus');
  let addressChoice = null;
  let verifiedAddress = null;
  let addressController;
  let addressTimer;
  let addressEpoch = 0;
  let activeOption = -1;
  let matches = [];
  const fullAddress = a => `${a.street}, ${a.city}, NY ${a.zip}`;
  const unableToVerify = 'We couldn’t verify this address. Please try again or call Apollo at (929) 264-6070.';

  $('#year').textContent = String(new Date().getFullYear());
  // Manual review navigation: no autoplay, animation, or focus changes.
  const reviewSlides = $$('.review-slide');
  const carouselControls = $('.carousel-controls');
  if (reviewSlides.length && carouselControls) {
    let reviewIndex = 0;
    const showReview = index => {
      reviewIndex = (index + reviewSlides.length) % reviewSlides.length;
      reviewSlides.forEach((slide, i) => { slide.hidden = i !== reviewIndex; });
      $('#reviewStatus').textContent = `Review ${reviewIndex + 1} of ${reviewSlides.length}`;
    };
    $('#reviewPrevious').addEventListener('click', () => showReview(reviewIndex - 1));
    $('#reviewNext').addEventListener('click', () => showReview(reviewIndex + 1));
    carouselControls.hidden = false;
    showReview(0);
  }

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
    updateSubtitle();
    clearErrors();
  }

  function renderReview() {
    const requestType = typeField.value;
    const isPickup = requestType === 'pickup';
    const address = verifiedAddress ? [verifiedAddress.street, $('#unit').value.trim(), verifiedAddress.city + ', NY ' + verifiedAddress.zip].filter(Boolean).join(', ') : '';
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
  function updateSubtitle() {
    $('#modalSubtitle').textContent = step === 0 ? 'First, check whether your address is in our service area.'
      : (typeField.value === 'pickup' ? 'Tell us what needs cleaning.' : 'For an existing order already being cleaned by Apollo.');
  }
  function setStep(target, focusTitle = false) {
    step = target;
    $$('.form-step', form).forEach(el => el.classList.toggle('hidden', Number(el.dataset.step) !== step));
    $$('.progress-part', backdrop).forEach((el, index) => {
      el.classList.toggle('active', index === step);
      el.classList.toggle('complete', index < step);
      if (index === step) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
    $('#stepStatus').textContent = `Step ${step+1} of 2: ${step === 0 ? 'Address' : 'Request details'}`;
    back.hidden = step === 0;
    back.textContent = 'Back to address';
    next.classList.toggle('hidden', step === 1);
    submit.classList.toggle('hidden', step !== 1);
    if (step === 1) {
      $('#verifiedAddress').textContent = 'In our service area: ' +
        [verifiedAddress.street, $('#unit').value.trim(), verifiedAddress.city + ', NY ' + verifiedAddress.zip].filter(Boolean).join(', ');
      renderReview();
    }
    updateSubtitle();
    clearErrors();
    dialog.scrollTo({top:0,behavior:'auto'});
    content.scrollTo({top:0,behavior:'auto'});
    if (focusTitle) focusStepTitle();
  }

  function validateDetails() {
    const fields = $$('.form-step[data-step="1"] input, .form-step[data-step="1"] select, .form-step[data-step="1"] textarea', form)
      .filter(field => !field.closest('.hidden'));
    for (const field of fields) {
      if (!field.checkValidity()) {
        const name = $('label[for="' + field.id + '"]')?.textContent?.replace(/\*|\([^)]*\)/g,'').trim().toLowerCase() || (field.name === 'contactConsent' ? 'consent to be contacted' : 'this field');
        showError(field.validity.valueMissing ? `Please complete ${name}.` : `Please enter a valid ${name}.`, field);
        return false;
      }
    }
    if (!dateField.value || dateField.value < dateField.min || dateField.value > dateField.max) {
      showError('Please choose a date within the next 180 days.', dateField); return false;
    }
    const phone = $('#phone');
    if (phone.value.replace(/\D/g, '').length < 10) { showError('Please enter a valid phone number.', phone); return false; }
    clearErrors();
    return true;
  }

  function closeOptions() {
    matches = [];
    activeOption = -1;
    options.replaceChildren();
    options.hidden = true;
    street.setAttribute('aria-expanded', 'false');
    street.removeAttribute('aria-activedescendant');
  }
  function cancelAddressWork() {
    addressEpoch++;
    clearTimeout(addressTimer);
    addressController?.abort();
    addressController = undefined;
    next.disabled = false;
    next.textContent = 'Check address';
    closeOptions();
  }
  function resetAddress() {
    cancelAddressWork();
    addressChoice = null;
    verifiedAddress = null;
    addressStatus.textContent = '';
  }
  function setActive(index) {
    activeOption = index;
    Array.from(options.children).forEach((el, i) => el.setAttribute('aria-selected', String(i === index)));
    const option = options.children[index];
    if (option) {
      street.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({block:'nearest'});
    } else street.removeAttribute('aria-activedescendant');
  }
  function pickAddress(index) {
    const selected = matches[index];
    if (!selected) return;
    cancelAddressWork();
    addressChoice = selected;
    verifiedAddress = null;
    const unit = $('#unit');
    const pastedUnit = /(?:#\s*|\b(?:APT|APARTMENT|UNIT|SUITE|FL)\.?\s+)([A-Z0-9][A-Z0-9-]{0,15})(?=[,\s]|$)/i.exec(street.value)?.[1];
    if (!unit.value.trim() && pastedUnit) unit.value = pastedUnit;
    street.value = fullAddress(selected);
    addressStatus.textContent = 'Address selected. Choose Check address to continue.';
    clearErrors();
    street.focus({preventScroll:true});
  }
  async function addressFetch(payload, controller) {
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/address', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal
      });
      const data = await response.json().catch(() => ({}));
      return {response,data};
    } finally { clearTimeout(timeout); }
  }
  async function searchAddresses(query, fromButton = false) {
    cancelAddressWork();
    const epoch = addressEpoch;
    const controller = addressController = new AbortController();
    addressStatus.textContent = 'Finding addresses…';
    try {
      const {response,data} = await addressFetch({query},controller);
      if (epoch !== addressEpoch || step !== 0 || street.value.trim() !== query || !backdrop.classList.contains('open')) return;
      if (!response.ok || !Array.isArray(data.suggestions)) throw new Error(unableToVerify);
      matches = data.suggestions.filter(a => a && typeof a.id === 'string' && a.street && a.city && a.zip).slice(0,7);
      if (!matches.length) {
        addressStatus.textContent = 'No matching address. Check the house number and street, or call Apollo.';
        return;
      }
      matches.forEach((match,index) => {
        const item = document.createElement('li');
        item.id = `address-option-${index}`;
        item.setAttribute('role','option');
        item.setAttribute('aria-selected','false');
        item.textContent = fullAddress(match);
        item.addEventListener('mousedown', event => event.preventDefault());
        item.addEventListener('click', () => pickAddress(index));
        options.append(item);
      });
      options.hidden = false;
      street.setAttribute('aria-expanded','true');
      addressStatus.textContent = `${matches.length} address ${matches.length === 1 ? 'match' : 'matches'}. Choose your exact address.`;
      if (fromButton) street.focus({preventScroll:true});
    } catch {
      if (epoch === addressEpoch) addressStatus.textContent = unableToVerify;
    }
  }
  async function checkAddress() {
    if (next.disabled) return;
    clearErrors();
    const query = street.value.trim();
    if (!query) { showError('Enter your street address first.', street); return; }
    if (!addressChoice || query !== fullAddress(addressChoice)) {
      if (matches.length && !options.hidden) {
        street.focus({preventScroll:true});
        if (activeOption === -1) setActive(0);
        return;
      }
      await searchAddresses(query, true);
      return;
    }
    cancelAddressWork();
    const epoch = addressEpoch;
    const choice = addressChoice;
    const controller = addressController = new AbortController();
    next.disabled = true;
    next.textContent = 'Checking address…';
    try {
      const {response,data} = await addressFetch({id:choice.id}, controller);
      if (epoch !== addressEpoch || !backdrop.classList.contains('open') || street.value !== fullAddress(choice)) return;
      if (!response.ok || data.address?.eligible !== true) {
        showError(data.code === 'address_outside' && data.error ? data.error : unableToVerify);
        return;
      }
      if (data.address.id !== choice.id || fullAddress(data.address) !== fullAddress(choice)) {
        resetAddress();
        showError('This address changed during verification. Please choose it again.',street);
        return;
      }
      verifiedAddress = data.address;
      addressStatus.textContent = '';
      setStep(1,true);
    } catch {
      if (epoch === addressEpoch) showError(unableToVerify);
    } finally {
      if (epoch === addressEpoch) {
        next.disabled = false;
        next.textContent = 'Check address';
      }
    }
  }
  street.addEventListener('input', () => {
    resetAddress();
    const query = street.value.trim();
    if (query.length >= 5 && /^\d/.test(query)) addressTimer = setTimeout(() => searchAddresses(query), 260);
  });
  street.addEventListener('keydown', event => {
    if (!options.hidden && ['ArrowDown','ArrowUp','Escape','Enter'].includes(event.key)) {
      if (event.key === 'Enter' && activeOption < 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') closeOptions();
      else if (event.key === 'Enter') pickAddress(activeOption);
      else if (activeOption < 0) setActive(event.key === 'ArrowDown' ? 0 : matches.length-1);
      else setActive((activeOption + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
    }
    if (event.key === 'Tab' && !next.disabled) cancelAddressWork();
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.address-search') && !event.target.closest('#formNext') && !options.hidden) closeOptions();
  });
  street.addEventListener('blur', event => {
    if (!next.disabled && event.relatedTarget && event.relatedTarget !== next && !options.contains(event.relatedTarget)) cancelAddressWork();
  });

  function openRequest(type, service) {
    if (sending) return;
    lastFocused = document.activeElement;
    form.reset();
    resetAddress();
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
    resetAddress();
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

  next.addEventListener('click', checkAddress);
  back.addEventListener('click', () => setStep(0, true));
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && step === 0 && event.target.matches('input:not([type="checkbox"])')) {
      event.preventDefault();
      checkAddress();
    }
  });
  $$('input,select,textarea', form).forEach(input => {
    input.addEventListener('input', () => { if (!formError.hidden) clearErrors(); });
    input.addEventListener('change', () => {
      if (!formError.hidden) clearErrors();
      if (step === 1) renderReview();
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    syncDateLimits();
    if (step !== 1 || !verifiedAddress || street.value !== fullAddress(verifiedAddress)) {
      setStep(0);
      showError('Choose and check your street address first.',street);
      return;
    }
    if (!validateDetails()) return;
    const raw = Object.fromEntries(new FormData(form));
    const fields = ['requestType','service','quantity','orderNumber','items','unit','requestedDate','timeWindow','firstName','lastName','email','phone','contactMethod','contactConsent','website'];
    const payload = Object.fromEntries(fields.map(field => [field, String(raw[field] || '').trim()]));
    Object.assign(payload, {addressId:verifiedAddress.id, address:verifiedAddress.street, city:verifiedAddress.city, zip:verifiedAddress.zip});
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
        if (String(result.code).startsWith('address_')) {
          resetAddress();
          setStep(0);
          showError(result.error || unableToVerify,street);
          return;
        }
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
