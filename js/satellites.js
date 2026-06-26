// Single imagery source — ESRI Wayback archive.
// High-resolution (~0.5m), true color, historical archive from Feb 2014 onward.
const SATELLITES = [
  {
    id: 'esri_wayback',
    name: 'World Imagery Archive',
    agency: 'ESRI Wayback',
    description: 'Dated snapshots of high-resolution commercial imagery (~0.5m). Covers Feb 2014 onward.',
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
        description: 'High-resolution true color imagery from the ESRI Wayback archive.',
        type: 'base',
        usecase: 'Historical'
      }
    ]
  }
];
