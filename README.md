# Seasonal

A lightweight seasonal anime tracker built with plain HTML, CSS, and JavaScript. It pulls current and upcoming anime from the [Jikan API](https://docs.api.jikan.moe/) and stores your watchlist locally in the browser.

## Features

- Browse current and upcoming seasonal anime
- Search, filter by genre, and sort by score, popularity, or episode count
- Switch between card and compact views
- View anime details, trailers, and aired episodes
- Track titles as watching, completed, or planned
- Toggle dark/light theme and Romaji/English titles

## Run Locally

No install or API key is required. Start any static file server from the project root:

```powershell
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Project Structure

```text
index.html       App markup
css/style.css    Responsive styles and themes
js/api.js        Jikan API requests
js/storage.js    localStorage persistence
js/ui.js         Cards, filters, and modal rendering
js/app.js        App state and event handling
assets/          Logo files
```

## Notes

Watchlist entries and UI preferences are saved in `localStorage`, so they stay in the current browser and are not synced between devices. Anime data comes from the public Jikan API, which may occasionally rate-limit requests.
