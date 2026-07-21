/**
 * Shared funnel lead + on-page booking embed for oxyhyperbaric landings.
 * Config via window.OXY_FUNNEL_CONFIG before this script loads.
 */
(function () {
  var cfg = window.OXY_FUNNEL_CONFIG || {};
  var STORAGE_KEY = cfg.storageKey || 'oxy_funnel_lead';
  var PENDING_KEY = 'oxy_funnel_pending';
  var BOOKING_BASE = cfg.bookingBase || 'https://oxy-agenda.vercel.app/booking/us';
  var SERVICE = cfg.service || '';
  var SOURCE = cfg.source || 'hyperbaric';
  var LEAD_ANCHOR = '#lead-form';
  var ABANDON_MS = Number(cfg.abandonAfterMs) || 15 * 60 * 1000;
  var SUBMIT_LABEL = cfg.submitLabel || 'Reserve — $49';

  var form = document.getElementById('lead-form-el');
  var successPanel = document.getElementById('success-panel');
  var formError = document.getElementById('form-error');
  var submitBtn = document.getElementById('submit-btn');
  var bookingFrame = document.getElementById('booking-embed');
  var bookedPanel = document.getElementById('booked-panel');
  var ctaEls = document.querySelectorAll('.js-cta');

  var pendingLead = null;
  var skipAbandon = false;
  var abandonSent = false;
  var abandonTimer = null;

  function hasLead() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function setLeadSubmitted() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  function clearLeadFlags() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(PENDING_KEY);
    } catch (e) {}
  }

  function savePendingLead(lead) {
    pendingLead = lead;
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(lead)); } catch (e) {}
  }

  function loadPendingLead() {
    try {
      var raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function sendAbandonBeacon() {
    if (abandonSent || skipAbandon || !pendingLead) return;
    abandonSent = true;
    if (abandonTimer) {
      clearTimeout(abandonTimer);
      abandonTimer = null;
    }
    var body = JSON.stringify(pendingLead);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/funnel-lead-abandon', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) {}
    try {
      fetch('/api/funnel-lead-abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      });
    } catch (e2) {}
  }

  function scheduleAbandon() {
    if (abandonTimer) clearTimeout(abandonTimer);
    abandonTimer = setTimeout(function () {
      sendAbandonBeacon();
    }, ABANDON_MS);
  }

  function packFunnel(lead) {
    return btoa(unescape(encodeURIComponent(JSON.stringify({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      goal: lead.goal || '',
      source: lead.source || SOURCE,
    })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function buildBookingUrl(lead, embed) {
    var url = BOOKING_BASE;
    var params = [];
    if (SERVICE) params.push('service=' + encodeURIComponent(SERVICE));
    if (embed) params.push('embed=1');
    if (lead) {
      try {
        params.push('oxy_funnel=' + packFunnel(lead));
      } catch (e) {}
    }
    if (!params.length) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + params.join('&');
  }

  function mountBookingEmbed(lead) {
    if (!bookingFrame) return;
    bookingFrame.src = buildBookingUrl(lead, true);
    bookingFrame.removeAttribute('hidden');
    bookingFrame.classList.add('visible');
  }

  function trackMeta(eventName, params) {
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', eventName, params || {});
      }
    } catch (e) {}
  }

  function trackMetaLead() {
    trackMeta('Lead', {
      content_name: SOURCE === 'infrabaldan' ? 'Red Light InfraBaldan' : 'Hyperbaric First Session',
      content_category: 'wellness'
    });
  }

  function showBookedSuccess() {
    skipAbandon = true;
    abandonSent = true;
    if (abandonTimer) {
      clearTimeout(abandonTimer);
      abandonTimer = null;
    }
    pendingLead = null;
    clearLeadFlags();
    trackMeta('Schedule', {
      content_name: SOURCE === 'infrabaldan' ? 'Red Light InfraBaldan' : 'Hyperbaric First Session',
      content_category: 'wellness'
    });
    if (bookingFrame) {
      bookingFrame.setAttribute('hidden', 'hidden');
      bookingFrame.removeAttribute('src');
    }
    if (bookedPanel) bookedPanel.classList.add('visible');
    if (successPanel) {
      var intro = successPanel.querySelector('.success-intro');
      if (intro) intro.classList.add('hidden');
    }
  }

  function showSuccess() {
    if (form) form.classList.add('hidden');
    if (successPanel) successPanel.classList.add('visible');
    mountBookingEmbed(pendingLead);
  }

  function updateCtas() {
    var ready = hasLead();
    ctaEls.forEach(function (el) {
      if (ready) {
        el.href = LEAD_ANCHOR;
        el.setAttribute('data-scroll-only', '1');
        var bookLabel = el.getAttribute('data-label-book') || 'Book Now';
        el.textContent = bookLabel;
      } else {
        el.href = LEAD_ANCHOR;
        el.setAttribute('data-scroll-only', '1');
        var formLabel = el.getAttribute('data-label-form') || 'Reserve';
        el.textContent = formLabel;
      }
    });
  }

  pendingLead = loadPendingLead();
  if (hasLead() && pendingLead) {
    showSuccess();
    updateCtas();
    scheduleAbandon();
  } else if (hasLead()) {
    showSuccess();
    updateCtas();
  }

  window.addEventListener('pagehide', sendAbandonBeacon);
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.type !== 'oxy_funnel_booked' || data.source !== 'oxy-agenda') return;
    showBookedSuccess();
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (formError) {
        formError.classList.remove('visible');
        formError.textContent = '';
      }

      var fd = new FormData(form);
      if (fd.get('website')) {
        showSuccess();
        setLeadSubmitted();
        updateCtas();
        return;
      }

      if (!fd.get('consent')) {
        if (formError) {
          formError.textContent = 'Please accept the privacy policy to continue.';
          formError.classList.add('visible');
        }
        return;
      }

      var payload = {
        name: (fd.get('name') || '').toString().trim(),
        phone: (fd.get('phone') || '').toString().trim(),
        email: (fd.get('email') || '').toString().trim(),
        goal: (fd.get('goal') || '').toString().trim(),
        source: SOURCE,
        page: window.location.href
      };

      if (!payload.name || !payload.phone || !payload.email) {
        if (formError) {
          formError.textContent = 'Name, phone, and email are required.';
          formError.classList.add('visible');
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      fetch('/api/funnel-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              throw new Error(data.error || 'Something went wrong. Please call (713) 591-3379.');
            });
          }
          return res.json();
        })
        .then(function (data) {
          if (data && data.bookingUrl) {
            try {
              var u = new URL(data.bookingUrl);
              BOOKING_BASE = u.origin + u.pathname;
              if (!SERVICE && u.searchParams.get('service')) {
                SERVICE = u.searchParams.get('service');
              }
            } catch (err) {}
          }
          savePendingLead(payload);
          abandonSent = false;
          skipAbandon = false;
          setLeadSubmitted();
          trackMetaLead();
          showSuccess();
          updateCtas();
          scheduleAbandon();
          if (successPanel) successPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (err) {
          if (formError) {
            formError.textContent = err.message || 'Could not submit. Please try again or call (713) 591-3379.';
            formError.classList.add('visible');
          }
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = SUBMIT_LABEL;
          }
        });
    });
  }

  ctaEls.forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (el.getAttribute('href') === LEAD_ANCHOR || el.getAttribute('href') === '#lead-form') {
        e.preventDefault();
        var target = document.getElementById('lead-form');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
