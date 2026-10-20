/** Apollo Laundry request email endpoint — Vercel Node.js serverless function.
 * Requires RESEND_API_KEY, APOLLO_REQUEST_EMAIL, APOLLO_FROM_EMAIL.
 * No customer or business data is logged, and no request is accepted without an email send.
 */
const { randomBytes } = require('node:crypto');

const ALLOWED_SERVICES = new Set(['Wash & fold', 'Dry cleaning', 'Both wash & fold and dry cleaning', 'Not sure yet']);
const ALLOWED_WINDOWS = new Set(['Morning', 'Afternoon', 'Evening', 'Flexible']);
const ALLOWED_QUANTITIES = new Set(['', '1 bag', '2 bags', '3+ bags', 'Individual garments']);
const CONTACT_METHODS = new Set(['Email', 'Phone call']);
const getText = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 180;
const isDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const validPhone = (phone) => (phone.match(/\d/g) || []).length >= 10;

function dataFrom(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return {
    requestType: getText(body.requestType, 20),
    service: getText(body.service, 100),
    quantity: getText(body.quantity, 40),
    orderNumber: getText(body.orderNumber, 80),
    items: getText(body.items, 1200),
    address: getText(body.address, 180),
    unit: getText(body.unit, 60),
    city: getText(body.city, 90),
    zip: getText(body.zip, 10),
    requestedDate: getText(body.requestedDate, 10),
    timeWindow: getText(body.timeWindow, 20),
    firstName: getText(body.firstName, 65),
    lastName: getText(body.lastName, 65),
    email: getText(body.email, 180),
    phone: getText(body.phone, 30),
    contactMethod: getText(body.contactMethod, 30),
    contactConsent: getText(body.contactConsent, 12),
    website: getText(body.website, 500)
  };
}

function validationError(d) {
  if (d.website) return 'spam';
  if (!['pickup','delivery'].includes(d.requestType)) return 'Choose pickup or delivery.';
  if (d.requestType === 'pickup' && !ALLOWED_SERVICES.has(d.service)) return 'Select a valid service.';
  if (d.requestType === 'pickup' && !ALLOWED_QUANTITIES.has(d.quantity)) return 'Select a valid laundry amount.';
  if (!d.address || !d.city || !/^\d{5}(?:-\d{4})?$/.test(d.zip)) return 'Enter a valid street address, city, and ZIP code.';
  if (!isDate(d.requestedDate)) return 'Select a valid preferred date.';
  // Allow one day of time-zone overlap around midnight, but reject old or impractically distant dates.
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate());
  const day = Date.parse(d.requestedDate + 'T00:00:00Z');
  if (day < todayUTC - 86400000 || day > todayUTC + 181*86400000) return 'Choose a preferred date within the next 180 days.';
  if (!ALLOWED_WINDOWS.has(d.timeWindow)) return 'Choose a preferred time window.';
  if (!d.firstName || !d.lastName) return 'Enter your first and last name.';
  if (!isEmail(d.email)) return 'Enter a valid email address.';
  if (!validPhone(d.phone)) return 'Enter a valid phone number.';
  if (!CONTACT_METHODS.has(d.contactMethod)) return 'Select how you prefer to be contacted.';
  if (d.contactConsent !== 'on' && d.contactConsent !== 'true') return 'You must agree to be contacted about your request.';
  return null;
}

function emailMarkup(d, reference) {
  const rows = [
    ['Request type', d.requestType === 'pickup' ? 'Pickup' : 'Delivery'],
    [d.requestType === 'pickup' ? 'Service' : 'Order reference', d.requestType === 'pickup' ? d.service : (d.orderNumber || 'Not supplied')],
    ...(d.requestType === 'pickup' ? [['Estimated amount', d.quantity || 'Not specified']] : []),
    ['Customer', `${d.firstName} ${d.lastName}`],
    ['Email', d.email],['Phone', d.phone],['Preferred contact', d.contactMethod],
    ['Address', `${d.address}${d.unit ? ', ' + d.unit : ''}, ${d.city}, ${d.zip}`],
    ['Preferred date', d.requestedDate],['Preferred window', d.timeWindow],
    ['Notes', d.items || 'None provided']
  ];
  return `<div style="background:#edf5ff;padding:32px;font-family:Arial,sans-serif;color:#1a375c"><div style="max-width:650px;margin:auto;background:#fff;border-radius:18px;overflow:hidden"><div style="background:#2358ec;color:#fff;padding:28px 33px"><div style="letter-spacing:.17em;font-size:13px;font-weight:bold">✳ APOLLO LAUNDRY</div><h1 style="font-size:24px;margin:16px 0 5px">New ${escapeHtml(d.requestType)} request</h1><div style="font-size:13px;opacity:.85">Reference ${escapeHtml(reference)} · Not yet confirmed</div></div><div style="padding:24px 33px"><p style="font-size:14px;line-height:1.6">A customer has submitted a new request. Contact them to confirm availability, timing, and pricing before scheduling.</p><table style="width:100%;border-collapse:collapse">${rows.map(([label,value]) => `<tr><td style="font-size:12px;font-weight:bold;color:#60809c;padding:12px 8px 12px 0;border-bottom:1px solid #e6edf5;vertical-align:top;width:35%">${escapeHtml(label)}</td><td style="font-size:13px;line-height:1.5;padding:12px 0;border-bottom:1px solid #e6edf5;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join('')}</table><p style="font-size:11px;color:#8da0af;margin-top:24px">Sent by the Apollo website request form.</p></div></div></div>`;
}

async function sendWithResend(key, from, to, subject, html, replyTo) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) })
  });
  if (!response.ok) {
    // Do not echo provider response, credentials, or private data to end users.
    throw new Error(`Email service returned HTTP ${response.status}`);
  }
  return response.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ success:false,error:'Method not allowed.' }); }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return res.status(415).json({ success:false,error:'JSON is required.' });
  if (Number(req.headers['content-length'] || 0) > 30000) return res.status(413).json({success:false,error:'Request too large.'});
  let input = req.body;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return res.status(400).json({ success:false,error:'Invalid request.' }); }
  }
  const d = dataFrom(input);
  if (!d) return res.status(400).json({success:false,error:'Invalid request.'});
  const error = validationError(d);
  if (error === 'spam') return res.status(200).json({ success:true, reference:'RECEIVED' }); // Honeypot; no email sent.
  if (error) return res.status(400).json({ success:false,error });
  const key = process.env.RESEND_API_KEY;
  const inbox = process.env.APOLLO_REQUEST_EMAIL;
  const sender = process.env.APOLLO_FROM_EMAIL;
  if (!key || !inbox || !sender || !isEmail(inbox) || !isEmail(sender.replace(/^.*?<([^>]+)>$/, '$1'))) {
    return res.status(503).json({success:false,error:'Online requests are not activated yet.'});
  }
  const reference = `AP-${randomBytes(4).toString('hex').toUpperCase()}`;
  try {
    await sendWithResend(key, sender, inbox, `[Apollo] New ${d.requestType} request · ${reference}`, emailMarkup(d, reference), d.email);
    // An optional acknowledgment, deliberately not a booking confirmation.
    if (process.env.APOLLO_SEND_CUSTOMER_CONFIRMATION === 'true') {
      const html = `<div style="font-family:Arial,sans-serif;max-width:520px;color:#183953;line-height:1.7"><h2 style="color:#2359e5">Apollo received your request.</h2><p>Hi ${escapeHtml(d.firstName)},</p><p>Thanks for reaching out to Apollo Laundry Drycleaner. Your <b>${escapeHtml(d.requestType)}</b> request (${escapeHtml(reference)}) has been received.</p><p><b>Your request is not a confirmed appointment yet.</b> Our team will follow up to confirm the time, service area, and any pricing. Please do not leave laundry outside until the appointment is confirmed.</p><p>— Apollo Laundry Drycleaner</p></div>`;
      try { await sendWithResend(key, sender, d.email, `Apollo request received · ${reference}`, html); } catch (_) { /* Owner email succeeded; customer acknowledgment is optional. */ }
    }
    return res.status(200).json({success:true, reference});
  } catch (_) {
    return res.status(502).json({success:false,error:'We could not send your request. Please try again shortly.'});
  }
};
