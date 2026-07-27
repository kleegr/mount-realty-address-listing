/*!
 * Mount Realty — GHL Opportunity Address Autocomplete   (v12)
 * Loaded via agency-level Custom JS loader. Scoped to one sub-account.
 */
(function () {
  'use strict';

  var VERSION = 'v12';
  window.MR_ADDR_VERSION = VERSION;

  var CONFIG = {
    allowedLocation: window.MR_LOCATION_ID || 'UpjC8IK37wMzeb1pc9D0',
    primaryLabel: 'Listing Address',
    additionalLabel: 'Additional Addresses',
    country: 'us',
    rowSeparator: ' ||| ',
    googleKey: window.MR_GOOGLE_KEY || ''
  };

  function onAllowedLocation() {
    if (!CONFIG.allowedLocation) { return true; }
    return window.location.href.indexOf(CONFIG.allowedLocation) !== -1;
  }

  if (!CONFIG.googleKey) {
    console.warn('[MR Address] No Google key found. Set window.MR_GOOGLE_KEY before loading this file.');
  }

  var googleReady = false, readyQueue = [];
  function onGoogleReady(cb) { if (googleReady) { cb(); } else { readyQueue.push(cb); } }
  window.__mrGmapsInit = function () {
    googleReady = true;
    readyQueue.forEach(function (c) { try { c(); } catch (e) { console.error('[MR Address]', e); } });
    readyQueue = [];
  };
  function loadGoogle() {
    if (window.google && window.google.maps && window.google.maps.places) { window.__mrGmapsInit(); return; }
    if (document.getElementById('mr-gmaps-js')) { return; }
    if (!CONFIG.googleKey) { return; }
    var s = document.createElement('script');
    s.id = 'mr-gmaps-js'; s.async = true; s.defer = true;
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(CONFIG.googleKey) +
            '&libraries=places&callback=__mrGmapsInit';
    document.head.appendChild(s);
  }

  (function injectStyle() {
    var st = document.createElement('style');
    st.textContent =
      '.pac-container{z-index:2147483647 !important;}' +
      '[data-mr-hide="1"]{position:absolute !important;left:-99999px !important;top:auto !important;width:1px !important;height:1px !important;min-height:0 !important;opacity:0 !important;pointer-events:none !important;overflow:hidden !important;}' +
      '.mr-rep{margin-top:4px;}' +
      '.mr-rep-row{display:flex;gap:6px;margin-bottom:6px;align-items:center;}' +
      '.mr-rep-input{flex:1;padding:8px 10px;border:1px solid #d0d5dd;border-radius:6px;font-size:14px;box-sizing:border-box;}' +
      '.mr-rep-input:focus{outline:none;border-color:#2f80ed;box-shadow:0 0 0 2px rgba(47,128,237,.15);}' +
      '.mr-rep-rm{border:none;background:#f2f4f7;border-radius:6px;width:32px;height:32px;min-width:32px;cursor:pointer;font-size:18px;line-height:1;color:#667085;}' +
      '.mr-rep-rm:hover{background:#fee4e2;color:#d92d20;}' +
      '.mr-rep-add{border:1px dashed #98a2b3;background:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;color:#344054;}' +
      '.mr-rep-add:hover{background:#f9fafb;}';
    document.head.appendChild(st);
  })();

  /* Dropdown gate: a Google dropdown may only be visible while an address box is focused. */
  function addrFocused() {
    var a = document.activeElement;
    return !!(a && a.getAttribute && a.getAttribute('data-mr-addr') === '1');
  }
  setInterval(function () {
    if (!addrFocused()) {
      document.querySelectorAll('.pac-container').forEach(function (pc) {
        if (pc.style.display !== 'none') { pc.style.display = 'none'; }
      });
    }
  }, 50);

  function setNativeValue(el, value) {
    var proto = (el instanceof HTMLTextAreaElement) ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) { desc.set.call(el, value); } else { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findFieldByLabel(labelText) {
    var want = labelText.trim().toLowerCase();
    var labels = document.querySelectorAll('label, .label, [class*="label"], [class*="Label"]');
    for (var i = 0; i < labels.length; i++) {
      var txt = (labels[i].textContent || '').trim().toLowerCase().replace(/\s*\*$/, '');
      if (txt === want) {
        var node = labels[i];
        for (var up = 0; up < 6 && node; up++) {
          var input = node.querySelector ? node.querySelector('input:not([type=hidden]):not(.mr-rep-input), textarea') : null;
          if (input) { return input; }
          node = node.parentElement;
        }
      }
    }
    return null;
  }

  function fieldHost(input) {
    return input.closest('.hr-form-item') ||
           input.closest('[class*="form-group"], .field, .n-form-item') ||
           input.parentElement;
  }
  function nativeControl(input) {
    return input.closest('.hr-form-item-blank') || input.closest('.hr-input') || input;
  }

  function attachAutocomplete(input, onPlace) {
    if (!input || input.__mrAuto) { return; }
    input.__mrAuto = true;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('data-mr-addr', '1');
    loadGoogle();
    onGoogleReady(function () {
      var ac = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: CONFIG.country },
        fields: ['formatted_address']
      });
      ac.addListener('place_changed', function () {
        var p = ac.getPlace();
        var addr = (p && p.formatted_address) ? p.formatted_address : input.value;
        setNativeValue(input, addr);
        if (onPlace) { onPlace(addr); }
        try { input.blur(); } catch (e) {}
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && document.querySelector('.pac-container:not([style*="display: none"])')) {
          e.preventDefault();
        }
      });
    });
  }

  function buildRepeater(storageInput) {
    var host = fieldHost(storageInput);
    if (!host || host.querySelector('.mr-rep')) { return; }

    var wrap = document.createElement('div');
    wrap.className = 'mr-rep';
    host.appendChild(wrap);

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'mr-rep-add';
    addBtn.textContent = '＋ Add address';

    function collect() {
      var vals = [];
      wrap.querySelectorAll('input.mr-rep-input').forEach(function (i) {
        if (i.value.trim()) { vals.push(i.value.trim()); }
      });
      return vals;
    }
    function save() { setNativeValue(storageInput, collect().join(CONFIG.rowSeparator)); }
    function addRow(value) {
      var row = document.createElement('div');
      row.className = 'mr-rep-row';
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'mr-rep-input';
      inp.placeholder = 'Start typing an address…';
      inp.value = value || '';
      inp.addEventListener('input', save);
      attachAutocomplete(inp, save);
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'mr-rep-rm'; rm.textContent = '×'; rm.title = 'Remove';
      rm.addEventListener('click', function () { row.remove(); save(); });
      row.appendChild(inp); row.appendChild(rm);
      wrap.insertBefore(row, addBtn);
      return inp;
    }
    addBtn.addEventListener('click', function () { addRow('').focus(); });
    wrap.appendChild(addBtn);

    var raw = storageInput.value || '';
    var parts = raw.indexOf(CONFIG.rowSeparator) !== -1 ? raw.split(CONFIG.rowSeparator) : raw.split('\n');
    var existing = parts.map(function (s) { return s.trim(); }).filter(Boolean);
    if (existing.length) { existing.forEach(addRow); } else { addRow(''); }
  }

  function ensureHidden(input) {
    var ctrl = nativeControl(input);
    if (ctrl && ctrl.getAttribute('data-mr-hide') !== '1') { ctrl.setAttribute('data-mr-hide', '1'); }
  }

  function cleanupPac() {
    if (!document.querySelector('input[data-mr-addr]')) {
      document.querySelectorAll('.pac-container').forEach(function (p) { p.remove(); });
    }
  }

  function scan() {
    if (!onAllowedLocation()) { cleanupPac(); return; }

    var primary = findFieldByLabel(CONFIG.primaryLabel);
    if (primary) { attachAutocomplete(primary); }

    var additional = findFieldByLabel(CONFIG.additionalLabel);
    if (additional) {
      ensureHidden(additional);
      buildRepeater(additional);
    }

    cleanupPac();
  }

  var scanTimer = null;
  new MutationObserver(function () {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 250);
  }).observe(document.body, { childList: true, subtree: true });
  scan();

  console.log('[MR Address] ' + VERSION + ' loaded (scoped to ' + CONFIG.allowedLocation + ').');
})();
