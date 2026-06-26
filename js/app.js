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
  drawingMode: false,
  drawStart: null,
  drawTempRect: null,
  viewportRect: null,

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
};

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

  state.map.on('click', onMapClick);
  state.map.on('zoomend', onZoomEnd);
  state.map.on('moveend', onMoveEnd);
  state.map.on('mousemove', onMouseMove);

  setTimeout(() => { state.map.invalidateSize(); updateViewportOutline(); }, 100);
  window.addEventListener('resize', () => state.map.invalidateSize());
}

const BASEMAPS = {
  google: {
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '© <a href="https://maps.google.com">Google</a>',
    maxZoom: 21,
    subdomains: ['0', '1', '2', '3'],
  },
  esri: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
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
  if (cfg.subdomains) opts.subdomains = cfg.subdomains;
  state.basemapLayer = L.tileLayer(cfg.url, opts);
  state.basemapLayer.addTo(state.map);
  state.basemap = id;
  const sel = document.getElementById('basemap-select');
  if (sel) sel.value = id;
}

function onMapClick(e) {
  if (state.drawingMode) return;
  setLocation(e.latlng.lat, e.latlng.lng);
}

function onZoomEnd() {
  document.getElementById('map-zoom-info').textContent = `Zoom: ${state.map.getZoom()}`;
  updateViewportOutline();
}

function onMoveEnd() {
  const c = state.map.getCenter();
  document.getElementById('map-coords').textContent =
    `Center: ${c.lat.toFixed(4)}°, ${c.lng.toFixed(4)}°`;
  updateViewportOutline();
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

function onMouseMove(e) {
  if (state.drawingMode && state.drawStart) updateDrawRect(e.latlng);
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

// ── Draw Rectangle ─────────────────────────────────────────────────────────────
function startDrawMode() {
  state.drawingMode = true;
  state.map.getContainer().style.cursor = 'crosshair';
  document.getElementById('draw-rect-btn').classList.add('active');
  document.getElementById('draw-hint').style.display = 'inline';
  state.map.on('mousedown', onDrawStart);
  state.map.on('mouseup', onDrawEnd);
  state.map.dragging.disable();
}

function stopDrawMode() {
  state.drawingMode = false;
  state.drawStart = null;
  state.map.getContainer().style.cursor = '';
  document.getElementById('draw-rect-btn').classList.remove('active');
  document.getElementById('draw-hint').style.display = 'none';
  state.map.off('mousedown', onDrawStart);
  state.map.off('mouseup', onDrawEnd);
  if (state.drawTempRect) { state.map.removeLayer(state.drawTempRect); state.drawTempRect = null; }
  state.map.dragging.enable();
}

function onDrawStart(e) {
  state.drawStart = e.latlng;
  if (state.drawTempRect) state.map.removeLayer(state.drawTempRect);
  state.drawTempRect = L.rectangle(
    [[e.latlng.lat, e.latlng.lng], [e.latlng.lat, e.latlng.lng]],
    { color: '#4a9eff', weight: 2, fillOpacity: 0.1, dashArray: '4,4' },
  ).addTo(state.map);
}

function updateDrawRect(latlng) {
  if (!state.drawTempRect || !state.drawStart) return;
  state.drawTempRect.setBounds([
    [state.drawStart.lat, state.drawStart.lng],
    [latlng.lat, latlng.lng],
  ]);
}

function onDrawEnd(e) {
  if (!state.drawStart) return;
  const s = state.drawStart, end = e.latlng;
  const west  = Math.min(s.lng, end.lng), east  = Math.max(s.lng, end.lng);
  const south = Math.min(s.lat, end.lat), north = Math.max(s.lat, end.lat);

  if (Math.abs(east - west) < 0.005 || Math.abs(north - south) < 0.005) {
    stopDrawMode();
    return;
  }

  state.bbox = [+west.toFixed(6), +south.toFixed(6), +east.toFixed(6), +north.toFixed(6)];
  state.center = [
    +(south + (north - south) / 2).toFixed(5),
    +(west  + (east  - west)  / 2).toFixed(5),
  ];
  document.getElementById('lat-input').value = state.center[0];
  document.getElementById('lng-input').value = state.center[1];
  drawBboxOnMap();
  updateAoiInfo();
  stopDrawMode();
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
// ratio, then scale to maxDim. Returns canvas or null on CORS failure.
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

  try {
    await Promise.all(
      Array.from({ length: cols }, (_, ci) =>
        Array.from({ length: rows }, (_, ri) =>
          new Promise(res => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => { ctx.drawImage(img, ci * T, ri * T, T, T); res(); };
            img.onerror = () => res();
            img.src = tileUrlFn(xMin + ci, yMin + ri, zoom);
          })
        )
      ).flat()
    );

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
    return out;
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

// Returns {canvas, usedDate} | {directUrl, usedDate} | null
async function _stitchWayback(bbox, dateStr, maxDim = null) {
  const release = await _findWaybackRelease(dateStr);
  if (!release) return null;

  const mapZ = state.map ? state.map.getZoom() : 17;
  const zoom  = _bboxZoom(bbox, Math.min(21, Math.max(mapZ, 10)));
  const tileUrl = (x, y, z) =>
    `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS` +
    `/1.0.0/default028mm/MapServer/tile/${release.num}/${z}/${y}/${x}`;

  const canvas = await _stitchToCanvas(bbox, tileUrl, zoom, {
    maxDim:      maxDim ?? qualityToMaxDim(state.imageQuality),
    aspectRatio: state.aspectRatio,
  });

  const usedDate = release.date.toISOString().slice(0, 10);
  if (canvas) return { canvas, usedDate };

  // CORS fallback — serve center tile directly as <img> src
  const [ww, ss, ee, nn] = bbox;
  const tx = _lon2tile((ww + ee) / 2, zoom), ty = _lat2tile((ss + nn) / 2, zoom);
  return { directUrl: tileUrl(tx, ty, zoom), usedDate };
}

async function resolveImageUrl(slot, bbox) {
  const result = await _stitchWayback(bbox, slot.date);
  if (result?.canvas)    return { url: result.canvas.toDataURL('image/jpeg', 0.88), usedDate: result.usedDate };
  if (result?.directUrl) return { url: result.directUrl, usedDate: result.usedDate };
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
      const { url, usedDate } = await resolveImageUrl(slot, activeBbox);
      slot.imageUrl = url || '';
      slot.usedDate = usedDate;
      setCardImage(i, url, usedDate, slot.date);
    })
  );
}

function setCardImage(idx, url, usedDate, requestedDate) {
  const card = document.querySelector(`.image-card[data-index="${idx}"]`);
  if (!card) return;
  const img     = card.querySelector('.card-image');
  const loading = card.querySelector('.card-img-loading');
  const noData  = card.querySelector('.card-no-data');
  const dateEl  = card.querySelector('.card-date');

  if (usedDate && dateEl && usedDate !== requestedDate) {
    dateEl.textContent = usedDate;
    dateEl.title = `Nearest available to ${requestedDate}`;
    dateEl.classList.add('date-adjusted');
  }

  if (!url) {
    loading.style.display = 'none';
    noData.style.display  = 'flex';
    return;
  }

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
  const grid  = document.getElementById('images-grid');
  const empty = document.getElementById('empty-state');

  empty.style.display = 'none';
  grid.style.display  = 'grid';
  grid.style.gridTemplateColumns = `repeat(${state.gridCols}, 1fr)`;
  grid.innerHTML = '';

  document.getElementById('image-count').textContent =
    `${state.loadedSlots.length} image${state.loadedSlots.length !== 1 ? 's' : ''}`;

  state.loadedSlots.forEach((slot, idx) => grid.appendChild(buildImageCard(slot, idx)));
  updateCompareSelects();
}

function buildImageCard(slot, idx) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.index = idx;
  card.style.setProperty('--card-delay', `${idx * 55}ms`);

  const headerClass = getSlotLabelClass(slot.label);
  const filename = `EarthWatch_${slot.label.replace(/\s+/g, '_')}_${slot.date}.jpg`;

  card.innerHTML = `
    <div class="card-header ${headerClass}">
      <span class="card-label">${escHtml(slot.label)}</span>
      <span class="card-date">${slot.date}</span>
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
      <div class="card-actions">
        <button class="card-action-btn" data-action="expand" title="View fullscreen">⛶ Expand</button>
        <button class="card-action-btn" data-action="download" title="Download current">⬇ Save</button>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-archive-tag">ESRI Wayback</span>
      <div class="card-dl-row">
        <select class="card-quality-select">
          <option value="preview">256px</option>
          <option value="standard" selected>512px</option>
          <option value="high">1024px</option>
          <option value="ultra">2048px</option>
        </select>
        <button class="card-dl-btn" title="Re-stitch at selected quality and download">⬇</button>
      </div>
    </div>`;

  card.querySelectorAll('.card-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.action === 'expand')   expandImage(idx);
      if (btn.dataset.action === 'download') downloadImage(state.loadedSlots[idx].imageUrl, filename);
    });
  });

  card.querySelector('.card-dl-btn').addEventListener('click', e => {
    e.stopPropagation();
    const quality = card.querySelector('.card-quality-select').value;
    restitchAndDownload(idx, quality);
  });

  return card;
}

function expandImage(idx) {
  const slot = state.loadedSlots[idx];
  if (!slot?.imageUrl) return;
  document.getElementById('expand-img').src = slot.imageUrl;
  document.getElementById('expand-title').textContent =
    `${slot.label} — ${slot.usedDate || slot.date} — ESRI Wayback`;
  document.getElementById('expand-modal').style.display = 'flex';
}

// ── Per-card quality download ──────────────────────────────────────────────────
async function restitchAndDownload(slotIdx, quality) {
  const slot = state.loadedSlots[slotIdx];
  if (!slot) return;
  showToast(`Re-stitching at ${quality} quality…`, 'info', 6000);
  const result = await _stitchWayback(slot.bbox, slot.date, qualityToMaxDim(quality));
  if (!result) { showToast('Could not fetch imagery.', 'error'); return; }
  const url = result.canvas
    ? result.canvas.toDataURL('image/jpeg', 0.92)
    : result.directUrl;
  const filename = `EarthWatch_${slot.label.replace(/\s+/g, '_')}_${slot.date}_${quality}.jpg`;
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
    await downloadImage(
      slot.imageUrl,
      `EarthWatch_${slot.label.replace(/\s+/g, '_')}_${slot.date}.jpg`
    );
    await new Promise(r => setTimeout(r, 500));
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
  document.getElementById('search-btn').addEventListener('click', () =>
    searchLocation(document.getElementById('location-search').value));
  document.getElementById('location-search').addEventListener('keypress', e => {
    if (e.key === 'Enter') searchLocation(e.target.value);
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

  // Draw rectangle toggle
  document.getElementById('draw-rect-btn').addEventListener('click', () => {
    if (state.drawingMode) stopDrawMode();
    else startDrawMode();
  });

  // Basemap
  document.getElementById('basemap-select').addEventListener('change', e => applyBasemap(e.target.value));

  // Aspect ratio toggle
  document.querySelectorAll('#aspect-btns .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.aspectRatio = btn.dataset.aspect;
      document.querySelectorAll('#aspect-btns .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Display quality
  document.getElementById('quality-select').addEventListener('change', e => {
    state.imageQuality = e.target.value;
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
