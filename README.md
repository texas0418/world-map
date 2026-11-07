# My World Travels

A turning globe of the countries and cities you have been to. Tap the globe and it unrolls into a flat map you can zoom and drag. See it live at https://travels.simonbuilds.app

It runs in the browser with no build step, no libraries and no account, and you can set up your own copy using only the GitHub website.

## Build Your Own Map

### 1. Copy This Repo

Sign in to GitHub, open this repo and click **Fork**, then **Create fork**. You now have your own copy to change.

### 2. Add Your Places

In your fork, open `data/places.json` and click the pencil icon to edit it. The file looks like this:

    {
    "visitedCountries": ["840", "826", "392"],
    "places": [
    {"name": "Atlanta", "lat": 33.749, "lon": -84.388},
    {"name": "Aberdeen", "lat": 57.15, "lon": -2.094},
    {"name": "Tokyo", "lat": 35.676, "lon": 139.65, "note": "First trip abroad"}
    ]
    }

Delete the places that are there and put in your own.

- **`places`** is one pin per place. `name`, `lat` and `lon` are required, and `note` is optional text shown when someone taps the pin.
- **`visitedCountries`** is the list of countries to color gold. Look up each code in `data/country-codes.txt` and keep the quotes and any leading zeros, so Belgium is `"056"`. The countries in this list are what the Countries number counts.

Pins do not color a country by themselves, so a new country needs both a pin and a code.

**Finding coordinates:** on a computer, open Google Maps and right-click the place. The latitude and longitude are at the top of the menu, latitude first. Click them to copy.

**Check your commas:** every line inside `places` ends with a comma except the last one. A missing or extra comma stops the map from loading. If the page stays on an error, look there first.

When you finish, click **Commit changes**.

### 3. Put It Online

In your fork, go to **Settings**, then **Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the `main` branch and the `/ (root)` folder, then click **Save**.

After a few minutes your map is at `https://YOUR-USERNAME.github.io/world-map/`. Anyone with that address can see your places and notes, so leave out home addresses and anything private.

### 4. Add More Places Later

Edit `data/places.json` again and commit. Your site updates by itself within a few minutes.

## Change the Title

The title appears twice in `index.html`: once in `<title>` and once in `<h1>`. Edit both.

## Controls

- **Open the flat map:** tap or click the globe, or press Enter
- **Back to the globe:** the Back to Globe button, or press Esc
- **Zoom:** scroll, pinch, the + and - buttons, or the + and - keys. City names appear as you zoom in
- **Move around:** drag, or use the arrow keys
- **Full screen:** the Full Screen button, or press F

## Run It on Your Computer

If you have Python 3, run this inside the folder and open http://localhost:8765:

    python3 -m http.server 8765

Opening `index.html` directly from your files will not work, because browsers block the map data that way.

## Known Limits

- Your browser needs WebGL 2, which current versions of Chrome, Safari, Firefox and Edge support.
- Kosovo, Northern Cyprus, Somaliland, Siachen Glacier and the Indian Ocean Territories have no code in the border data, so they cannot be colored yet. You can still add pins there.
- The terrain goes soft at the deepest zoom.

## Credits

Terrain and borders come from Natural Earth (public domain), with borders packaged by the world-atlas project.

## License

The code is under the MIT License. See `LICENSE`.
