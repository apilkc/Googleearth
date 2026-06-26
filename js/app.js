// ==========================================
// EarthWatch - Disaster Satellite Monitoring
// ==========================================

const state = {
  map: null,
  basemapLayer: null,
  gibs_layer: null,
  center: [20, 0],
  zoom: 3,
  bbox: null,           // [west, south, east, north]
  locationMarker: null,
  bboxRect: null,
  drawingMode: false,
  drawStart: null,
  drawTempRect: null,
  viewportRect: null,

  satellite: 'modis_terra',
  layer: 'true_color',
  basemap: 'google',
  drawConstraint: 'rect', // 'rect' | 'square'

  slots: [],            // [{id, label, date}]
  loadedSlots: [],      // [{id, label, date, imageUrl, satellite, layer}]

  gridCols: 3,
  imageSize: 768,
  slotIdCounter: 0,

  compareMode: 'slider',
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  renderSatelliteGrid();
  renderLayerGrid();
  setupEventListeners();
  addDefaultSlots();
  // Populate initial satellite info
  const initSat = SATELLITES.find(s => s.id === state.satellite);
  if (initSat) updateSatInfo(initSat);
  updateLayerDescription();
});

// ---- Map ----
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

  // Force Leaflet to recalculate size after layout settles (needed in flex containers)
  setTimeout(() => { state.map.invalidateSize(); updateViewportOutline(); }, 100);
  window.addEventListener('resize', () => state.map.invalidateSize());
}

const BASEMAPS = {
  gibs: {
    name: 'NASA MODIS (Today)',
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${(()=>{ const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: 'Imagery: <a href="https://earthdata.nasa.gov">NASA GIBS</a> / MODIS Terra',
    maxZoom: 9
  },
  viirs: {
    name: 'NASA VIIRS (Today)',
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${(()=>{ const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: 'Imagery: <a href="https://earthdata.nasa.gov">NASA GIBS</a> / VIIRS NOAA-20',
    maxZoom: 9
  },
  google: {
    name: 'Google Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '© <a href="https://maps.google.com">Google</a>',
    maxZoom: 21,
    subdomains: ['0', '1', '2', '3']
  },
  sentinel2: {
    name: 'Sentinel-2 Cloudless',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2022_3857/default/g/{z}/{y}/{x}.jpg',
    attribution: '© <a href="https://s2maps.eu">Sentinel-2 cloudless 2022</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (CC BY 4.0)',
    maxZoom: 18
  },
  esri: {
    name: 'ESRI World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  carto: {
    name: 'Dark (CartoDB)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap © <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19
  }
};

function applyBasemap(id) {
  if (state.basemapLayer) state.map.removeLayer(state.basemapLayer);
  const cfg = BASEMAPS[id] || BASEMAPS.gibs;
  const opts = { attribution: cfg.attribution, maxZoom: cfg.maxZoom };
  if (cfg.subdomains) opts.subdomains = cfg.subdomains;
  state.basemapLayer = L.tileLayer(cfg.url, opts);
  state.basemapLayer.addTo(state.map);
  state.basemap = id;
  // Sync dropdown
  const sel = document.getElementById('basemap-select');
  if (sel) sel.value = id;
}

function onMapClick(e) {
  if (state.drawingMode) return;
  const { lat, lng } = e.latlng;
  setLocation(lat, lng);
}

function onZoomEnd() {
  const z = state.map.getZoom();
  document.getElementById('map-zoom-info').textContent = `Zoom: ${z}`;
  updateViewportOutline();
}

function onMoveEnd() {
  const c = state.map.getCenter();
  document.getElementById('map-coords').textContent =
    `Center: ${c.lat.toFixed(4)}°, ${c.lng.toFixed(4)}°`;
  updateViewportOutline();
}

// Draw a dashed outline showing the current map viewport = what "Load Images" will capture.
// Removed automatically when the user draws an explicit bbox.
function updateViewportOutline() {
  if (state.bbox) {
    // Explicit selection overrides viewport outline
    if (state.viewportRect) { state.map.removeLayer(state.viewportRect); state.viewportRect = null; }
    return;
  }
  const bounds = state.map.getBounds();
  if (state.viewportRect) {
    state.viewportRect.setBounds(bounds);
  } else {
    state.viewportRect = L.rectangle(bounds, {
      color: '#4493f8',
      weight: 2,
      fillOpacity: 0.04,
      dashArray: '6 4',
      interactive: false
    }).addTo(state.map);
  }
}

function onMouseMove(e) {
  if (state.drawingMode && state.drawStart) {
    updateDrawRect(e.latlng);
  }
}

function setLocation(lat, lng) {
  state.center = [lat, lng];
  document.getElementById('lat-input').value = lat.toFixed(5);
  document.getElementById('lng-input').value = lng.toFixed(5);

  if (state.locationMarker) state.map.removeLayer(state.locationMarker);
  state.locationMarker = L.circleMarker([lat, lng], {
    radius: 8, color: '#4a9eff', weight: 3, fillColor: '#4a9eff', fillOpacity: 0.3
  }).addTo(state.map);
  // No longer auto-sets a fixed bbox — the live map viewport defines the image extent.
}

function computeBboxFromCenter() {
  const [lat, lng] = state.center;
  const radiusDeg = parseFloat(document.getElementById('view-radius').value) * 0.4;
  const lonAdj = radiusDeg / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  state.bbox = [
    +(lng - lonAdj).toFixed(6),
    +(lat - radiusDeg).toFixed(6),
    +(lng + lonAdj).toFixed(6),
    +(lat + radiusDeg).toFixed(6),
  ];
  drawBboxOnMap();
  updateAoiInfo();
}

function drawBboxOnMap() {
  if (!state.bbox) return;
  if (state.bboxRect) state.map.removeLayer(state.bboxRect);
  const [w, s, e, n] = state.bbox;
  state.bboxRect = L.rectangle([[s, w], [n, e]], {
    color: '#4a9eff', weight: 2, fill: true, fillColor: '#4a9eff', fillOpacity: 0.1,
    dashArray: '6, 4'
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
  updateViewportOutline(); // restore live viewport outline
}

// ---- Draw Rectangle / Square ----
function startDrawMode(constraint = 'rect') {
  state.drawConstraint = constraint;
  state.drawingMode = true;
  state.map.getContainer().style.cursor = 'crosshair';
  document.getElementById('draw-rect-btn').classList.toggle('active', constraint === 'rect');
  document.getElementById('draw-square-btn').classList.toggle('active', constraint === 'square');
  document.getElementById('draw-hint').style.display = 'inline';
  document.getElementById('draw-hint').textContent =
    constraint === 'square' ? '— Click & drag to draw square' : '— Click & drag to draw area';

  state.map.on('mousedown', onDrawStart);
  state.map.on('mouseup', onDrawEnd);
  state.map.dragging.disable();
}

function stopDrawMode() {
  state.drawingMode = false;
  state.drawStart = null;
  state.map.getContainer().style.cursor = '';
  document.getElementById('draw-rect-btn').classList.remove('active');
  document.getElementById('draw-square-btn').classList.remove('active');
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
    { color: '#4a9eff', weight: 2, fillOpacity: 0.1, dashArray: '4,4' }
  ).addTo(state.map);
}

// Constrain latlng to a square (equal km sides) from state.drawStart.
function _squareEnd(start, cursor) {
  const dLat = cursor.lat - start.lat;
  const dLng = cursor.lng - start.lng;
  // Convert to approximate equal-ground spans using cosine correction at mid-latitude
  const midLat  = (start.lat + cursor.lat) / 2;
  const cosLat  = Math.max(Math.cos(midLat * Math.PI / 180), 0.01);
  const spanLat = Math.abs(dLat);
  const spanLng = Math.abs(dLng) * cosLat; // longitude degrees → ground-equivalent
  const size    = Math.max(spanLat, spanLng); // larger side wins
  return {
    lat: start.lat + Math.sign(dLat || 1) * size,
    lng: start.lng + Math.sign(dLng || 1) * size / cosLat
  };
}

function updateDrawRect(latlng) {
  if (!state.drawTempRect || !state.drawStart) return;
  const end = state.drawConstraint === 'square' ? _squareEnd(state.drawStart, latlng) : latlng;
  state.drawTempRect.setBounds([
    [state.drawStart.lat, state.drawStart.lng],
    [end.lat, end.lng]
  ]);
}

function onDrawEnd(e) {
  if (!state.drawStart) return;
  const rawEnd = e.latlng;
  const end    = state.drawConstraint === 'square' ? _squareEnd(state.drawStart, rawEnd) : rawEnd;
  const s      = state.drawStart;
  const w      = Math.min(s.lng, end.lng);
  const e2     = Math.max(s.lng, end.lng);
  const south  = Math.min(s.lat, end.lat);
  const north  = Math.max(s.lat, end.lat);

  if (Math.abs(e2 - w) < 0.005 || Math.abs(north - south) < 0.005) {
    stopDrawMode();
    return;
  }

  state.bbox = [+w.toFixed(6), +south.toFixed(6), +e2.toFixed(6), +north.toFixed(6)];
  state.center = [+(south + (north - south) / 2).toFixed(5), +(w + (e2 - w) / 2).toFixed(5)];

  if (state.locationMarker) { state.map.removeLayer(state.locationMarker); state.locationMarker = null; }
  document.getElementById('lat-input').value = state.center[0];
  document.getElementById('lng-input').value = state.center[1];

  drawBboxOnMap();
  updateAoiInfo();
  stopDrawMode();
}

// ---- Satellite & Layer UI ----
function renderSatelliteGrid() {
  const grid = document.getElementById('satellite-grid');
  grid.innerHTML = '';
  SATELLITES.forEach(sat => {
    const card = document.createElement('div');
    card.className = 'sat-card' + (sat.id === state.satellite ? ' active' : '');
    card.dataset.id = sat.id;
    card.innerHTML = `
      <div class="sat-card-header">
        <span class="sat-name">${sat.name}</span>
        <span class="sat-agency">${sat.agency}</span>
      </div>
      <div class="sat-meta">
        <span title="Revisit time">⏱ ${sat.revisit}</span>
        <span title="Resolution">📐 ${sat.resolution}</span>
        ${sat.geostationary ? '<span class="geo-badge">GEO</span>' : ''}
        ${sat.liveOnly ? '<span class="live-badge">⚡ Live</span>' : ''}
      </div>`;
    card.addEventListener('click', () => selectSatellite(sat.id));
    grid.appendChild(card);
  });
}

function selectSatellite(id) {
  state.satellite = id;
  document.querySelectorAll('.sat-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.sat-card[data-id="${id}"]`).classList.add('active');

  const sat = SATELLITES.find(s => s.id === id);
  // Default to first layer of new satellite
  if (!sat.layers.find(l => l.id === state.layer)) {
    state.layer = sat.layers[0].id;
  }
  renderLayerGrid();
  updateSatInfo(sat);
}

function renderLayerGrid() {
  const grid = document.getElementById('layer-grid');
  grid.innerHTML = '';
  const sat = SATELLITES.find(s => s.id === state.satellite);
  if (!sat) return;

  sat.layers.forEach(layer => {
    const btn = document.createElement('button');
    btn.className = 'layer-btn' + (layer.id === state.layer ? ' active' : '');
    btn.dataset.id = layer.id;
    btn.title = layer.description;
    btn.innerHTML = `<span class="layer-icon">${layer.icon}</span><span class="layer-name">${layer.name}</span>`;
    if (layer.type === 'overlay') {
      btn.innerHTML += '<span class="layer-badge">+Base</span>';
    }
    btn.addEventListener('click', () => selectLayer(layer.id));
    grid.appendChild(btn);
  });

  updateLayerDescription();
}

function selectLayer(id) {
  state.layer = id;
  document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.layer-btn[data-id="${id}"]`).classList.add('active');
  updateLayerDescription();
}

function updateLayerDescription() {
  const sat = SATELLITES.find(s => s.id === state.satellite);
  const layer = sat && sat.layers.find(l => l.id === state.layer);
  if (!layer) return;
  const desc = document.getElementById('layer-description');
  desc.innerHTML = `<span class="layer-use-badge">${layer.usecase || ''}</span> ${layer.description}`;
}

function updateSatInfo(sat) {
  const el = document.getElementById('sat-info-text');
  if (el) {
    const since = sat.startDate ? `Available from: ${sat.startDate}` : 'Current imagery only (no date filter)';
    el.textContent = `Coverage: ${sat.coverage} | ${since}`;
  }
}

// ---- Timeline Slots ----
function addDefaultSlots() {
  const today = new Date();
  addSlot('Pre-Disaster',   offsetDate(today, -30), null,  false);
  addSlot('Disaster Event', offsetDate(today, -7),  0,     true);
  addSlot('Post-Disaster',  formatDate(today),       7,    false);
}

// daysOffset: null = manual slot (no cascade), number = days from event slot
// isEvent: true = this slot drives all others when its date changes
function addSlot(label = '', date = '', daysOffset = null, isEvent = false) {
  const id = ++state.slotIdCounter;
  if (!date) date = formatDate(new Date());
  if (!label) label = `Date ${state.slots.length + 1}`;
  state.slots.push({ id, label, date, daysOffset, isEvent });
  renderTimelineSlots();
}

// When the event slot date changes, recalculate all offset slots
function cascadeDatesFromEvent(eventDateStr) {
  if (!eventDateStr) return;
  const base = new Date(eventDateStr + 'T12:00:00'); // noon avoids DST edge cases
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

  document.getElementById('slot-count').textContent = `${state.slots.length} date${state.slots.length !== 1 ? 's' : ''}`;

  state.slots.forEach((slot, index) => {
    const el = document.createElement('div');
    el.className = 'timeline-slot' + (slot.isEvent ? ' slot-is-event' : '');
    el.dataset.id = slot.id;

    const labelClass = getSlotLabelClass(slot.label);
    const cascadeBadge = slot.isEvent
      ? '<span class="cascade-badge" title="Changing this date updates all other dates">⟳ Drives timeline</span>'
      : (slot.daysOffset !== null ? `<span class="offset-badge">Δ${slot.daysOffset >= 0 ? '+' : ''}${slot.daysOffset}d</span>` : '');

    el.innerHTML = `
      <div class="slot-number ${labelClass}">${index + 1}</div>
      <div class="slot-fields">
        <div class="slot-label-row">
          <input type="text" class="slot-label-input" value="${escHtml(slot.label)}"
                 placeholder="Label (e.g. Pre-Flood)" data-id="${slot.id}">
          ${cascadeBadge}
        </div>
        <input type="date" class="slot-date-input" value="${slot.date}" data-id="${slot.id}">
      </div>
      <button class="slot-remove-btn" data-id="${slot.id}" title="Remove">✕</button>`;

    container.appendChild(el);
  });

  // Bind inputs
  container.querySelectorAll('.slot-label-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const id = +e.target.dataset.id;
      const s = state.slots.find(s => s.id === id);
      if (s) {
        s.label = e.target.value;
        const num = e.target.closest('.timeline-slot').querySelector('.slot-number');
        num.className = `slot-number ${getSlotLabelClass(s.label)}`;
      }
    });
  });

  container.querySelectorAll('.slot-date-input').forEach(inp => {
    inp.addEventListener('change', e => {
      const id = +e.target.dataset.id;
      const s = state.slots.find(s => s.id === id);
      if (!s) return;
      s.date = e.target.value;
      // If this is the event slot, cascade all relative dates
      if (s.isEvent) {
        cascadeDatesFromEvent(s.date);
        showToast('All timeline dates updated relative to event date.', 'success');
      }
    });
  });

  container.querySelectorAll('.slot-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      removeSlot(+e.target.dataset.id);
    });
  });
}

function getSlotLabelClass(label) {
  const lower = (label || '').toLowerCase();
  if (lower.includes('pre') || lower.includes('before') || lower.includes('prior')) return 'slot-pre';
  if (lower.includes('peak') || lower.includes('event') || lower.includes('disaster') ||
      lower.includes('landfall') || lower.includes('ignition') || lower.includes('quake') ||
      lower.includes('flood') && lower.includes('flood')) return 'slot-event';
  if (lower.includes('recovery') || lower.includes('post') || lower.includes('after')) return 'slot-post';
  return 'slot-neutral';
}

function applyPreset(presetKey) {
  const preset = DISASTER_PRESETS[presetKey];
  if (!preset) return;

  selectSatellite(preset.satellite);
  selectLayer(preset.layer);
  renderLayerGrid();

  const eventDate = new Date();
  state.slots = [];
  state.slotIdCounter = 0;

  preset.timelineSlots.forEach(ts => {
    const d = new Date(eventDate);
    d.setDate(d.getDate() + ts.daysOffset);
    state.slots.push({
      id: ++state.slotIdCounter,
      label: ts.label,
      date: formatDate(d),
      daysOffset: ts.daysOffset,
      isEvent: ts.daysOffset === 0
    });
  });

  renderTimelineSlots();

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.preset-btn[data-preset="${presetKey}"]`)?.classList.add('active');

  showToast(`Applied "${preset.name}" preset — adjust dates as needed`, 'info');
}

// ============================================================
// IMAGE FETCHING — Tile stitching (fast CDN tiles → canvas)
// Falls back to WMS if tiles can't be drawn (e.g. no CORS).
// ============================================================

// Tile coordinate math (Web Mercator / EPSG:3857)
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
  // Highest zoom where the bbox still fits within a 7×7 = 49-tile grid
  // tile_width_deg = 360/2^z → max_z = floor(log2(7*360/span)) = floor(log2(2520/span))
  const maxByTileCount = Math.floor(Math.log2(2520 / span));
  // Always use maximum available zoom (best resolution) within the satellite cap and tile limit
  return Math.max(1, Math.min(maxZ, maxByTileCount));
}

// Stitch tiles into a cropped 512×512 canvas. Returns canvas or null on failure.
async function _stitchToCanvas(bbox, tileUrlFn, zoom) {
  const [w, s, e, n] = bbox;
  const xMin = _lon2tile(w, zoom), xMax = _lon2tile(e, zoom);
  const yMin = _lat2tile(n, zoom), yMax = _lat2tile(s, zoom); // y increases downward
  const cols = xMax - xMin + 1, rows = yMax - yMin + 1;
  if (cols * rows > 49) return null; // too many tiles, skip

  const T = 256;
  const raw = document.createElement('canvas');
  raw.width = cols * T; raw.height = rows * T;
  const ctx = raw.getContext('2d');

  try {
    const tasks = [];
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tasks.push(new Promise(res => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload  = () => { ctx.drawImage(img, (x - xMin) * T, (y - yMin) * T, T, T); res(); };
          img.onerror = () => res();
          img.src = tileUrlFn(x, y, zoom);
        }));
      }
    }
    await Promise.all(tasks);

    // Crop stitched canvas to exact bbox
    const lonW = _tile2lon(xMin,     zoom), lonE = _tile2lon(xMax + 1, zoom);
    const latN = _tile2lat(yMin,     zoom), latS = _tile2lat(yMax + 1, zoom);
    const rw = raw.width, rh = raw.height;
    const px = Math.round((w - lonW) / (lonE - lonW) * rw);
    const py = Math.round((latN - n) / (latN - latS) * rh);
    const pw = Math.max(1, Math.round((e - w)   / (lonE - lonW) * rw));
    const ph = Math.max(1, Math.round((n - s)   / (latN - latS) * rh));

    // Preserve the natural pixel aspect ratio of the cropped region so the
    // output image matches the map viewport proportions without squashing.
    const maxDim = 512;
    const outW = pw >= ph ? maxDim : Math.max(1, Math.round(maxDim * pw / ph));
    const outH = ph >= pw ? maxDim : Math.max(1, Math.round(maxDim * ph / pw));
    const out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    out.getContext('2d').drawImage(raw, px, py, pw, ph, 0, 0, outW, outH);
    return out;
  } catch (err) {
    return null; // tainted canvas or other error → caller will use WMS fallback
  }
}

// GIBS WMTS tiles (date-specific, max zoom 9, supports CORS)
async function _stitchGibs(layerName, date, bbox, isPng) {
  const zoom = _bboxZoom(bbox, 9);
  const ext  = isPng ? 'png' : 'jpg';
  const fn   = (x, y, z) =>
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerName}/default/${date}/GoogleMapsCompatible_Level9/${z}/${y}/${x}.${ext}`;
  return _stitchToCanvas(bbox, fn, zoom);
}

// GIBS has ~1-2 day data lag; anything newer has no imagery
const _GIBS_MAX_DATE = (() => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

// Check if a canvas is essentially blank (for PNG overlay layers where no-data = transparent)
function _isCanvasBlank(canvas) {
  try {
    const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let nonEmpty = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 15) nonEmpty++;
    return nonEmpty / (width * height) < 0.02; // < 2% non-transparent pixels = no data
  } catch(e) { return false; } // tainted canvas — assume has data
}

// Check if a JPEG canvas is essentially uniform color (GIBS blank-tile placeholder)
function _isJpegCanvasBlank(canvas) {
  try {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    // Sample every ~50th pixel for variance
    let sumR = 0, sumG = 0, sumB = 0, n = 0;
    for (let i = 0; i < data.length; i += 4 * 50) { sumR += data[i]; sumG += data[i+1]; sumB += data[i+2]; n++; }
    const aR = sumR/n, aG = sumG/n, aB = sumB/n;
    let variance = 0;
    for (let i = 0; i < data.length; i += 4 * 50)
      variance += (data[i]-aR)**2 + (data[i+1]-aG)**2 + (data[i+2]-aB)**2;
    return (variance / n) < 120; // very low variance = likely solid-color placeholder
  } catch(e) { return false; }
}

// Returns candidate dates to try: [0, +1, -1, +2, -2, ...]
function _candidateDates(dateStr, radius = 15) {
  const base = new Date(dateStr + 'T12:00:00Z');
  return [0, ...Array.from({length: radius}, (_, i) => [i+1, -(i+1)]).flat()].map(offset => {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });
}

// Stitch GIBS tiles, searching nearby dates if the exact date has no data.
// Returns {canvas, usedDate} or null.
async function _stitchGibsNearest(layerName, requestedDate, bbox, isPng, satStartDate) {
  const minDate = satStartDate || '2000-01-01';
  // GIBS zoom-9 tiles are ~0.703°/tile (256 px). When the viewport span is very small
  // the crop is only a handful of pixels upscaled to 512 — artificially low variance.
  // Skip the blank check in that case so we don't discard valid (if pixelated) imagery.
  const tileWidthDeg = 360 / (1 << 9); // ≈ 0.703°
  const cropPx = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]) / tileWidthDeg * 256;
  const skipBlank = cropPx < 32; // < 32 source pixels → upscale too extreme for variance check
  for (const tryDate of _candidateDates(requestedDate)) {
    if (tryDate > _GIBS_MAX_DATE || tryDate < minDate) continue; // skip future / pre-launch
    const canvas = await _stitchGibs(layerName, tryDate, bbox, isPng);
    if (!canvas) continue;
    if (!skipBlank && isPng  && _isCanvasBlank(canvas))     continue; // overlay with no data → try next
    if (!skipBlank && !isPng && _isJpegCanvasBlank(canvas)) continue; // JPEG placeholder → try next
    return { canvas, usedDate: tryDate };
  }
  return null;
}

// ESRI tiles (current imagery, supports CORS, max zoom ~19)
async function _stitchEsri(bbox) {
  // Cap at the current map zoom so image detail matches what the user sees.
  // Allow up to zoom 19 (ESRI's practical max) regardless of map zoom.
  const mapZ = state.map ? state.map.getZoom() : 17;
  // Allow up to zoom 21 to match the Google Satellite basemap's resolution ceiling.
  const zoom = _bboxZoom(bbox, Math.min(21, Math.max(mapZ, 10)));
  const fn   = (x, y, z) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  return _stitchToCanvas(bbox, fn, zoom);
}

// Sentinel-2 Cloudless tiles (supports CORS)
async function _stitchSentinel(bbox) {
  const zoom = _bboxZoom(bbox, 14);
  const fn   = (x, y, z) =>
    `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2022_3857/default/g/${z}/${y}/${x}.jpg`;
  return _stitchToCanvas(bbox, fn, zoom);
}

// WMS fallback URL (GIBS GetMap — slower, but handles edge cases)
function buildWmsUrl(gibsLayers, date, bbox, size) {
  const [w, s, e, n] = bbox;
  const layerStr  = Array.isArray(gibsLayers) ? gibsLayers.join(',') : gibsLayers;
  const hasOverlay = Array.isArray(gibsLayers) && gibsLayers.length > 1;
  const format    = hasOverlay ? 'image%2Fpng' : 'image%2Fjpeg';
  return (
    `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?` +
    `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${encodeURIComponent(layerStr)}` +
    `&SRS=EPSG:4326&BBOX=${w},${s},${e},${n}` +
    `&WIDTH=${size}&HEIGHT=${size}` +
    `&TIME=${date}T00:00:00Z&FORMAT=${format}&TRANSPARENT=TRUE`
  );
}

// ESRI ArcGIS Export fallback
function buildEsriUrl(bbox, size) {
  const [w, s, e, n] = bbox;
  return (
    `https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${w},${s},${e},${n}&bboxSR=4326&size=${size},${size}&imageSR=4326&format=jpg&f=image`
  );
}

// Google: single best-fitting tile (no CORS → can't canvas-stitch).
// Uses the current map zoom so the tile matches what the user sees.
function buildGoogleTileUrl(bbox) {
  const [w, s, e, n] = bbox;
  const lat  = (s + n) / 2, lon = (w + e) / 2;
  const zoom = state.map ? Math.min(20, Math.max(1, state.map.getZoom())) : 15;
  const x = Math.floor((lon + 180) / 360 * (1 << zoom));
  const r = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << zoom));
  return `https://mt0.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${zoom}`;
}

function getLayerStack() {
  const sat = SATELLITES.find(s => s.id === state.satellite);
  if (!sat || sat.provider) return [];
  const layer = sat.layers.find(l => l.id === state.layer);
  if (!layer) return [];
  if (layer.type === 'overlay' && layer.basePair) {
    const base = sat.layers.find(l => l.id === layer.basePair);
    if (base) return [base.gibsLayer, layer.gibsLayer];
  }
  return [layer.gibsLayer];
}

// Main image URL resolver — tile-stitch with nearest-date search, WMS as last fallback.
// Returns {url: string, usedDate: string|null}
async function resolveImageUrl(sat, layer, gibsLayers, slot, bbox) {
  if (sat.provider === 'google') {
    // Google tiles have no CORS headers so canvas-stitching is blocked.
    // ESRI World Imagery has equivalent quality and supports CORS — use it
    // to produce a properly zoomed, viewport-matched canvas.
    // Fall back to a single Google tile (may not fill the full viewport)
    // only if ESRI stitching fails.
    const c = await _stitchEsri(bbox);
    return { url: c ? c.toDataURL('image/jpeg', 0.88) : buildGoogleTileUrl(bbox), usedDate: null };
  }

  if (sat.provider === 'esri') {
    const c = await _stitchEsri(bbox);
    return { url: c ? c.toDataURL('image/jpeg', 0.88) : buildEsriUrl(bbox, 512), usedDate: null };
  }

  // GIBS-based satellite — use nearest-date search
  const satStartDate = sat.startDate || '2000-01-01';

  if (layer.type === 'overlay' && gibsLayers.length > 1) {
    // Stitch base + overlay independently (may settle on different nearby dates)
    const baseResult    = await _stitchGibsNearest(gibsLayers[0], slot.date, bbox, false, satStartDate);
    const overlayResult = await _stitchGibsNearest(gibsLayers[1], slot.date, bbox, true,  satStartDate);

    if (baseResult) {
      const out = document.createElement('canvas');
      out.width  = baseResult.canvas.width;
      out.height = baseResult.canvas.height;
      const ctx = out.getContext('2d');
      ctx.drawImage(baseResult.canvas, 0, 0, out.width, out.height);
      if (overlayResult) { ctx.globalAlpha = 0.85; ctx.drawImage(overlayResult.canvas, 0, 0, out.width, out.height); }
      return { url: out.toDataURL('image/jpeg', 0.88), usedDate: baseResult.usedDate };
    }
    // WMS fallback (clamp to max available date)
    const fallbackDate = slot.date > _GIBS_MAX_DATE ? _GIBS_MAX_DATE : slot.date;
    return { url: buildWmsUrl(gibsLayers, fallbackDate, bbox, 512), usedDate: fallbackDate };
  }

  // Single GIBS layer
  const isPng = layer.format === 'png';
  const result = await _stitchGibsNearest(gibsLayers[0], slot.date, bbox, isPng, satStartDate);
  if (result) return { url: result.canvas.toDataURL('image/jpeg', 0.88), usedDate: result.usedDate };

  const fallbackDate = slot.date > _GIBS_MAX_DATE ? _GIBS_MAX_DATE : slot.date;
  return { url: buildWmsUrl(gibsLayers, fallbackDate, bbox, 512), usedDate: fallbackDate };
}

// ---- Load Images ----
async function loadImages() {
  if (state.slots.length === 0) {
    showToast('Please add at least one date to the timeline.', 'error');
    return;
  }
  if (state.slots.some(s => !s.date)) {
    showToast('Please fill in all dates in the timeline.', 'error');
    return;
  }

  // Use the explicit drawn/selected bbox if set; otherwise use the current map viewport.
  // This means whatever is visible on the map right now becomes the image extent.
  let activeBbox = state.bbox;
  if (!activeBbox) {
    const b = state.map.getBounds();
    activeBbox = [
      +b.getWest().toFixed(6), +b.getSouth().toFixed(6),
      +b.getEast().toFixed(6), +b.getNorth().toFixed(6)
    ];
  }

  const sat        = SATELLITES.find(s => s.id === state.satellite);
  const layer      = sat.layers.find(l => l.id === state.layer);
  const gibsLayers = getLayerStack();

  // Capture the map's pixel aspect ratio so image cards can match it exactly.
  const mapSize = state.map.getSize();
  state.cardAspect = mapSize.x / mapSize.y;

  // Initialise slots with empty imageUrl — cards render immediately with spinners
  state.loadedSlots = state.slots.map((slot, i) => ({
    ...slot,
    imageUrl:      '',
    satelliteName: sat.name,
    layerName:     layer.name,
    bbox:          [...activeBbox],
    index:         i,
    liveOnly:      !!sat.liveOnly
  }));

  // Snap the map to exactly the bbox being loaded so the top view always matches the images.
  state.map.fitBounds(
    [[activeBbox[1], activeBbox[0]], [activeBbox[3], activeBbox[2]]],
    { animate: false, padding: [0, 0] }
  );

  renderImageGrid();
  enableActionButtons();
  document.getElementById('images-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Fetch all images in parallel — each card updates as its tiles arrive
  await Promise.all(
    state.loadedSlots.map(async (slot, i) => {
      const { url, usedDate } = await resolveImageUrl(sat, layer, gibsLayers, slot, activeBbox);
      slot.imageUrl  = url;
      slot.usedDate  = usedDate;
      setCardImage(i, url, usedDate, slot.date);
    })
  );
}

// Update a rendered card with its resolved image URL / data URL.
// usedDate is the date that actually had imagery (may differ from requestedDate).
function setCardImage(idx, url, usedDate, requestedDate) {
  const card = document.querySelector(`.image-card[data-index="${idx}"]`);
  if (!card) return;
  const img     = card.querySelector('.card-image');
  const loading = card.querySelector('.card-img-loading');
  const noData  = card.querySelector('.card-no-data');
  const dateEl  = card.querySelector('.card-date');

  // Show the actual date used; flag when it differs from what was requested
  if (usedDate && dateEl && !card.querySelector('.card-date').textContent.startsWith('⚡')) {
    if (usedDate !== requestedDate) {
      dateEl.textContent = usedDate;
      dateEl.title = `Nearest imagery to ${requestedDate}`;
      dateEl.classList.add('date-adjusted');
    }
  }

  if (!url) {
    loading.style.display = 'none';
    noData.style.display  = 'flex';
    return;
  }

  if (url.startsWith('data:')) {
    // Canvas data URL — pixels already here, instant display
    img.src = url;
    loading.style.display = 'none';
    img.style.display     = 'block';
    return;
  }

  // External URL (Google tile, WMS fallback) — wait for network with timeout
  const t = setTimeout(() => {
    loading.style.display = 'none';
    noData.style.display  = 'flex';
    img.style.display     = 'none';
  }, 15000);
  img.addEventListener('load',  () => { clearTimeout(t); loading.style.display = 'none'; img.style.display = 'block'; });
  img.addEventListener('error', () => { clearTimeout(t); loading.style.display = 'none'; noData.style.display = 'flex'; img.style.display = 'none'; });
  img.src = url;
}

// ---- Image Grid ----
function renderImageGrid() {
  const grid = document.getElementById('images-grid');
  const empty = document.getElementById('empty-state');
  const countEl = document.getElementById('image-count');

  empty.style.display = 'none';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${state.gridCols}, 1fr)`;
  grid.innerHTML = '';

  countEl.textContent = `${state.loadedSlots.length} image${state.loadedSlots.length !== 1 ? 's' : ''}`;

  state.loadedSlots.forEach((slot, idx) => {
    grid.appendChild(buildImageCard(slot, idx));
  });

  updateCompareSelects();
}

function buildImageCard(slot, idx) {
  const card = document.createElement('div');
  card.className = 'image-card';
  card.dataset.index = idx;

  const headerClass = getSlotLabelClass(slot.label);
  const [w, s, e, n] = slot.bbox;
  const downloadFilename = `${slot.satelliteName}_${slot.label.replace(/\s+/g, '_')}_${slot.date}.jpg`;

  card.innerHTML = `
    <div class="card-header ${headerClass}">
      <span class="card-label">${escHtml(slot.label)}</span>
      <span class="card-date">${slot.liveOnly ? '⚡ Current' : slot.date}</span>
    </div>
    <div class="card-image-wrapper" style="aspect-ratio:${(state.cardAspect || 1).toFixed(4)}">
      <div class="card-img-loading">
        <div class="mini-spinner"></div>
        <span>Stitching tiles…</span>
      </div>
      <img class="card-image" src="" alt="${escHtml(slot.label)} ${slot.date}" style="display:none">
      <div class="card-no-data" style="display:none">
        <span>⚠️</span><span>No imagery available for this date/location</span>
      </div>
      <div class="card-actions">
        <button class="card-action-btn" data-idx="${idx}" data-action="download" title="Download image">⬇ Download</button>
        <button class="card-action-btn" data-idx="${idx}" data-action="expand" title="View fullscreen">⛶ Expand</button>
        <button class="card-action-btn" data-idx="${idx}" data-action="nasa" title="Open in NASA Worldview">🌐 NASA</button>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-sat-tag">${slot.satelliteName}</span>
      <span class="card-layer-tag">${slot.layerName}</span>
    </div>`;

  // Actions
  card.querySelectorAll('.card-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const i = +btn.dataset.idx;
      if (action === 'download') downloadImage(state.loadedSlots[i].imageUrl, downloadFilename);
      if (action === 'expand') expandImage(i);
      if (action === 'nasa') openNASAWorldview(state.loadedSlots[i]);
    });
  });

  return card;
}

function expandImage(idx) {
  const slot = state.loadedSlots[idx];
  if (!slot) return;

  const overlay = document.getElementById('expand-modal');
  const img = document.getElementById('expand-img');
  const title = document.getElementById('expand-title');

  img.src = slot.imageUrl;
  title.textContent = `${slot.label} — ${slot.date} — ${slot.satelliteName}`;
  overlay.style.display = 'flex';
}

function openNASAWorldview(slot) {
  const [w, s, e, n] = slot.bbox;
  const center = `${((s + n) / 2).toFixed(4)},${((w + e) / 2).toFixed(4)}`;
  const url = `https://worldview.earthdata.nasa.gov/?v=${w},${s},${e},${n}&t=${slot.date}`;
  window.open(url, '_blank');
}

// ---- Image Download ----
async function downloadImage(url, filename) {
  try {
    showToast('Downloading image...', 'info');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('Image downloaded!', 'success');
  } catch (err) {
    showToast('Download failed. Try right-clicking the image to save.', 'error');
  }
}

async function downloadAllImages() {
  for (let i = 0; i < state.loadedSlots.length; i++) {
    const slot = state.loadedSlots[i];
    const sat = SATELLITES.find(s => s.id === state.satellite);
    const filename = `${sat?.name || ''}_${slot.label.replace(/\s+/g, '_')}_${slot.date}.jpg`;
    await downloadImage(slot.imageUrl, filename);
    await new Promise(r => setTimeout(r, 500));
  }
}

// ---- Comparison Modal ----
function updateCompareSelects() {
  const before = document.getElementById('compare-before');
  const after = document.getElementById('compare-after');

  [before, after].forEach(sel => {
    sel.innerHTML = '<option value="">-- Select image --</option>';
    state.loadedSlots.forEach((slot, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${slot.label} (${slot.date})`;
      sel.appendChild(opt);
    });
  });

  if (state.loadedSlots.length >= 1) before.value = 0;
  if (state.loadedSlots.length >= 2) after.value = state.loadedSlots.length - 1;
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
  const bi = +document.getElementById('compare-before').value;
  const ai = +document.getElementById('compare-after').value;

  const before = state.loadedSlots[bi];
  const after = state.loadedSlots[ai];

  if (!before || !after) return;

  const mode = state.compareMode;

  document.getElementById('comparison-slider-view').style.display = mode === 'slider' ? 'block' : 'none';
  document.getElementById('side-by-side-view').style.display = mode === 'sidebyside' ? 'flex' : 'none';

  if (mode === 'slider') {
    const beforeImg = document.getElementById('cmp-before-img');
    const afterImg = document.getElementById('cmp-after-img');
    const slider = document.getElementById('cmp-slider');

    beforeImg.src = before.imageUrl;
    afterImg.src = after.imageUrl;

    document.getElementById('cmp-before-label').textContent = `${before.label} | ${before.date}`;
    document.getElementById('cmp-after-label').textContent = `${after.label} | ${after.date}`;

    slider.value = 50;
    applySliderSplit(50);

    slider.oninput = () => applySliderSplit(+slider.value);
  } else {
    document.getElementById('sbs-before-img').src = before.imageUrl;
    document.getElementById('sbs-after-img').src = after.imageUrl;
    document.getElementById('sbs-before-label').textContent = `${before.label} (${before.date})`;
    document.getElementById('sbs-after-label').textContent = `${after.label} (${after.date})`;
  }
}

function applySliderSplit(pct) {
  const beforeImg = document.getElementById('cmp-before-img');
  beforeImg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  const divider = document.getElementById('cmp-divider');
  divider.style.left = pct + '%';
}

// ---- Location Search (Nominatim) ----
async function searchLocation(query) {
  if (!query.trim()) return;
  try {
    showToast('Searching...', 'info');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (data && data.length > 0) {
      const loc = data[0];
      const lat = parseFloat(loc.lat);
      const lng = parseFloat(loc.lon);
      state.map.setView([lat, lng], 7);
      setLocation(lat, lng);
      showToast(`Found: ${loc.display_name.split(',').slice(0, 2).join(',')}`, 'success');
    } else {
      showToast('Location not found. Try different search terms.', 'error');
    }
  } catch (e) {
    showToast('Search failed. Please try again.', 'error');
  }
}

// ---- Grid Columns ----
function setGridCols(cols) {
  state.gridCols = cols;
  document.querySelectorAll('.grid-col-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.cols === cols);
  });
  if (state.loadedSlots.length > 0) renderImageGrid();
}

// ---- Enable/Disable Buttons ----
function enableActionButtons() {
  document.getElementById('compare-btn').disabled = false;
  document.getElementById('export-all-btn').disabled = false;
}

// ---- Loading Overlay ----
function showLoading(show, text = 'Loading satellite imagery...') {
  const overlay = document.getElementById('loading-overlay');
  overlay.style.display = show ? 'flex' : 'none';
  document.getElementById('loading-text').textContent = text;
}

// ---- Toast Notifications ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Sidebar (mobile) ----
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

// ---- Helpers ----
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function offsetDate(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Event Listeners ----
function setupEventListeners() {
  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // Location controls
  document.getElementById('search-btn').addEventListener('click', () => {
    searchLocation(document.getElementById('location-search').value);
  });
  document.getElementById('location-search').addEventListener('keypress', e => {
    if (e.key === 'Enter') searchLocation(e.target.value);
  });
  document.getElementById('go-to-location').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('lat-input').value);
    const lng = parseFloat(document.getElementById('lng-input').value);
    if (isNaN(lat) || isNaN(lng)) { showToast('Enter valid coordinates.', 'error'); return; }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Latitude must be -90–90, longitude -180–180.', 'error'); return;
    }
    // Derive zoom from the radius slider so the map shows the requested span
    const radiusVal = parseFloat(document.getElementById('view-radius').value);
    const spanDeg   = radiusVal * 0.8; // slider 1→0.8°, 2.5→2°, 5→4°, 10→8°
    const targetZ   = Math.max(4, Math.min(14, Math.round(Math.log2(360 / spanDeg))));
    state.map.setView([lat, lng], targetZ);
    setLocation(lat, lng);
  });
  document.getElementById('use-map-view').addEventListener('click', () => {
    const bounds = state.map.getBounds();
    state.bbox = [
      +bounds.getWest().toFixed(6), +bounds.getSouth().toFixed(6),
      +bounds.getEast().toFixed(6), +bounds.getNorth().toFixed(6)
    ];
    const c = bounds.getCenter();
    state.center = [+c.lat.toFixed(5), +c.lng.toFixed(5)];
    document.getElementById('lat-input').value = state.center[0];
    document.getElementById('lng-input').value = state.center[1];
    drawBboxOnMap();
    updateAoiInfo();
    showToast('Current map view pinned as area of interest.', 'success');
  });
  document.getElementById('view-radius').addEventListener('input', e => {
    // Update the km display; zoom is applied the next time "Go to Location" is clicked
    const kmApprox = Math.round(parseFloat(e.target.value) * 89);
    document.getElementById('area-km-display').textContent = `~${kmApprox} km span`;
  });
  document.getElementById('clear-aoi-btn').addEventListener('click', clearAoi);

  // Draw rectangle / square
  document.getElementById('draw-rect-btn').addEventListener('click', () => {
    if (state.drawingMode && state.drawConstraint === 'rect') stopDrawMode();
    else { if (state.drawingMode) stopDrawMode(); startDrawMode('rect'); }
  });
  document.getElementById('draw-square-btn').addEventListener('click', () => {
    if (state.drawingMode && state.drawConstraint === 'square') stopDrawMode();
    else { if (state.drawingMode) stopDrawMode(); startDrawMode('square'); }
  });

  // Basemap
  document.getElementById('basemap-select').addEventListener('change', e => applyBasemap(e.target.value));

  // Timeline
  document.getElementById('add-slot-btn').addEventListener('click', () => addSlot());
  document.getElementById('clear-all-slots-btn').addEventListener('click', () => {
    if (state.slots.length === 0) return;
    if (confirm('Clear all timeline slots?')) {
      state.slots = [];
      renderTimelineSlots();
    }
  });

  // Grid columns
  document.querySelectorAll('.grid-col-btn').forEach(btn => {
    btn.addEventListener('click', () => setGridCols(+btn.dataset.cols));
  });

  // Image size
  document.getElementById('image-size-select').addEventListener('change', e => {
    state.imageSize = +e.target.value;
  });

  // Load / export / compare
  document.getElementById('load-images-btn').addEventListener('click', loadImages);
  document.getElementById('export-all-btn').addEventListener('click', downloadAllImages);
  document.getElementById('compare-btn').addEventListener('click', openComparisonModal);

  // Comparison modal
  document.getElementById('close-comparison').addEventListener('click', () => {
    document.getElementById('comparison-modal').style.display = 'none';
  });
  document.getElementById('comparison-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('comparison-modal')) {
      document.getElementById('comparison-modal').style.display = 'none';
    }
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
    if (e.target === document.getElementById('expand-modal') || e.target.id === 'expand-close') {
      document.getElementById('expand-modal').style.display = 'none';
    }
  });

  // Sidebar toggle on mobile
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.contains('open') ? closeSidebar() : openSidebar();
  });
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);
}
