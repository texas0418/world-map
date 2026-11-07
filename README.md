# My World Travels

A turning globe of the countries and cities I have been to. Tap the globe and it unrolls into a flat map you can zoom and drag.

Runs in the browser with WebGL 2. No build step and no libraries.

## Run It

    python3 -m http.server 8765

Then open http://localhost:8765.

## Your Own Places

Edit `data/places.json`. `visitedCountries` holds ISO numeric country codes, and each entry in `places` has a `name`, `lat`, `lon` and an optional `note`.

## Credits

Terrain and borders come from Natural Earth (public domain), by way of the world-atlas package.
