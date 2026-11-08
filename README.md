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
    "visitedStates": ["Georgia", "Texas"],
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
- **`visitedStates`** (optional) is the list of US states to color gold, using full names like `"Texas"`. A state counts toward the 50 only if it is listed here, and `"District of Columbia"` colors DC without counting. Leave this list out and the whole US colors gold when `"840"` is in `visitedCountries`.

**Finding coordinates:** on a computer, open Google Maps and right-click the place. The latitude and longitude are at the top of the menu, latitude first. Click them to copy.

**Check your commas:** every line inside `places` ends with a comma except the last one. A missing or extra comma stops the map from loading. If the page stays on an error, look there first.

When you finish, click **Commit changes**.

**The easy way:** once your map is running, tap **+ Add Places** to search for a city, drop a pin or import a Google My Maps file (KMZ or KML). Countries and US states color themselves, and **Privacy** moves a pin to the nearest city so visitors do not see the exact spot. These changes save only in that browser. To publish them, tap **Download Map File** and use that file to replace `data/places.json`. Hiding a pin only protects it once you publish that file, and your repo's old commits still hold earlier versions.

### 3. Put It Online

In your fork, go to **Settings**, then **Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the `main` branch and the `/ (root)` folder, then click **Save**.

After a few minutes your map is at `https://YOUR-USERNAME.github.io/world-map/`. Anyone with that address can see your places and notes, so leave out home addresses and anything private.

### 4. Add More Places Later

Edit `data/places.json` again and commit. Your site updates by itself within a few minutes.

The counts on the map show how many you have left, out of 195 countries and 50 states. To use a different country total, change `COUNTRIES` at the top of `app/main.js`.

## More Things You Can Do

Under **+ Add Places**, the **Pins** tab lets you give any pin a note, category, date, trip name or photos, or mark it Want to Go. Want to Go pins show as hollow rings and do not count toward your totals. Photos stay in that browser and are never put in the map file or a share link.

The **Options** button has:

- **Replay:** pins light up in date order, then list order for pins with no date
- **Day and Night:** real sunlight right now, with city lights on the dark side
- **Flight Arcs:** lines between pins that share a trip name, in date order
- **Provinces:** colors only the regions with a pin in countries you have visited
- **Ambient Music:** made in your browser, with no audio files
- **Color Theme** and **Show Pins** filters
- **Poster:** a 4K image of the current view
- **Share Link:** a read-only copy of your map inside the link itself

## Change the Title

The title appears twice in `index.html`: once in `<title>` and once in `<h1>`. Edit both.

## Controls

- **Open the flat map:** tap or click the globe, or press Enter
- **Back to the globe:** the Back to Globe button, or press Esc
- **Zoom:** scroll, pinch, the + and - buttons, or the + and - keys. City names appear as you zoom in
- **Move around:** drag, or use the arrow keys
- **Stats:** the Stats button shows your farthest points, how much you have seen and the badges you have earned
- **Full screen:** the Full Screen button, or press F

## Run It on Your Computer

If you have Python 3, run this inside the folder and open http://localhost:8765:

    python3 -m http.server 8765

Opening `index.html` directly from your files will not work, because browsers block the map data that way.

## Known Limits

- Your browser needs WebGL 2, which current versions of Chrome, Safari, Firefox and Edge support.
- Kosovo, Northern Cyprus, Somaliland, Siachen Glacier and the Indian Ocean Territories have no code in the border data, so they cannot be colored yet. You can still add pins there.
- The terrain goes soft at the deepest zoom.
- City search covers about 7,300 world cities from Natural Earth. Use Drop Pin for anything else.

## Credits

Terrain and borders come from Natural Earth (public domain), with borders packaged by the world-atlas project. City lights come from NASA Earth Observatory (Black Marble 2016).

## License

The code is under the MIT License. See `LICENSE`.
