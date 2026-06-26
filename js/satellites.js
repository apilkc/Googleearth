// Satellite and layer configuration
// All three sources are free, open, and support historical date timelines.
const SATELLITES = [
  {
    id: 'esri_wayback',
    name: 'Imagery Archive',
    agency: 'ESRI Wayback',
    description: 'Dated snapshots of high-resolution commercial imagery (~0.5m). Covers Feb 2014 onward. Shows actual changes between dates — ideal for before/after disaster comparisons.',
    revisit: 'Snapshots',
    resolution: '~0.5m',
    startDate: '2014-02-20',
    coverage: 'Global',
    provider: 'wayback',
    layers: [
      {
        id: 'world_imagery',
        name: 'True Color',
        icon: '🛰️',
        gibsLayer: null,
        format: 'jpeg',
        description: 'High-resolution true color imagery. Different dates load different archive snapshots — you will see real visual change over time.',
        type: 'base',
        usecase: 'Before/After'
      }
    ]
  },
  {
    id: 'modis_terra',
    name: 'MODIS Terra',
    agency: 'NASA',
    description: 'Daily global imagery at 250m. Archive goes back to Feb 2000 — the deepest historical record available. Good for large-scale floods, fires and regional change.',
    revisit: 'Daily',
    resolution: '250m',
    startDate: '2000-02-24',
    coverage: 'Global',
    layers: [
      {
        id: 'true_color',
        name: 'True Color',
        icon: '🌍',
        gibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
        format: 'jpeg',
        description: 'Natural color imagery as seen from space. Best for general monitoring and cloud-free regional views.',
        type: 'base',
        usecase: 'General'
      },
      {
        id: 'bands721',
        name: 'False Color (Fire)',
        icon: '🔥',
        gibsLayer: 'MODIS_Terra_CorrectedReflectance_Bands721',
        format: 'jpeg',
        description: 'Red = active fire, brown = burned area, bright green = healthy vegetation.',
        type: 'analysis',
        usecase: 'Fire, Burn scar'
      },
      {
        id: 'flood',
        name: 'Flood Detection',
        icon: '💧',
        gibsLayer: 'MODIS_Terra_Flood_3Day',
        format: 'png',
        description: 'Flood water extent (3-day composite). Blue = flood water.',
        type: 'overlay',
        basePair: 'true_color',
        usecase: 'Flood'
      }
    ]
  },
  {
    id: 'viirs_noaa20',
    name: 'VIIRS NOAA-20',
    agency: 'NASA/NOAA',
    description: 'Daily imagery at 375m, available since Jan 2018. Sharper than MODIS. Excellent night-lights layer for detecting power outages after disasters.',
    revisit: 'Daily',
    resolution: '375m',
    startDate: '2018-01-01',
    coverage: 'Global',
    layers: [
      {
        id: 'true_color',
        name: 'True Color',
        icon: '🌍',
        gibsLayer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
        format: 'jpeg',
        description: 'Natural color imagery with improved sharpness over MODIS.',
        type: 'base',
        usecase: 'General'
      },
      {
        id: 'false_color',
        name: 'False Color (Fire)',
        icon: '🔥',
        gibsLayer: 'VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1',
        format: 'jpeg',
        description: 'Enhanced fire and burn scar visualization.',
        type: 'analysis',
        usecase: 'Fire, Burn scar'
      },
      {
        id: 'night',
        name: 'Night Lights',
        icon: '🌙',
        gibsLayer: 'VIIRS_NOAA20_DayNightBand_ENCC',
        format: 'png',
        description: 'Nighttime city lights. Dark patches after a disaster indicate power outages.',
        type: 'analysis',
        usecase: 'Power outage, Hurricane'
      }
    ]
  }
];

const DISASTER_PRESETS = {
  flood: {
    name: 'Flood Disaster',
    satellite: 'modis_terra',
    layer: 'flood',
    color: '#4a9eff',
    timelineSlots: [
      { label: 'Pre-Flood: 30 Days', daysOffset: -30 },
      { label: 'Pre-Flood: 7 Days',  daysOffset:  -7 },
      { label: 'Flood Peak',          daysOffset:   0 },
      { label: 'Recovery: 1 Week',   daysOffset:   7 },
      { label: 'Recovery: 1 Month',  daysOffset:  30 }
    ]
  },
  wildfire: {
    name: 'Wildfire',
    satellite: 'viirs_noaa20',
    layer: 'false_color',
    color: '#ff6b35',
    timelineSlots: [
      { label: 'Pre-Fire: 2 Weeks',  daysOffset: -14 },
      { label: 'Fire Ignition',       daysOffset:   0 },
      { label: 'Fire Peak',           daysOffset:   3 },
      { label: 'Post-Fire: 2 Weeks', daysOffset:  14 },
      { label: 'Recovery: 1 Month',  daysOffset:  30 }
    ]
  },
  earthquake: {
    name: 'Earthquake',
    satellite: 'esri_wayback',
    layer: 'world_imagery',
    color: '#f39c12',
    timelineSlots: [
      { label: 'Pre-Quake: 1 Year',  daysOffset: -365 },
      { label: 'Pre-Quake: 1 Month', daysOffset:  -30 },
      { label: 'Day of Earthquake',  daysOffset:    0 },
      { label: 'Post: 1 Week',       daysOffset:    7 },
      { label: 'Recovery: 1 Year',   daysOffset:  365 }
    ]
  },
  hurricane: {
    name: 'Hurricane / Typhoon',
    satellite: 'viirs_noaa20',
    layer: 'true_color',
    color: '#9b59b6',
    timelineSlots: [
      { label: 'Pre-Storm: 1 Week',     daysOffset:  -7 },
      { label: 'Storm Approach: 2 Days', daysOffset:  -2 },
      { label: 'Landfall',               daysOffset:   0 },
      { label: 'Post-Storm: 3 Days',    daysOffset:   3 },
      { label: 'Recovery: 1 Month',     daysOffset:  30 }
    ]
  }
};
