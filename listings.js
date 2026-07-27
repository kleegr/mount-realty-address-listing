/*!
 * Mount Realty — GHL Opportunity Address Autocomplete
 * -------------------------------------------------------
 * Runs inside GoHighLevel via sub-account Custom JS.
 *
 * Part 1: "Listing Address"      -> primary single box, US-only Google Places autocomplete.
 * Part 2: "Additional Addresses" -> a "+ Add address" repeater (US-only autocomplete on each row).
 *          All extra rows are serialized (newline-separated) into the single native
 *          "Additional Addresses" field so GoHighLevel saves them reliably.
 *
 * Requirements (set in the SAME Custom JS box, BEFORE loading this file):
 *   window.MR_GOOGLE_KEY = 'YOUR_GOOGLE_MAPS_JS_API_KEY';
 *
 * The two field LABELS below must match the custom fields you create in the
 * "General Listings" folder exactly. If GoHighLevel changes its UI and the script
 * stops finding fields, adjust the selectors in findFieldByLabel().
 */
(function () {
  'use strict';

  var CONFIG = {
    primaryLabel: 'Listing Address',        // Part 1 field label
    additionalLabel: 'Additional Addresses', // Part 2 storage field label
    country: 'us',                           // US-only suggestions
    rowSeparator: '\n',
    googleKey: window.MR_GOOGLE_KEY || ''
  };

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

  (function loadGoogle() {
    if (window.google && window.google.maps && window.google.maps.places) { window.__mrGmapsInit(); return; }
    if (document.getElementById('mr-gmaps-js')) { return; }
    if (!CONFIG.googleKey) { return; }
    var s = document.createElement('script');
    s.id = 'mr-gmaps-js';
    s.async = true;
    s.defer = true;
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(CONFIG.googleKey) +
            '&libraries=places&callback=__mrGmapsInit';
    document.head.appendChild(s);
  })();

  /* ---------- Keep the Places dropdown above the GHL modal ---------- */
  (function injectStyle() {
    var st = document.createElement('style');
    st.textContent =
      '.pac-container{z-index:2147483647 !important;}' +
      '.mr-rep{margin-top:6px;}' +
      '.mr-rep-row{display:flex;gap:6px;margin-bottom:6px;align-items:center;}' +
      '.mr-rep-input{flex:1;padding:7px 9px;border:1px solid #d0d5dd;border-radius:6px;font-size:14px;}' +
      '.mr-rep-rm{border:none;background:#f2f4f7;border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:18px;line-height:1;color:#667085;}' +
      '.mr-rep-rm:hover{background:#fee4e2;color:#d92d20;}' +
      '.mr-rep-add{border:1px dashed #98a2b3;background:#fff;border-radius:6px;padding:7px 12px;cursor:pointer;font-size:13px;color:#344054;}' +
      '.mr-rep-add:hover{background:#f9fafb;}';
    document.head.appendChild(st);
  })();

  /* ---------- React-safe value setter (so GHL actually saves it) ---------- */
  function setNativeValue(el, value) {
    var proto = (el instanceof HTMLTextAreaElement) ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) { desc.set.call(el, value); } else { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------- Find a field's input/textarea by its visible label ---------- */
  function findFieldByLabel(labelText) {
    var want = labelText.trim().toLowerCase();
    var labels = document.querySelectorAll('label, .label, [class*="label"], [class*="Label"]');
    for (var i = 0; i < labels.length; i++) {
      var txt = (labels[i].textContent || '').trim().toLowerCase().replace(/\s*\*$/, '');
      if (txt === want) {
        var node = labels[i];
        for (var up = 0; up < 5 && node; up++) {
          var input = node.querySelector ? node.querySelector('input:not([type=hidden]), textarea') : null;
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
      // Stop Enter from submitting/closing the modal while picking a suggestion.
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && document.querySelector('.pac-container:not([style*="display: none"])')) {
          e.preventDefault();
        }
      });
    });
  }

  /* ---------- Part 2: the "+ Add address" repeater ---------- */
  function buildRepeater(storageInput) {
    if (!storageInput || storageInput.__mrRepeater) { return; }
    storageInput.__mrRepeater = true;

    var host = storageInput.closest('[class*="form-group"], .field, .n-form-item') || storageInput.parentElement;
    storageInput.style.display = 'none'; // keep it for storage, hide from view

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
    function save() {
      setNativeValue(storageInput, collect().join(CONFIG.rowSeparator));
    }
    function addRow(value) {
      var row = document.createElement('div');
      row.className = 'mr-rep-row';

      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'mr-rep-input';
      inp.placeholder = 'Start typing an address…';
      inp.value = value || '';
      inp.addEventListener('input', save);
      attachAutocomplete(inp, save);

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'mr-rep-rm';
      rm.textContent = '×';
      rm.title = 'Remove';
      rm.addEventListener('click', function () { row.remove(); save(); });

      row.appendChild(inp);
      row.appendChild(rm);
      wrap.insertBefore(row, addBtn);
      return inp;
    }

    addBtn.addEventListener('click', function () { addRow('').focus(); });
    wrap.appendChild(addBtn);

    // Seed rows from whatever is already stored on this opportunity.
    var existing = (storageInput.value || '')
      .split(CONFIG.rowSeparator)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (existing.length) { existing.forEach(addRow); } else { addRow(''); }
  }

  /* ---------- Scan whenever the opportunity panel renders ---------- */
  function scan() {
    var primary = findFieldByLabel(CONFIG.primaryLabel);
    if (primary) { attachAutocomplete(primary); }

    var additional = findFieldByLabel(CONFIG.additionalLabel);
    if (additional) { buildRepeater(additional); }
  }

  var scanTimer = null;
  var obs = new MutationObserver(function () {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 300);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  scan();

  console.log('[MR Address] listings.js loaded.');
})();
