# EarthWatch — Post-Disaster Recovery Timeline

**Live site:** https://apilkc.github.io/Googleearth/

EarthWatch is a small web tool for tracing how a place recovers after a disaster, using historical satellite imagery. Pick a location, add a few key dates — before the disaster, during rebuilding, and today — and compare how the ground has changed over time, side by side or with a slider.

It's built for anyone who wants to observe recovery on their own: residents checking on their neighborhood, journalists and researchers documenting reconstruction, and local or aid organizations monitoring recovery progress across a disaster-affected area — without needing specialized GIS software.

## Features

- **Timeline comparison** — add 3–5 (or more) dates and view satellite imagery for each side by side
- **Smart date matching** — automatically finds the closest available historical image on or before the date you pick
- **Slider / side-by-side comparison** — compare any two dates directly against each other
- **Automatic best-resolution search** — traces down to the highest zoom level that has full image coverage for a given date and location, rather than settling for a gappy result
- **Zoom transparency** — each image shows the zoom level it was captured at, and flags when the historical archive couldn't match the current map zoom
- **Adjustable aspect ratio and quality** — 4:3, 16:9, or 9:16 framing, from preview to ultra-high-resolution downloads
- **Multiple basemaps** — Google Satellite, OpenStreetMap, or a dark CartoDB map for locating your area of interest
- **Export** — download individual images or the full timeline set

## How it works

EarthWatch uses the [ESRI Wayback](https://livingatlas.arcgis.com/wayback/) archive, which preserves dated snapshots of high-resolution satellite imagery (roughly 0.5m resolution) going back to February 2014. When you pick a date, the app finds the nearest dated release on or before it and stitches together the relevant map tiles into a single image, cropped and scaled to your chosen frame.

## Tech stack

Plain HTML, CSS, and JavaScript, with [Leaflet](https://leafletjs.com/) for the map. No build step, no backend — it runs entirely in the browser.

## Credits

Created by [Apil KC](https://taubmancollege.umich.edu/student/apil-kc/), who works in disaster response and recovery.

This work is also inspired by [Sagar Khanal](https://disasterdata.engin.umich.edu/team/sagar-khanal)'s work on using satellite imagery to trace recovery timelines at the [AIDD Lab](https://disasterdata.engin.umich.edu/).
