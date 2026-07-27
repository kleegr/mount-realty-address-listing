# Mount Realty — GHL Opportunity Address Autocomplete

Adds a **Google Places (US-only) address autocomplete** inside the GoHighLevel
**Opportunity** add/edit panel, in a custom-fields folder called **General Listings**.

- **Part 1 — Listing Address** (the locked primary): one box, type and pick a suggestion, it prefills and saves.
- **Part 2 — Additional Addresses**: a **“＋ Add address”** button that adds more address rows (each with the same US-only autocomplete, each with a × to remove). All rows are stored together in one native field so they save reliably and reload when you reopen the opportunity.

---

## 1. Create the custom fields (one-time, in GHL)

Go to **Settings → Custom Fields**, add a folder **General Listings** on the **Opportunity** object, and create these two fields inside it with **exactly** these labels:

| Label | Type | Purpose |
|-------|------|---------|
| `Listing Address` | Single Line / Text | Part 1 — primary address (autocomplete attaches here) |
| `Additional Addresses` | Multi Line / Text | Part 2 — stores all the “add more” addresses (hidden; the ＋ rows read/write it) |

> If you change a label, update `primaryLabel` / `additionalLabel` at the top of `listings.js`.

## 2. Get a Google Maps JavaScript API key

In Google Cloud Console: enable **Maps JavaScript API** and **Places API**, create an API key, then **restrict it**:

- **Application restriction:** HTTP referrers → add your GHL domain(s), e.g. `https://app.gohighlevel.com/*` and your white-label domain `https://*.yourdomain.com/*`.
- **API restriction:** limit to Maps JavaScript API + Places API.

Because browser keys are always visible in page source, this domain restriction is what keeps the key safe — a public repo does not expose anything extra.

## 3. Paste the loader into the sub-account Custom JS

In the **specific sub-account** → **Settings → Custom JS/CSS** (Custom Code), paste:

```html
<script>
  window.MR_GOOGLE_KEY = 'YOUR_GOOGLE_MAPS_JS_API_KEY';
  (function () {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/gh/kleegr/mount-realty-address-listing@main/listings.js';
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
```

Replace `YOUR_GOOGLE_MAPS_JS_API_KEY` with your restricted key. Save, then open an Opportunity to test.

---

## Updating the script later

Edit `listings.js` in this repo. jsDelivr caches the `@main` URL for up to ~24h. For an instant refresh, either:

- Purge: visit `https://purge.jsdelivr.net/gh/kleegr/mount-realty-address-listing@main/listings.js`, **or**
- Pin a tag/commit in the loader URL (e.g. `@v1`) and bump it when you release.

## Notes & known limits

- This enhances GoHighLevel’s **native** DOM, which is not a public API. A future GHL UI update could rename elements and require a selector tweak in `findFieldByLabel()`.
- The autocomplete uses the legacy `google.maps.places.Autocomplete` widget (still supported) so it can attach to the existing native input.
- Saving relies on firing real `input`/`change` events; if a value ever fails to persist after a GHL update, that’s the first place to check.
