/*!
 * Mount Realty — GHL Opportunity Address Autocomplete
 * -------------------------------------------------------
 * Runs inside GoHighLevel via AGENCY-level Custom JS, scoped to ONE sub-account.
 *
 * Part 1: "Listing Address"      -> primary single box, US-only Google Places autocomplete.
 * Part 2: "Additional Addresses" -> a "+ Add address" repeater (US-only autocomplete on each row).
 *          Extra rows are joined with a single-line-safe delimiter into the native
 *          "Additional Addresses" field so GoHighLevel saves them reliably even if that
 *          field is a single-line text field.
 *
 * Requirements (set in the SAME Custom JS box, BEFORE loading this file):
 *   window.MR_GOOGLE_KEY = 'YOUR_GOOGLE_MAPS_JS_API_KEY';
 * Optional override of the target sub-account:
 *   window.MR_LOCATION_ID = 'someOtherLocationId';
 */
(function () {
  'use strict';

  var CONFIG = {
    allowedLocation: window.MR_LOCATION_ID || 'UpjC8IK37wMzeb1pc9D0',
    primaryLabel: 'Listing Address',
    additionalLabel: 'Additional Addresses',
    country: 'us',
    rowSeparator: ' ||| ',   // survives single-line fields (newlines get stripped by GHL)
    googleKey: window.MR_GOOGLE_KEY || ''
  };

  function onAllowedLocation() {
    if (!CONFIG.allowedLocation) { return true; }
    return window.location.href.indexOf(CONFIG.allowedLocation) !== -1;
  }

  if (!CONFIG.googleKey) {
    console.warn('[MR Address] No Google key found. Set window.MR_GOOGLE_KEY in the GHL Custom JS box BEFORE loading listings.js.');
  }

  /* ---------- Load Google Maps + Places ---------- */
  var googleReady = false;
  var readyQueue = [];
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

  /* ---------- Styles ---------- */
  (function injectStyle() {
    var st = document.createElement('style');
    st.textContent =
      '.pac-container{z-index:2147483647 !important;}' +
      '.mr-addr-hidden{position:absolute !important;left:-99999px !important;top:auto !important;width:1px !important;height:1px !important;opacity:0 !important;pointer-events:none !important;}' +
      '.mr-rep{margin-top:2px;}' +
      '.mr-rep-row{display:flex;gap:6px;margin-bottom:6px;align-items:center;}' +
      '.mr-rep-input{flex:1;padding:7px 9px;border:1px solid #d0d5dd;border-radius:6px;font-size:14px;box-sizing:border-box;}' +
      '.mr-rep-rm{border:none;background:#f2f4f7;border-radius:6px;width:30px;height:30px;min-width:30px;cursor:pointer;font-size:18px;line-height:1;color:#667085;}' +
      '.mr-rep-rm:hover{background:#fee4e2;color:#d92d20;}' +
      '.mr-rep-add{border:1px dashed #98a2b3;background:#fff;border-radius:6px;padding:7px 12px;cursor:pointer;font-size:13px;color:#344054;}' +
      '.mr-rep-add:hover{background:#f9fafb;}';
    document.head.appendChild(st);
  })();

  /* ---------- React-safe value setter ---------- */
  function setNativeValue(el, value) {
    var proto = (el instanceof HTMLTextAreaElement) ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) { desc.set.call(el, value); } else { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------- Find a field's input by its visible label ---------- */
  function findFieldByLabel(labelText) {
    var want = labelText.trim().toLowerCase();
    var labels = document.querySelectorAll('label, .label, [class*="label"], [class*="Label"]');
    for (var i = 0; i < labels.length; i++) {
      var txt = (labels[i].textContent || '').trim().toLowerCase().replace(/\s*\*$/, '');
      if (txt === want) {
        var node = labels[i];
        for (var up = 0; up < 5 && node; up++) {
          var input = node.querySelector ? node.querySelector('input:not([type=hidden]):not(.mr-rep-input), textarea') : null;
          if (input) { return input; }
          node = node.parentElement;
        }
      }
    }
    return null;
  }

  /* ---------- Attach Google autocomplete to a native input ---------- */
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
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && document.querySelector('.pac-container:not([style*="display: none"])')) {
          e.preventDefault();
        }
      });
    });
  }

  /* ---------- Part 2: the "+ Add address" repeater ----------
   * Keyed off the field's HOST container (stable) rather than the input node,
   * so GHL re-renders don't spawn duplicate/merged repeaters.
   */
  function buildRepeater(storageInput) {
    var host = storageInput.closest('[class*="form-group"], .field, .n-form-item') || storageInput.parentElement;
    if (!host || host.querySelector('.mr-rep')) { return; } // already built for this field

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

    // Seed rows from stored value. Support both the new delimiter and any legacy newline data.
    var raw = storageInput.value || '';
    var parts = raw.indexOf(CONFIG.rowSeparator) !== -1 ? raw.split(CONFIG.rowSeparator) : raw.split('\n');
    var existing = parts.map(function (s) { return s.trim(); }).filter(Boolean);
    if (existing.length) { existing.forEach(addRow); } else { addRow(''); }
  }

  function ensureHidden(el) {
    if (el && !el.classList.contains('mr-addr-hidden')) { el.classList.add('mr-addr-hidden'); }
  }

  function cleanupPac() {
    var visible = false;
    document.querySelectorAll('input[data-mr-addr]').forEach(function (i) {
      if (i.offsetParent !== null) { visible = true; }
    });
    if (!visible) {
      document.querySelectorAll('.pac-container').forEach(function (p) { p.remove(); });
    }
  }

  /* ---------- Scan ---------- */
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
  var obs = new MutationObserver(function () {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 250);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  scan();

  console.log('[MR Address] listings.js loaded (scoped to ' + CONFIG.allowedLocation + ').');
})();
