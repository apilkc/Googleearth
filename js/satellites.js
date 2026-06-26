// Satellite and layer configuration using NASA GIBS (free, no API key required)
const SATELLITES = [
  {
    id: 'modis_terra',
    name: 'MODIS Terra',
    agency: 'NASA',
    iconClass: 'sat-icon-terra',
    description: 'Daily global, 250m, morning overpass. Available since Feb 2000.',
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
        description: 'Natural color imagery as seen from space. Best for general monitoring.',
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
        id: 'thermal',
        name: 'Thermal Anomalies',
        icon: '🌡️',
        gibsLayer: 'MODIS_Terra_Thermal_Anomalies_Day',
        format: 'png',
        description: 'Active fire and thermal hotspot detection overlaid on true color.',
        type: 'overlay',
        basePair: 'true_color',
        usecase: 'Wildfire'
      },
      {
        id: 'flood',
        name: 'Flood Detection',
        icon: '💧',
        gibsLayer: 'MODIS_Terra_Flood_3Day',
        format: 'png',
        description: 'Flood water extent detection (3-day composite). Blue = flood water.',
        type: 'overlay',
        basePair: 'true_color',
        usecase: 'Flood'
      },
      {
        id: 'lst',
        name: 'Land Surface Temp',
        icon: '🌡',
        gibsLayer: 'MODIS_Terra_Land_Surface_Temp_Day',
        format: 'png',
        description: 'Daytime land surface temperature. Useful for urban heat and drought.',
        type: 'analysis',
        usecase: 'Drought, Heat'
      },
      {
        id: 'ndvi',
        name: 'Vegetation (NDVI)',
        icon: '🌿',
        gibsLayer: 'MODIS_Terra_NDVI_8Day',
        format: 'png',
        description: 'Vegetation health index (8-day composite). Green = healthy, brown = stressed.',
        type: 'analysis',
        usecase: 'Drought, Recovery'
      }
    ]
  },
  {
    id: 'modis_aqua',
    name: 'MODIS Aqua',
    agency: 'NASA',
    iconClass: 'sat-icon-aqua',
    description: 'Daily global, 250m, afternoon overpass. Available since Jul 2002.',
    revisit: 'Daily',
    resolution: '250m',
    startDate: '2002-07-04',
    coverage: 'Global',
    layers: [
      {
        id: 'true_color',
        name: 'True Color',
        icon: '🌍',
        gibsLayer: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
        format: 'jpeg',
        description: 'Natural color imagery, afternoon pass. Complements MODIS Terra.',
        type: 'base',
        usecase: 'General'
      },
      {
        id: 'bands721',
        name: 'False Color (Fire)',
        icon: '🔥',
        gibsLayer: 'MODIS_Aqua_CorrectedReflectance_Bands721',
        format: 'jpeg',
        description: 'Red = active fire, brown = burned area.',
        type: 'analysis',
        usecase: 'Fire'
      },
      {
        id: 'thermal',
        name: 'Thermal Anomalies',
        icon: '🌡️',
        gibsLayer: 'MODIS_Aqua_Thermal_Anomalies_Day',
        format: 'png',
        description: 'Active fire hotspot detection.',
        type: 'overlay',
        basePair: 'true_color',
        usecase: 'Wildfire'
      }
    ]
  },
  {
    id: 'viirs_noaa20',
    name: 'VIIRS NOAA-20',
    agency: 'NASA/NOAA',
    iconClass: 'sat-icon-viirs',
    description: 'Daily, 375m, enhanced fire/cloud detection. Available since Jan 2018.',
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
        description: 'Natural color imagery.',
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
        name: 'Night Lights (DNB)',
        icon: '🌙',
        gibsLayer: 'VIIRS_NOAA20_DayNightBand_ENCC',
        format: 'png',
        description: 'Nighttime city lights. Power outages show as dark areas after disasters.',
        type: 'analysis',
        usecase: 'Power outage, Hurricane'
      },
      {
        id: 'thermal',
        name: 'Thermal Anomalies',
        icon: '🌡️',
        gibsLayer: 'VIIRS_NOAA20_Thermal_Anomalies_375m_Day',
        format: 'png',
        description: 'High-resolution fire and hotspot detection.',
        type: 'overlay',
        basePair: 'true_color',
        usecase: 'Wildfire'
      }
    ]
  },
  {
    id: 'viirs_snpp',
    name: 'VIIRS Suomi NPP',
    agency: 'NASA/NOAA',
    iconClass: 'sat-icon-viirs',
    description: 'Daily, 375m, operational since Jan 2012. Longer historical record.',
    revisit: 'Daily',
    resolution: '375m',
    startDate: '2012-01-01',
    coverage: 'Global',
    layers: [
      {
        id: 'true_color',
        name: 'True Color',
        icon: '🌍',
        gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
        format: 'jpeg',
        description: 'Natural color imagery.',
        type: 'base',
        usecase: 'General'
      },
      {
        id: 'false_color',
        name: 'False Color (Fire)',
        icon: '🔥',
        gibsLayer: 'VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1',
        format: 'jpeg',
        description: 'Fire and burn scar enhanced visualization.',
        type: 'analysis',
        usecase: 'Fire'
      },
      {
        id: 'night',
        name: 'Night Lights (DNB)',
        icon: '🌙',
        gibsLayer: 'VIIRS_SNPP_DayNightBand_ENCC',
        format: 'png',
        description: 'Nighttime lights for power outage detection.',
        type: 'analysis',
        usecase: 'Power outage'
      },
      {
        id: 'thermal',
        name: 'Thermal Anomalies',
        icon: '🌡️',
        gibsLayer: 'VIIRS_SNPP_Thermal_Anomalies_375m_Day',
        format: 'png',
        description: 'Fire hotspot detection.',
        type: 'overlay',
        basePair: 'true_color',
        usecase: 'Wildfire'
      }
    ]
  },
  {
    id: 'goes_east',
    name: 'GOES-East',
    agency: 'NOAA',
    iconClass: 'sat-icon-goes',
    description: 'Near real-time geostationary, 1-2km. Covers Americas & Atlantic.',
    revisit: '10 min',
    resolution: '1-2km',
    startDate: '2019-01-01',
    coverage: 'Americas, Atlantic',
    geostationary: true,
    layers: [
      {
        id: 'geocolor',
        name: 'GeoColor',
        icon: '🌎',
        gibsLayer: 'GOES-East_ABI_GeoColor',
        format: 'jpeg',
        description: 'True color daytime, city lights at night. Best all-purpose GOES layer.',
        type: 'base',
        usecase: 'General, Hurricane'
      },
      {
        id: 'visible',
        name: 'Visible (High Res)',
        icon: '👁️',
        gibsLayer: 'GOES-East_ABI_Band2_Red_Visible_1km',
        format: 'jpeg',
        description: '1km visible channel showing cloud structure details.',
        type: 'base',
        usecase: 'Hurricane, Storms'
      },
      {
        id: 'fire',
        name: 'Fire Temperature',
        icon: '🔥',
        gibsLayer: 'GOES-East_ABI_Fire_Temperature_RGB',
        format: 'jpeg',
        description: 'Enhanced RGB composite highlighting fire temperatures.',
        type: 'analysis',
        usecase: 'Wildfire'
      }
    ]
  },
  {
    id: 'goes_west',
    name: 'GOES-West',
    agency: 'NOAA',
    iconClass: 'sat-icon-goes',
    description: 'Near real-time geostationary, 1-2km. Covers Pacific & Western Americas.',
    revisit: '10 min',
    resolution: '1-2km',
    startDate: '2019-01-01',
    coverage: 'Pacific, West Americas',
    geostationary: true,
    layers: [
      {
        id: 'geocolor',
        name: 'GeoColor',
        icon: '🌏',
        gibsLayer: 'GOES-West_ABI_GeoColor',
        format: 'jpeg',
        description: 'True color daytime, city lights at night.',
        type: 'base',
        usecase: 'General, Typhoon'
      },
      {
        id: 'visible',
        name: 'Visible (High Res)',
        icon: '👁️',
        gibsLayer: 'GOES-West_ABI_Band2_Red_Visible_1km',
        format: 'jpeg',
        description: '1km visible channel.',
        type: 'base',
        usecase: 'Hurricane, Storms'
      },
      {
        id: 'fire',
        name: 'Fire Temperature',
        icon: '🔥',
        gibsLayer: 'GOES-West_ABI_Fire_Temperature_RGB',
        format: 'jpeg',
        description: 'Fire temperature RGB composite.',
        type: 'analysis',
        usecase: 'Wildfire'
      }
    ]
  },
  {
    id: 'esri_wayback',
    name: 'Imagery Archive',
    agency: 'ESRI Wayback',
    iconClass: 'sat-icon-esri',
    description: 'Dated snapshots of high-resolution satellite imagery (~0.5m). Archive of imagery updates since Feb 2014. Shows actual changes between dates.',
    revisit: 'Snapshots',
    resolution: '~0.5m',
    startDate: '2014-02-20',
    coverage: 'Global',
    provider: 'wayback',
    layers: [
      {
        id: 'world_imagery',
        name: 'True Color',
        icon: '🗃️',
        gibsLayer: null,
        format: 'jpeg',
        description: 'Historical high-res imagery snapshots. Different dates will show actual imagery changes over time.',
        type: 'base',
        usecase: 'Before/After'
      }
    ]
  },
  {
    id: 'esri_world',
    name: 'ESRI World Imagery',
    agency: 'ESRI/Maxar',
    iconClass: 'sat-icon-esri',
    description: 'Sub-meter commercial imagery via ESRI ArcGIS. Current imagery, not date-specific.',
    revisit: 'Current',
    resolution: '~0.5m',
    startDate: null,
    coverage: 'Global',
    provider: 'esri',
    liveOnly: true,
    layers: [
      {
        id: 'world_imagery',
        name: 'World Imagery',
        icon: '🌍',
        gibsLayer: null,
        format: 'jpeg',
        description: 'High-resolution imagery from Maxar & Earthstar Geographics via ESRI ArcGIS.',
        type: 'base',
        usecase: 'High-res reference'
      }
    ]
  },
  {
    id: 'google_satellite',
    name: 'Google Satellite',
    agency: 'Google',
    iconClass: 'sat-icon-google',
    description: 'Google Maps satellite imagery. Current imagery only, not date-specific.',
    revisit: 'Current',
    resolution: '~0.5m',
    startDate: null,
    coverage: 'Global',
    provider: 'google',
    liveOnly: true,
    layers: [
      {
        id: 'satellite',
        name: 'Satellite',
        icon: '🛰️',
        gibsLayer: null,
        format: 'jpeg',
        description: 'High-resolution Google satellite imagery. Shows most recent available imagery for the area.',
        type: 'base',
        usecase: 'High-res reference'
      }
    ]
  }
];

const DISASTER_PRESETS = {
  flood: {
    name: 'Flood Disaster',
    satellite: 'esri_wayback',
    layer: 'world_imagery',
    color: '#4a9eff',
    timelineSlots: [
      { label: 'Pre-Flood: 30 Days', daysOffset: -30 },
      { label: 'Pre-Flood: 7 Days',  daysOffset: -7  },
      { label: 'Flood Peak',          daysOffset:  0  },
      { label: 'Recovery: 1 Week',   daysOffset:  7  },
      { label: 'Recovery: 1 Month',  daysOffset:  30 },
      { label: 'Recovery: 3 Months', daysOffset:  90 }
    ]
  },
  wildfire: {
    name: 'Wildfire',
    satellite: 'viirs_noaa20',
    layer: 'false_color',
    color: '#ff6b35',
    timelineSlots: [
      { label: 'Pre-Fire: 2 Weeks',   daysOffset: -14 },
      { label: 'Fire Ignition',        daysOffset:  0  },
      { label: 'Fire Peak',            daysOffset:  3  },
      { label: 'Post-Fire: 2 Weeks',  daysOffset:  14 },
      { label: 'Recovery: 1 Month',   daysOffset:  30 },
      { label: 'Recovery: 6 Months',  daysOffset: 180 }
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
      { label: 'Recovery: 1 Month',  daysOffset:   30 },
      { label: 'Recovery: 1 Year',   daysOffset:  365 }
    ]
  },
  hurricane: {
    name: 'Hurricane / Typhoon',
    satellite: 'goes_east',
    layer: 'geocolor',
    color: '#9b59b6',
    timelineSlots: [
      { label: 'Pre-Storm: 1 Week',    daysOffset: -7  },
      { label: 'Storm Approach: 2 Days', daysOffset: -2 },
      { label: 'Landfall',              daysOffset:  0  },
      { label: 'Post-Storm: 3 Days',   daysOffset:  3  },
      { label: 'Recovery: 1 Month',    daysOffset:  30 },
      { label: 'Recovery: 6 Months',   daysOffset: 180 }
    ]
  }
};
