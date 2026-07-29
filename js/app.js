// EarthWatch — Historical Satellite Imagery Timeline
// Single source: ESRI Wayback Archive (Feb 2014 → present, ~0.5m)

const state = {
  map: null,
  basemapLayer: null,
  center: [27.7041, 85.3141],   // Dharahara Tower, Kathmandu
  zoom: 17,
  bbox: null,                    // [west, south, east, north] — null = use map viewport
  locationMarker: null,
  bboxRect: null,
  viewportRect: null,
  viewportLockMode: false,       // false = auto-reload on pan/zoom, true = lock to initial viewport

  satellite: 'esri_wayback',
  layer: 'world_imagery',
  basemap: 'google',

  slots: [],                     // [{id, label, date, isEvent, daysOffset}]
  loadedSlots: [],               // [{...slot, imageUrl, usedDate, bbox}]
  slotIdCounter: 0,

  gridCols: 3,
  aspectRatio: '4:3',           // '4:3' | '16:9' | '9:16'
  imageQuality: 'standard',     // 'preview' | 'standard' | 'high' | 'ultra'
  cardAspect: 4 / 3,

  compareMode: 'slider',

  // Batch sites — trace the same timeline across many locations at once
  sites: [],                     // [{id, label, center:[lat,lng], bbox, sourceType:'point'|'rectangle'|'polygon', loadedSlots:[]}]
  siteIdCounter: 0,
  siteRadiusMeters: 300,         // default AOI size for point-only sites
  batchRunning: false,
  viewMode: 'single',            // 'single' | 'batch' — which results container is shown
};

const MAX_BATCH_SITES = 30;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  addDefaultSlots();
  setLocation(state.center[0], state.center[1]);
});

// ── Map ───────────────────────────────────────────────────────────────────────
function initMap() {
  state.map = L.map('location-map', {
    center: state.center,
    zoom: state.zoom,
    zoomControl: true,
  });

  applyBasemap('google');
  applyMapAspectRatio();

  state.map.on('click', onMapClick);
  state.map.on('zoomend', onZoomEnd);
  state.map.on('moveend', onMoveEnd);

  setTimeout(() => { state.map.invalidateSize(); updateViewportOutline(); }, 100);
  window.addEventListener('resize', () => state.map.invalidateSize());
}

// Keeps the map viewport's aspect ratio in sync with the image frame so the
// area visible on the map matches what gets captured in the timeline images.
function applyMapAspectRatio() {
  const [arW, arH] = aspectRatioParts(state.aspectRatio);
  document.getElementById('location-map').style.aspectRatio = `${arW} / ${arH}`;
  requestAnimationFrame(() => {
    if (!state.map) return;
    state.map.invalidateSize();
    updateViewportOutline();
  });
}

const BASEMAPS = {
  google: {
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '© <a href="https://maps.google.com">Google</a>',
    maxZoom: 23,
    maxNativeZoom: 21,
    subdomains: ['0', '1', '2', '3'],
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  carto: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap © <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
};

function applyBasemap(id) {
  if (state.basemapLayer) state.map.removeLayer(state.basemapLayer);
  const cfg = BASEMAPS[id] || BASEMAPS.google;
  const opts = { attribution: cfg.attribution, maxZoom: cfg.maxZoom };
  if (cfg.subdomains)    opts.subdomains    = cfg.subdomains;
  if (cfg.maxNativeZoom) opts.maxNativeZoom = cfg.maxNativeZoom;
  state.basemapLayer = L.tileLayer(cfg.url, opts);
  state.basemapLayer.addTo(state.map);
  state.basemap = id;
  const sel = document.getElementById('basemap-select');
  if (sel) sel.value = id;
}

function onMapClick(e) {
  setLocation(e.latlng.lat, e.latlng.lng);
}

function onZoomEnd() {
  document.getElementById('map-zoom-info').textContent = `Zoom: ${state.map.getZoom()}`;
  updateViewportOutline();
  if (!state.viewportLockMode && !state.bbox) reloadIfImagesLoaded();
}

function onMoveEnd() {
  const c = state.map.getCenter();
  document.getElementById('map-coords').textContent =
    `Center: ${c.lat.toFixed(4)}°, ${c.lng.toFixed(4)}°`;
  updateViewportOutline();
  if (!state.viewportLockMode && !state.bbox) reloadIfImagesLoaded();
}

function updateViewportOutline() {
  if (state.bbox) {
    if (state.viewportRect) { state.map.removeLayer(state.viewportRect); state.viewportRect = null; }
    return;
  }
  const bounds = state.map.getBounds();
  if (state.viewportRect) {
    state.viewportRect.setBounds(bounds);
  } else {
    state.viewportRect = L.rectangle(bounds, {
      color: '#4493f8', weight: 2, fillOpacity: 0.04, dashArray: '6 4', interactive: false,
    }).addTo(state.map);
  }
}

function setLocation(lat, lng) {
  state.center = [lat, lng];
  document.getElementById('lat-input').value = lat.toFixed(5);
  document.getElementById('lng-input').value = lng.toFixed(5);
  if (state.locationMarker) state.map.removeLayer(state.locationMarker);
  state.locationMarker = L.circleMarker([lat, lng], {
    radius: 8, color: '#4a9eff', weight: 3, fillColor: '#4a9eff', fillOpacity: 0.3,
  }).addTo(state.map);
}

function drawBboxOnMap() {
  if (!state.bbox) return;
  if (state.bboxRect) state.map.removeLayer(state.bboxRect);
  const [w, s, e, n] = state.bbox;
  state.bboxRect = L.rectangle([[s, w], [n, e]], {
    color: '#4a9eff', weight: 2, fill: true, fillColor: '#4a9eff', fillOpacity: 0.1, dashArray: '6, 4',
  }).addTo(state.map);
}

function updateAoiInfo() {
  if (!state.bbox) { document.getElementById('aoi-info').style.display = 'none'; return; }
  const [w, s, e, n] = state.bbox;
  document.getElementById('aoi-info').style.display = 'flex';
  document.getElementById('aoi-coords-display').textContent =
    `${s.toFixed(2)}°S, ${w.toFixed(2)}°W → ${n.toFixed(2)}°N, ${e.toFixed(2)}°E`;
}

function clearAoi() {
  state.bbox = null;
  if (state.bboxRect) { state.map.removeLayer(state.bboxRect); state.bboxRect = null; }
  if (state.locationMarker) { state.map.removeLayer(state.locationMarker); state.locationMarker = null; }
  document.getElementById('aoi-info').style.display = 'none';
  document.getElementById('lat-input').value = '';
  document.getElementById('lng-input').value = '';
  updateViewportOutline();
}

// ── Batch Sites ────────────────────────────────────────────────────────────────
// Approximate a square bbox of the given radius (meters) around a point.
// Good enough for "default AOI around a point" purposes — not geodesically exact.
function bboxFromPoint(lat, lng, radiusMeters) {
  const latSpan = radiusMeters / 111320;
  const lonSpan = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
  return [
    +(lng - lonSpan).toFixed(6), +(lat - latSpan).toFixed(6),
    +(lng + lonSpan).toFixed(6), +(lat + latSpan).toFixed(6),
  ];
}

function getSiteById(id) {
  return state.sites.find(s => s.id === id);
}

function addSite({ label, center, bbox, sourceType }) {
  if (state.sites.length >= MAX_BATCH_SITES) {
    showToast(`Batch is capped at ${MAX_BATCH_SITES} sites.`, 'warning', 5000);
    return null;
  }
  const id = ++state.siteIdCounter;
  const site = {
    id,
    label: label || `Site ${state.sites.length + 1}`,
    center,
    bbox,
    sourceType, // 'point' | 'rectangle' | 'polygon'
    loadedSlots: [],
  };
  state.sites.push(site);
  renderSiteList();
  return site;
}

function removeSite(id) {
  if (state.batchRunning) return;
  state.sites = state.sites.filter(s => s.id !== id);
  renderSiteList();
}

function renderSiteList() {
  const list = document.getElementById('site-list');
  document.getElementById('site-count').textContent = `${state.sites.length} site${state.sites.length !== 1 ? 's' : ''}`;

  const runBtn = document.getElementById('run-batch-btn');
  runBtn.disabled = state.sites.length === 0 || state.batchRunning;
  document.getElementById('batch-count-label').textContent = state.sites.length;

  list.innerHTML = state.sites.map(site => {
    const meta = site.sourceType === 'polygon'
      ? 'Polygon area'
      : site.sourceType === 'rectangle'
        ? 'Custom area'
        : `${site.center[0].toFixed(4)}, ${site.center[1].toFixed(4)}`;
    return `
      <div class="site-row" data-id="${site.id}">
        <span class="site-row-icon">${site.sourceType === 'polygon' ? '▱' : '📍'}</span>
        <div class="site-row-main">
          <input type="text" class="site-label-input" value="${escHtml(site.label)}">
          <span class="site-row-meta">${meta}</span>
        </div>
        <button class="btn-icon site-remove-btn" title="Remove site" ${state.batchRunning ? 'disabled' : ''}>✕</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.site-row').forEach(row => {
    const id = +row.dataset.id;
    row.querySelector('.site-label-input').addEventListener('change', e => {
      const site = getSiteById(id);
      if (site) site.label = e.target.value.trim() || site.label;
    });
    row.querySelector('.site-remove-btn').addEventListener('click', () => removeSite(id));
  });
}

// Flattens all coordinate rings of a Polygon/MultiPolygon into a [minLon,minLat,maxLon,maxLat] bbox.
function bboxFromPolygonCoords(geometry) {
  const rings = geometry.type === 'MultiPolygon'
    ? geometry.coordinates.flat()
    : geometry.coordinates;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

function parseAndImportGeoJson(fileText) {
  let data;
  try {
    data = JSON.parse(fileText);
  } catch {
    showToast('Could not parse file — check it is valid GeoJSON.', 'error');
    return;
  }

  const features = data?.features;
  if (!Array.isArray(features) || !features.length) {
    showToast('No features found in that GeoJSON file.', 'error');
    return;
  }

  const remainingCapacity = MAX_BATCH_SITES - state.sites.length;
  const truncated = features.length > remainingCapacity;
  let imported = 0;

  for (const feature of features.slice(0, remainingCapacity)) {
    const geom = feature?.geometry;
    if (!geom) continue;
    const label = feature.properties?.name || feature.properties?.label || feature.properties?.title || null;

    let site = null;
    if (geom.type === 'Point') {
      const [lng, lat] = geom.coordinates;
      site = addSite({
        label,
        center: [lat, lng],
        bbox: bboxFromPoint(lat, lng, state.siteRadiusMeters),
        sourceType: 'point',
      });
    } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      const [minLon, minLat, maxLon, maxLat] = bboxFromPolygonCoords(geom);
      site = addSite({
        label,
        center: [(minLat + maxLat) / 2, (minLon + maxLon) / 2],
        bbox: [minLon, minLat, maxLon, maxLat],
        sourceType: 'polygon',
      });
    }
    if (site) imported++;
  }

  if (!imported) {
    showToast(
      remainingCapacity <= 0
        ? `Batch is already at the ${MAX_BATCH_SITES}-site limit.`
        : 'No Point or Polygon features found in that file.',
      'error'
    );
    return;
  }
  showToast(
    `Imported ${imported} site${imported !== 1 ? 's' : ''}.` +
    (truncated ? ` The batch limit is ${MAX_BATCH_SITES} sites — the rest of the file was skipped.` : ''),
    'success', 6000
  );
}

// ── Timeline Slots ─────────────────────────────────────────────────────────────
function addDefaultSlots() {
  addSlot('2015 (Pre-rebuild)', '2015-06-01', null, false);
  addSlot('2019 (Mid-rebuild)', '2019-06-01', null, false);
  addSlot('Today',              formatDate(new Date()), 0,    true);
}

function addSlot(label = '', date = '', daysOffset = null, isEvent = false) {
  const id = ++state.slotIdCounter;
  if (!date)  date  = formatDate(new Date());
  if (!label) label = `Date ${state.slots.length + 1}`;
  state.slots.push({ id, label, date, daysOffset, isEvent });
  renderTimelineSlots();
}

function cascadeDatesFromEvent(eventDateStr) {
  if (!eventDateStr) return;
  const base = new Date(eventDateStr + 'T12:00:00');
  let changed = false;
  state.slots.forEach(slot => {
    if (!slot.isEvent && slot.daysOffset !== null) {
      const d = new Date(base);
      d.setDate(d.getDate() + slot.daysOffset);
      slot.date = formatDate(d);
      changed = true;
    }
  });
  if (changed) renderTimelineSlots();
}

function removeSlot(id) {
  state.slots = state.slots.filter(s => s.id !== id);
  renderTimelineSlots();
}

function renderTimelineSlots() {
  const container = document.getElementById('timeline-slots');
  container.innerHTML = '';
  document.getElementById('slot-count').textContent =
    `${state.slots.length} date${state.slots.length !== 1 ? 's' : ''}`;

  state.slots.forEach((slot, index) => {
    const el = document.createElement('div');
    el.className = 'timeline-slot' + (slot.isEvent ? ' slot-is-event' : '');
    el.dataset.id = slot.id;
    const labelClass = getSlotLabelClass(slot.label);
    const badge = slot.isEvent
      ? '<span class="cascade-badge">⟳ Drives</span>'
      : (slot.daysOffset !== null
          ? `<span class="offset-badge">Δ${slot.daysOffset >= 0 ? '+' : ''}${slot.daysOffset}d</span>`
          : '');

    el.innerHTML = `
      <div class="slot-number ${labelClass}">${index + 1}</div>
      <div class="slot-fields">
        <div class="slot-label-row">
          <input type="text" class="slot-label-input" value="${escHtml(slot.label)}"
                 placeholder="Label" data-id="${slot.id}">
          ${badge}
        </div>
        <input type="date" class="slot-date-input" value="${slot.date}" data-id="${slot.id}">
      </div>
      <button class="slot-remove-btn" data-id="${slot.id}" title="Remove">✕</button>`;

    container.appendChild(el);
  });

  container.querySelectorAll('.slot-label-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const slot = state.slots.find(s => s.id === +e.target.dataset.id);
      if (!slot) return;
      slot.label = e.target.value;
      const num = e.target.closest('.timeline-slot').querySelector('.slot-number');
      num.className = `slot-number ${getSlotLabelClass(slot.label)}`;
    });
  });

  container.querySelectorAll('.slot-date-input').forEach(inp => {
    inp.addEventListener('change', e => {
      const slot = state.slots.find(s => s.id === +e.target.dataset.id);
      if (!slot) return;
      slot.date = e.target.value;
      if (slot.isEvent) {
        cascadeDatesFromEvent(slot.date);
        showToast('Timeline dates updated.', 'success');
      }
    });
  });

  container.querySelectorAll('.slot-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => removeSlot(+e.target.dataset.id));
  });
}

function getSlotLabelClass(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('pre') || l.includes('before') || l.includes('prior')) return 'slot-pre';
  if (l.includes('peak') || l.includes('event') || l.includes('quake') ||
      l.includes('flood') || l.includes('ignition') || l.includes('disaster')) return 'slot-event';
  if (l.includes('recovery') || l.includes('post') || l.includes('after') ||
      l.includes('rebuild') || l.includes('mid') || l.includes('today')) return 'slot-post';
  return 'slot-neutral';
}

// ── Tile Math (Web Mercator) ───────────────────────────────────────────────────
function _lon2tile(lon, z) { return Math.floor((lon + 180) / 360 * (1 << z)); }
function _lat2tile(lat, z) {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z));
}
function _tile2lon(x, z) { return x / (1 << z) * 360 - 180; }
function _tile2lat(y, z) {
  const n = Math.PI * (1 - 2 * y / (1 << z));
  return Math.atan(Math.sinh(n)) * 180 / Math.PI;
}
function _bboxZoom(bbox, maxZ) {
  const span = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]);
  return Math.max(1, Math.min(maxZ, Math.floor(Math.log2(2520 / span))));
}

function qualityToMaxDim(quality) {
  if (quality === 'preview') return 256;
  if (quality === 'high')    return 1024;
  if (quality === 'ultra')   return 2048;
  return 512; // standard
}

function aspectRatioParts(ar) {
  if (ar === '16:9') return [16, 9];
  if (ar === '9:16') return [9, 16];
  return [4, 3]; // default
}

// ── Tile Stitching ─────────────────────────────────────────────────────────────
// Stitch tiles into a canvas, crop to exact bbox, center-crop to target aspect
// ratio, then scale to maxDim. Returns {canvas, failedTiles, totalTiles} or null
// if every tile failed (no coverage at this zoom) or on CORS failure.
async function _stitchToCanvas(bbox, tileUrlFn, zoom, { maxDim = 512, aspectRatio = '4:3' } = {}) {
  const [w, s, e, n] = bbox;
  const xMin = _lon2tile(w, zoom), xMax = _lon2tile(e, zoom);
  const yMin = _lat2tile(n, zoom), yMax = _lat2tile(s, zoom);
  const cols = xMax - xMin + 1, rows = yMax - yMin + 1;
  if (cols * rows > 49) return null;

  const T = 256;
  const raw = document.createElement('canvas');
  raw.width = cols * T; raw.height = rows * T;
  const ctx = raw.getContext('2d');
  const totalTiles = cols * rows;
  let failedTiles = 0;

  try {
    await Promise.all(
      Array.from({ length: cols }, (_, ci) =>
        Array.from({ length: rows }, (_, ri) =>
          new Promise(res => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => { ctx.drawImage(img, ci * T, ri * T, T, T); res(); };
            img.onerror = () => { failedTiles++; res(); };
            img.src = tileUrlFn(xMin + ci, yMin + ri, zoom);
          })
        )
      ).flat()
    );

    // No tile at all loaded — no coverage exists at this zoom/date, don't
    // return a canvas that would just render as a solid black image.
    if (failedTiles === totalTiles) return null;

    // Crop to exact bbox
    const lonW = _tile2lon(xMin,     zoom), lonE = _tile2lon(xMax + 1, zoom);
    const latN = _tile2lat(yMin,     zoom), latS = _tile2lat(yMax + 1, zoom);
    const rw = raw.width, rh = raw.height;
    let px = Math.round((w - lonW) / (lonE - lonW) * rw);
    let py = Math.round((latN - n) / (latN - latS) * rh);
    let pw = Math.max(1, Math.round((e - w) / (lonE - lonW) * rw));
    let ph = Math.max(1, Math.round((n - s) / (latN - latS) * rh));

    // Center-crop to target aspect ratio
    const [arW, arH] = aspectRatioParts(aspectRatio);
    const targetRatio  = arW / arH;
    const naturalRatio = pw / ph;

    if (Math.abs(naturalRatio - targetRatio) > 0.02) {
      if (naturalRatio > targetRatio) {
        const newPw = Math.round(ph * targetRatio);
        px += Math.round((pw - newPw) / 2);
        pw = newPw;
      } else {
        const newPh = Math.round(pw / targetRatio);
        py += Math.round((ph - newPh) / 2);
        ph = newPh;
      }
    }

    // Scale to maxDim on the larger axis
    let outW, outH;
    if (arW >= arH) {
      outW = maxDim;
      outH = Math.round(maxDim * arH / arW);
    } else {
      outH = maxDim;
      outW = Math.round(maxDim * arW / arH);
    }

    const out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    out.getContext('2d').drawImage(raw, px, py, pw, ph, 0, 0, outW, outH);
    return { canvas: out, failedTiles, totalTiles };
  } catch {
    return null;
  }
}

// ── ESRI Wayback ───────────────────────────────────────────────────────────────
let _waybackReleases  = null;
let _waybackFetchOnce = null;

async function _fetchWaybackReleases() {
  if (_waybackReleases)  return _waybackReleases;
  if (_waybackFetchOnce) return _waybackFetchOnce;

  _waybackFetchOnce = (async () => {
    try {
      const r = await fetch(
        'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json'
      );
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      _waybackReleases = Object.entries(data).map(([key, val]) => {
        const num = parseInt(key, 10);
        const m   = (val.itemTitle || '').match(/\(Wayback (\d{4}-\d{2}-\d{2})\)/);
        if (!m || isNaN(num)) return null;
        return { num, date: new Date(m[1] + 'T12:00:00Z') };
      }).filter(Boolean).sort((a, b) => a.date - b.date);
      return _waybackReleases;
    } catch (e) {
      console.warn('Wayback config fetch failed:', e.message);
      _waybackReleases = [];
      return [];
    }
  })();

  return _waybackFetchOnce;
}

async function _findWaybackRelease(dateStr) {
  const releases = await _fetchWaybackReleases();
  if (!releases.length) return null;
  const target = new Date(dateStr + 'T12:00:00Z');
  let best = releases[0];
  for (const r of releases) {
    if (r.date <= target) best = r;
    else break;
  }
  return best;
}

const MIN_IMAGERY_ZOOM = 12;

// Returns {canvas, usedDate, usedZoom, requestedZoom, failedTiles, totalTiles}
// | {directUrl, usedDate, usedZoom, requestedZoom} | null
async function _stitchWayback(bbox, dateStr, maxDim = null) {
  const release = await _findWaybackRelease(dateStr);
  if (!release) return null;

  const mapZ = state.map ? state.map.getZoom() : 17;
  // Wayback's WMTS tile matrix nominally goes to level 23, but actual coverage
  // at 22+ only exists for select high-density areas/dates.
  const maxBasemapZoom = state.basemapLayer?.options?.maxZoom || 22;
  const MAX_IMAGERY_ZOOM = 22;
  const maxAvailZoom = Math.min(maxBasemapZoom, MAX_IMAGERY_ZOOM);
  const requestedZoom = _bboxZoom(bbox, Math.min(maxAvailZoom, Math.max(mapZ, 10)));
  const tileUrl = (x, y, z) =>
    `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS` +
    `/1.0.0/default028mm/MapServer/tile/${release.num}/${z}/${y}/${x}`;

  const usedDate = release.date.toISOString().slice(0, 10);
  const stitchOpts = {
    maxDim:      maxDim ?? qualityToMaxDim(state.imageQuality),
    aspectRatio: state.aspectRatio,
  };

  // Walk down from the requested zoom to find the highest resolution this
  // date/location actually has full coverage at, instead of settling for
  // whatever gappy result comes back at the top zoom.
  let best = null;
  for (let z = requestedZoom; z >= MIN_IMAGERY_ZOOM; z--) {
    const result = await _stitchToCanvas(bbox, tileUrl, z, stitchOpts);
    if (!result) continue; // no coverage at all at this zoom — try lower
    if (!best || result.failedTiles < best.failedTiles) best = { ...result, usedZoom: z };
    if (result.failedTiles === 0) break; // fully clean — this is the max usable zoom
  }

  if (best) return { ...best, usedDate, requestedZoom };

  // Total failure at every zoom tried — fall back to a direct tile URL
  // at the originally requested zoom.
  const [ww, ss, ee, nn] = bbox;
  const tx = _lon2tile((ww + ee) / 2, requestedZoom), ty = _lat2tile((ss + nn) / 2, requestedZoom);
  return { directUrl: tileUrl(tx, ty, requestedZoom), usedDate, usedZoom: requestedZoom, requestedZoom };
}

async function resolveImageUrl(slot, bbox) {
  const result = await _stitchWayback(bbox, slot.date);
  if (result?.canvas) {
    return {
      url: result.canvas.toDataURL('image/jpeg', 0.88),
      usedDate: result.usedDate,
      usedZoom: result.usedZoom,
      requestedZoom: result.requestedZoom,
      failedTiles: result.failedTiles,
      totalTiles: result.totalTiles,
    };
  }
  if (result?.directUrl) {
    return {
      url: result.directUrl,
      usedDate: result.usedDate,
      usedZoom: result.usedZoom,
      requestedZoom: result.requestedZoom,
    };
  }
  showToast('Wayback archive unavailable for this date.', 'warning', 6000);
  return { url: null, usedDate: null };
}

// ── Load Images ────────────────────────────────────────────────────────────────
async function loadImages() {
  if (state.slots.length === 0) {
    showToast('Add at least one date to the timeline.', 'error');
    return;
  }
  if (state.slots.some(s => !s.date)) {
    showToast('Fill in all dates in the timeline.', 'error');
    return;
  }

  let activeBbox = state.bbox;
  if (!activeBbox) {
    const b = state.map.getBounds();
    activeBbox = [
      +b.getWest().toFixed(6), +b.getSouth().toFixed(6),
      +b.getEast().toFixed(6), +b.getNorth().toFixed(6),
    ];
  }

  const [arW, arH] = aspectRatioParts(state.aspectRatio);
  state.cardAspect = arW / arH;

  state.loadedSlots = state.slots.map((slot, i) => ({
    ...slot, imageUrl: '', bbox: [...activeBbox], index: i,
  }));

  if (state.bbox) {
    state.map.fitBounds(
      [[activeBbox[1], activeBbox[0]], [activeBbox[3], activeBbox[2]]],
      { animate: false, padding: [0, 0] }
    );
  }

  renderImageGrid();
  enableActionButtons();
  document.getElementById('images-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });

  await Promise.all(
    state.loadedSlots.map(async (slot, i) => {
      const { url, usedDate, usedZoom, requestedZoom, failedTiles, totalTiles } =
        await resolveImageUrl(slot, activeBbox);
      slot.imageUrl = url || '';
      slot.usedDate = usedDate;
      slot.usedZoom = usedZoom;
      slot.requestedZoom = requestedZoom;
      slot.hasGaps  = !!(failedTiles && totalTiles);
      setCardImage(i, { url, usedDate, requestedDate: slot.date, hasGaps: slot.hasGaps, usedZoom, requestedZoom });
    })
  );
}

function setCardImage(idx, { url, usedDate, requestedDate, hasGaps, usedZoom, requestedZoom }, siteId = null) {
  const card = document.querySelector(`.image-card[data-site="${siteId ?? ''}"][data-index="${idx}"]`);
  if (!card) return;
  const img       = card.querySelector('.card-image');
  const loading   = card.querySelector('.card-img-loading');
  const noData    = card.querySelector('.card-no-data');
  const dateEl    = card.querySelector('.card-date');
  const gapBadge  = card.querySelector('.card-gap-badge');
  const zoomBadge = card.querySelector('.card-zoom-badge');

  if (usedDate && dateEl && usedDate !== requestedDate) {
    dateEl.textContent = usedDate;
    dateEl.title = `Nearest available to ${requestedDate}`;
    dateEl.classList.add('date-adjusted');
  }

  if (zoomBadge && usedZoom) {
    zoomBadge.textContent = `Z${usedZoom}`;
    zoomBadge.style.display = 'inline-block';
    if (requestedZoom && usedZoom < requestedZoom) {
      zoomBadge.classList.add('zoom-limited');
      zoomBadge.title = `Archive imagery for this date only traces up to zoom ${usedZoom} here — ` +
        `no higher-resolution data available (map is at zoom ${requestedZoom}).`;
    } else {
      zoomBadge.title = `Traced at zoom ${usedZoom}, matching the current map zoom.`;
    }
  }

  if (!url) {
    loading.style.display = 'none';
    noData.style.display  = 'flex';
    return;
  }

  if (hasGaps && gapBadge) gapBadge.style.display = 'flex';

  if (url.startsWith('data:')) {
    img.src = url;
    loading.style.display = 'none';
    img.style.display     = 'block';
    return;
  }

  const t = setTimeout(() => {
    loading.style.display = 'none';
    noData.style.display  = 'flex';
    img.style.display     = 'none';
  }, 15000);
  img.addEventListener('load',  () => { clearTimeout(t); loading.style.display = 'none'; img.style.display = 'block'; });
  img.addEventListener('error', () => { clearTimeout(t); loading.style.display = 'none'; noData.style.display = 'flex'; img.style.display = 'none'; });
  img.src = url;
}

// ── Image Grid ─────────────────────────────────────────────────────────────────
function renderImageGrid() {
  state.viewMode = 'single';
  const grid  = document.getElementById('images-grid');
  const empty = document.getElementById('empty-state');

  document.getElementById('batch-results').style.display = 'none';
  empty.style.display = 'none';
  grid.style.display  = 'grid';
  grid.style.gridTemplateColumns = `repeat(${state.gridCols}, 1fr)`;
  grid.innerHTML = '';

  document.getElementById('image-count').textContent =
    `${state.loadedSlots.length} image${state.loadedSlots.length !== 1 ? 's' : ''}`;

  state.loadedSlots.forEach((slot, idx) => grid.appendChild(buildImageCard(slot, idx)));
  updateCompareSelects();
}

function buildImageCard(slot, idx, siteId = null) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.index = idx;
  card.dataset.site = siteId ?? '';
  card.style.setProperty('--card-delay', `${idx * 55}ms`);

  const headerClass = getSlotLabelClass(slot.label);
  const filename = `EarthWatch_${slot.label.replace(/\s+/g, '_')}_${slot.date}.jpg`;

  card.innerHTML = `
    <div class="card-header ${headerClass}">
      <span class="card-label">${escHtml(slot.label)}</span>
      <span class="card-header-right">
        <span class="card-zoom-badge" style="display:none"></span>
        <span class="card-date">${slot.date}</span>
      </span>
    </div>
    <div class="card-image-wrapper" style="aspect-ratio:${(state.cardAspect || 4/3).toFixed(4)}">
      <div class="card-img-loading">
        <div class="mini-spinner"></div>
        <span>Stitching tiles…</span>
      </div>
      <img class="card-image" src="" alt="${escHtml(slot.label)} ${slot.date}" style="display:none">
      <div class="card-no-data" style="display:none">
        <span>⚠️</span><span>No imagery available</span>
      </div>
      <div class="card-gap-badge" style="display:none" title="Some areas here are unavailable — no imagery exists at this zoom level / resolution for this date. Try zooming out or picking a nearby date.">
        ⚠ Dark areas = no imagery at this zoom
      </div>
      <div class="card-actions">
        <button class="card-action-btn" data-action="expand" title="View fullscreen">⛶ Expand</button>
        <button class="card-action-btn" data-action="download" title="Download current">⬇ Save</button>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-archive-tag">Satellite Archive</span>
      <div class="card-dl-row">
        <select class="card-quality-select">
          <option value="preview" ${state.imageQuality === 'preview' ? 'selected' : ''}>256px</option>
          <option value="standard" ${state.imageQuality === 'standard' ? 'selected' : ''}>512px</option>
          <option value="high" ${state.imageQuality === 'high' ? 'selected' : ''}>1024px</option>
          <option value="ultra" ${state.imageQuality === 'ultra' ? 'selected' : ''}>2048px</option>
        </select>
        <button class="card-dl-btn" title="Re-stitch at selected quality and download">⬇</button>
      </div>
    </div>`;

  card.querySelectorAll('.card-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.action === 'expand')   expandImage(idx, siteId);
      if (btn.dataset.action === 'download') downloadImage(slot.imageUrl, filename);
    });
  });

  card.querySelector('.card-dl-btn').addEventListener('click', e => {
    e.stopPropagation();
    const quality = card.querySelector('.card-quality-select').value;
    restitchAndDownload(idx, quality, siteId);
  });

  return card;
}

function expandImage(idx, siteId = null) {
  const slot = siteId != null ? getSiteById(siteId)?.loadedSlots[idx] : state.loadedSlots[idx];
  if (!slot?.imageUrl) return;
  document.getElementById('expand-img').src = slot.imageUrl;
  const zoomPart = slot.usedZoom ? ` — Zoom ${slot.usedZoom}` : '';
  document.getElementById('expand-title').textContent =
    `${slot.label} — ${slot.usedDate || slot.date}${zoomPart}`;
  document.getElementById('expand-modal').style.display = 'flex';
}

// ── Per-card quality download ──────────────────────────────────────────────────
// Always traces down to the highest zoom this date/location actually has full
// coverage at (via _stitchWayback's built-in fallback search), so a download
// gets the best resolution the archive can offer — not just the map's current zoom.
async function restitchAndDownload(slotIdx, quality, siteId = null) {
  const slot = siteId != null ? getSiteById(siteId)?.loadedSlots[slotIdx] : state.loadedSlots[slotIdx];
  if (!slot) return;
  showToast(`Re-stitching at ${quality} quality…`, 'info', 6000);
  const result = await _stitchWayback(slot.bbox, slot.date, qualityToMaxDim(quality));
  if (!result) { showToast('Could not fetch imagery.', 'error'); return; }
  const url = result.canvas
    ? result.canvas.toDataURL('image/jpeg', 0.92)
    : result.directUrl;
  if (result.usedZoom && result.requestedZoom && result.usedZoom < result.requestedZoom) {
    showToast(`Archive traces up to zoom ${result.usedZoom} here — downloaded at its maximum available resolution.`, 'warning', 7000);
  }
  const filename = `EarthWatch_${slot.label.replace(/\s+/g, '_')}_${slot.date}_z${result.usedZoom}_${quality}.jpg`;
  downloadImage(url, filename);
}

// ── Download ───────────────────────────────────────────────────────────────────
async function downloadImage(url, filename) {
  if (!url) { showToast('No image to download.', 'error'); return; }
  try {
    showToast('Downloading…', 'info');
    const res  = await fetch(url);
    if (!url.startsWith('data:') && !res.ok) throw new Error(res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'earthwatch.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('Downloaded!', 'success');
  } catch {
    showToast('Download failed. Right-click the image to save.', 'error');
  }
}

async function downloadAllImages() {
  for (let i = 0; i < state.loadedSlots.length; i++) {
    const slot = state.loadedSlots[i];
    const zoomPart = slot.usedZoom ? `_z${slot.usedZoom}` : '';
    await downloadImage(
      slot.imageUrl,
      `EarthWatch_${slot.label.replace(/\s+/g, '_')}_${slot.date}${zoomPart}.jpg`
    );
    await new Promise(r => setTimeout(r, 500));
  }
}

// ── Batch Run ──────────────────────────────────────────────────────────────────
async function runWithConcurrencyLimit(items, limit, worker) {
  let i = 0;
  const run = async () => { while (i < items.length) { const idx = i++; await worker(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

async function runBatch() {
  if (state.batchRunning) return;
  if (state.sites.length === 0) { showToast('Add at least one site first.', 'error'); return; }
  if (state.slots.length === 0) { showToast('Add at least one date to the timeline.', 'error'); return; }
  if (state.slots.some(s => !s.date)) { showToast('Fill in all dates in the timeline.', 'error'); return; }

  const [arW, arH] = aspectRatioParts(state.aspectRatio);
  state.cardAspect = arW / arH;

  state.batchRunning = true;
  document.getElementById('export-batch-zip-btn').disabled = true;
  renderSiteList(); // disables run/remove controls while running

  state.sites.forEach(site => {
    site.loadedSlots = state.slots.map((slot, i) => ({ ...slot, imageUrl: '', bbox: [...site.bbox], index: i }));
  });

  renderBatchResults();
  document.getElementById('images-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });

  await runWithConcurrencyLimit(state.sites, 3, async site => {
    await Promise.all(
      site.loadedSlots.map(async (slot, i) => {
        const { url, usedDate, usedZoom, requestedZoom, failedTiles, totalTiles } =
          await resolveImageUrl(slot, site.bbox);
        slot.imageUrl = url || '';
        slot.usedDate = usedDate;
        slot.usedZoom = usedZoom;
        slot.requestedZoom = requestedZoom;
        slot.hasGaps  = !!(failedTiles && totalTiles);
        setCardImage(i, { url, usedDate, requestedDate: slot.date, hasGaps: slot.hasGaps, usedZoom, requestedZoom }, site.id);
      })
    );
  });

  state.batchRunning = false;
  document.getElementById('export-batch-zip-btn').disabled = false;
  renderSiteList();
  showToast('Batch complete.', 'success');
}

function siteMetaText(site) {
  if (site.sourceType === 'polygon') return 'Polygon area';
  if (site.sourceType === 'rectangle') return 'Custom area';
  return `${site.center[0].toFixed(4)}, ${site.center[1].toFixed(4)}`;
}

function renderBatchResults() {
  state.viewMode = 'batch';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('images-grid').style.display  = 'none';

  const container = document.getElementById('batch-results');
  container.style.display = 'flex';
  container.innerHTML = '';

  document.getElementById('image-count').textContent =
    `${state.sites.length} site${state.sites.length !== 1 ? 's' : ''} × ${state.slots.length} date${state.slots.length !== 1 ? 's' : ''}`;

  state.sites.forEach(site => {
    const section = document.createElement('section');
    section.className = 'site-group';
    section.innerHTML = `
      <div class="site-group-header">
        <span class="site-group-title">📍 ${escHtml(site.label)}</span>
        <span class="site-group-meta">${siteMetaText(site)}</span>
      </div>
      <div class="images-grid" style="display:grid;grid-template-columns:repeat(${state.gridCols}, 1fr)"></div>`;

    const grid = section.querySelector('.images-grid');
    site.loadedSlots.forEach((slot, idx) => grid.appendChild(buildImageCard(slot, idx, site.id)));
    container.appendChild(section);
  });
}

// ── Batch Export (ZIP) ───────────────────────────────────────────────────────────
function sanitizeFilename(str) {
  return (str || '').replace(/\s+/g, '_').replace(/[/\\:*?"<>|]/g, '');
}

async function downloadBatchZip() {
  const sitesWithImages = state.sites.filter(s => s.loadedSlots.some(slot => slot.imageUrl));
  if (!sitesWithImages.length) { showToast('No batch images to export yet — run the batch first.', 'error'); return; }

  showToast('Preparing ZIP…', 'info', 8000);
  try {
    const zip = new JSZip();
    for (const site of sitesWithImages) {
      const folder = zip.folder(sanitizeFilename(site.label) || `site_${site.id}`);
      for (const slot of site.loadedSlots) {
        if (!slot.imageUrl) continue;
        const blob = await (await fetch(slot.imageUrl)).blob();
        const zoomPart = slot.usedZoom ? `_z${slot.usedZoom}` : '';
        folder.file(`${sanitizeFilename(slot.label)}_${slot.date}${zoomPart}.jpg`, blob);
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    await downloadImage(url, `EarthWatch_Batch_${formatDate(new Date())}.zip`);
    URL.revokeObjectURL(url);
  } catch {
    showToast('Could not build the ZIP file.', 'error');
  }
}

// ── Comparison Modal ───────────────────────────────────────────────────────────
function updateCompareSelects() {
  ['compare-before', 'compare-after'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="">-- Select image --</option>';
    state.loadedSlots.forEach((slot, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${slot.label} (${slot.date})`;
      sel.appendChild(opt);
    });
  });
  if (state.loadedSlots.length >= 1) document.getElementById('compare-before').value = 0;
  if (state.loadedSlots.length >= 2) document.getElementById('compare-after').value  = state.loadedSlots.length - 1;
}

function openComparisonModal() {
  if (state.loadedSlots.length < 2) {
    showToast('Load at least 2 images to compare.', 'error');
    return;
  }
  updateCompareSelects();
  updateComparisonView();
  document.getElementById('comparison-modal').style.display = 'flex';
}

function updateComparisonView() {
  const before = state.loadedSlots[+document.getElementById('compare-before').value];
  const after  = state.loadedSlots[+document.getElementById('compare-after').value];
  if (!before || !after) return;

  const mode = state.compareMode;
  document.getElementById('comparison-slider-view').style.display = mode === 'slider'    ? 'block' : 'none';
  document.getElementById('side-by-side-view').style.display      = mode === 'sidebyside' ? 'flex'  : 'none';

  if (mode === 'slider') {
    document.getElementById('cmp-before-img').src = before.imageUrl;
    document.getElementById('cmp-after-img').src  = after.imageUrl;
    document.getElementById('cmp-before-label').textContent = `${before.label} | ${before.date}`;
    document.getElementById('cmp-after-label').textContent  = `${after.label} | ${after.date}`;
    const slider = document.getElementById('cmp-slider');
    slider.value = 50;
    applySliderSplit(50);
    slider.oninput = () => applySliderSplit(+slider.value);
  } else {
    document.getElementById('sbs-before-img').src          = before.imageUrl;
    document.getElementById('sbs-after-img').src           = after.imageUrl;
    document.getElementById('sbs-before-label').textContent = `${before.label} (${before.date})`;
    document.getElementById('sbs-after-label').textContent  = `${after.label} (${after.date})`;
  }
}

function applySliderSplit(pct) {
  document.getElementById('cmp-before-img').style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  document.getElementById('cmp-divider').style.left = pct + '%';
}

// ── Location Search ────────────────────────────────────────────────────────────
async function searchLocation(query) {
  if (!query.trim()) return;
  closeSuggestions();
  try {
    showToast('Searching…', 'info');
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    if (data?.length > 0) {
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      state.map.setView([lat, lng], 14);
      setLocation(lat, lng);
      showToast(`Found: ${data[0].display_name.split(',').slice(0, 2).join(',')}`, 'success');
    } else {
      showToast('Location not found.', 'error');
    }
  } catch {
    showToast('Search failed.', 'error');
  }
}

// ── Location Search — Live Suggestions ────────────────────────────────────────
let searchDebounceTimer  = null;
let searchAbortController = null;
let suggestionItems       = [];
let activeSuggestionIndex = -1;

async function fetchSuggestions(query) {
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6`,
      { headers: { Accept: 'application/json' }, signal: searchAbortController.signal }
    );
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') return null; // superseded by a newer keystroke
    return [];
  }
}

function renderSuggestions(items) {
  const box = document.getElementById('search-suggestions');
  suggestionItems = items || [];
  activeSuggestionIndex = -1;
  if (!suggestionItems.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

  box.innerHTML = suggestionItems.map((item, i) => `
    <div class="search-suggestion-item" data-index="${i}">
      <span class="suggestion-icon">📍</span>
      <span class="suggestion-text">${escHtml(item.display_name)}</span>
    </div>
  `).join('');
  box.style.display = 'block';
  box.querySelectorAll('.search-suggestion-item').forEach(el => {
    el.addEventListener('click', () => selectSuggestion(+el.dataset.index));
  });
}

function selectSuggestion(i) {
  const item = suggestionItems[i];
  if (!item) return;
  const lat = parseFloat(item.lat), lng = parseFloat(item.lon);
  state.map.setView([lat, lng], 14);
  setLocation(lat, lng);
  document.getElementById('location-search').value = item.display_name.split(',').slice(0, 2).join(',');
  closeSuggestions();
}

function closeSuggestions() {
  const box = document.getElementById('search-suggestions');
  box.style.display = 'none';
  box.innerHTML = '';
  suggestionItems = [];
  activeSuggestionIndex = -1;
}

function updateActiveSuggestion() {
  document.querySelectorAll('.search-suggestion-item').forEach((el, i) => {
    el.classList.toggle('active', i === activeSuggestionIndex);
  });
}

// ── Live Settings Reload ──────────────────────────────────────────────────────
function reloadIfImagesLoaded() {
  if (state.loadedSlots.length > 0) loadImages();
}

// ── Grid Columns ───────────────────────────────────────────────────────────────
function setGridCols(cols) {
  state.gridCols = cols;
  document.querySelectorAll('#grid-col-btns .toggle-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.cols === cols);
  });
  if (state.loadedSlots.length > 0) renderImageGrid();
}

// ── Enable/Disable Buttons ─────────────────────────────────────────────────────
function enableActionButtons() {
  document.getElementById('compare-btn').disabled    = false;
  document.getElementById('export-all-btn').disabled = false;
  document.getElementById('reload-images-btn').style.display = state.viewportLockMode ? 'block' : 'none';
}

// ── Loading Overlay ────────────────────────────────────────────────────────────
function showLoading(show, text = 'Loading…') {
  document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
  document.getElementById('loading-text').textContent = text;
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.getElementById('toast-container').appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event Listeners ────────────────────────────────────────────────────────────
function setupEventListeners() {
  // Location search
  const searchInput = document.getElementById('location-search');
  document.getElementById('search-btn').addEventListener('click', () =>
    searchLocation(searchInput.value));

  searchInput.addEventListener('input', e => {
    const query = e.target.value.trim();
    clearTimeout(searchDebounceTimer);
    if (query.length < 3) { closeSuggestions(); return; }
    searchDebounceTimer = setTimeout(async () => {
      const items = await fetchSuggestions(query);
      if (items !== null) renderSuggestions(items); // null = superseded, ignore
    }, 350);
  });

  searchInput.addEventListener('keydown', e => {
    const suggestionsOpen = suggestionItems.length > 0;
    if (e.key === 'ArrowDown' && suggestionsOpen) {
      e.preventDefault();
      activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, suggestionItems.length - 1);
      updateActiveSuggestion();
    } else if (e.key === 'ArrowUp' && suggestionsOpen) {
      e.preventDefault();
      activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
      updateActiveSuggestion();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestionsOpen && activeSuggestionIndex >= 0) selectSuggestion(activeSuggestionIndex);
      else searchLocation(e.target.value);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.input-group')) closeSuggestions();
  });

  // Go to coordinates
  document.getElementById('go-to-location').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('lat-input').value);
    const lng = parseFloat(document.getElementById('lng-input').value);
    if (isNaN(lat) || isNaN(lng)) { showToast('Enter valid coordinates.', 'error'); return; }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Latitude must be −90–90, longitude −180–180.', 'error'); return;
    }
    state.map.setView([lat, lng], state.map.getZoom());
    setLocation(lat, lng);
  });

  // Pin current map view
  document.getElementById('use-map-view').addEventListener('click', () => {
    const b = state.map.getBounds();
    state.bbox = [
      +b.getWest().toFixed(6), +b.getSouth().toFixed(6),
      +b.getEast().toFixed(6), +b.getNorth().toFixed(6),
    ];
    const c = b.getCenter();
    state.center = [+c.lat.toFixed(5), +c.lng.toFixed(5)];
    document.getElementById('lat-input').value = state.center[0];
    document.getElementById('lng-input').value = state.center[1];
    drawBboxOnMap();
    updateAoiInfo();
    showToast('Map view pinned as area of interest.', 'success');
  });

  document.getElementById('clear-aoi-btn').addEventListener('click', clearAoi);

  // Batch sites — add current location
  document.getElementById('add-current-as-site-btn').addEventListener('click', () => {
    if (state.batchRunning) return;
    const [lat, lng] = state.center;
    const site = state.bbox
      ? addSite({ center: [lat, lng], bbox: [...state.bbox], sourceType: 'rectangle' })
      : addSite({
          center: [lat, lng],
          bbox: bboxFromPoint(lat, lng, Math.max(50, +document.getElementById('site-radius-input').value || state.siteRadiusMeters)),
          sourceType: 'point',
        });
    if (site) showToast('Added as batch site.', 'success');
  });

  document.getElementById('site-radius-input').addEventListener('change', e => {
    const v = +e.target.value;
    if (v > 0) state.siteRadiusMeters = v;
  });

  // Batch sites — upload GeoJSON
  document.getElementById('site-upload-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseAndImportGeoJson(reader.result);
    reader.onerror = () => showToast('Could not read that file.', 'error');
    reader.readAsText(file);
    e.target.value = ''; // allow re-uploading the same file later
  });

  // Viewport lock toggle
  document.querySelectorAll('#viewport-lock-btns .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode === 'true';
      state.viewportLockMode = mode;
      document.querySelectorAll('#viewport-lock-btns .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('reload-images-btn').style.display = mode && state.loadedSlots.length > 0 ? 'block' : 'none';
    });
  });

  // Manual reload images
  document.getElementById('reload-images-btn').addEventListener('click', reloadIfImagesLoaded);

  // Basemap
  document.getElementById('basemap-select').addEventListener('change', e => applyBasemap(e.target.value));

  // Aspect ratio toggle
  document.querySelectorAll('#aspect-btns .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.aspectRatio = btn.dataset.aspect;
      document.querySelectorAll('#aspect-btns .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyMapAspectRatio();
      reloadIfImagesLoaded();
    });
  });

  // Display quality
  document.getElementById('quality-select').addEventListener('change', e => {
    state.imageQuality = e.target.value;
    reloadIfImagesLoaded();
  });

  // Grid columns
  document.querySelectorAll('#grid-col-btns .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setGridCols(+btn.dataset.cols));
  });

  // Timeline
  document.getElementById('add-slot-btn').addEventListener('click', () => addSlot());
  document.getElementById('clear-all-slots-btn').addEventListener('click', () => {
    if (!state.slots.length) return;
    if (confirm('Clear all timeline slots?')) { state.slots = []; renderTimelineSlots(); }
  });

  // Load / compare / export
  document.getElementById('load-images-btn').addEventListener('click', loadImages);
  document.getElementById('compare-btn').addEventListener('click', openComparisonModal);
  document.getElementById('export-all-btn').addEventListener('click', downloadAllImages);

  document.getElementById('run-batch-btn').addEventListener('click', runBatch);
  document.getElementById('export-batch-zip-btn').addEventListener('click', downloadBatchZip);

  // About modal
  document.getElementById('about-btn').addEventListener('click', () =>
    document.getElementById('about-modal').style.display = 'flex');
  document.getElementById('close-about').addEventListener('click', () =>
    document.getElementById('about-modal').style.display = 'none');
  document.getElementById('about-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('about-modal'))
      document.getElementById('about-modal').style.display = 'none';
  });

  // Comparison modal
  document.getElementById('close-comparison').addEventListener('click', () =>
    document.getElementById('comparison-modal').style.display = 'none');
  document.getElementById('comparison-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('comparison-modal'))
      document.getElementById('comparison-modal').style.display = 'none';
  });
  document.getElementById('compare-before').addEventListener('change', updateComparisonView);
  document.getElementById('compare-after').addEventListener('change', updateComparisonView);
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.compareMode = btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateComparisonView();
    });
  });

  // Expand modal
  document.getElementById('expand-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('expand-modal') || e.target.id === 'expand-close')
      document.getElementById('expand-modal').style.display = 'none';
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebar-toggle')?.addEventListener('click', () =>
    document.getElementById('sidebar').classList.contains('open') ? closeSidebar() : openSidebar());
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);
}
