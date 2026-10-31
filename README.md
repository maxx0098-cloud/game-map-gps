# GAME MAP GPS — prototype 0.1

A mobile-first PWA prototype: real map, GPS tracking, destination search, route display, and switchable map styles.

## Run locally
1. Extract the ZIP.
2. Open a terminal in this folder.
3. Run `python -m http.server 8000`
4. Open `http://localhost:8000` in your browser.

For phone GPS testing, use HTTPS hosting (or localhost on the same device). Browsers generally require a secure context for geolocation.

## Current prototype services
- MapLibre GL JS: map rendering.
- OpenFreeMap: map styles/tiles.
- Photon public geocoder: user-submitted destination search.
- OSRM public demo server: route calculation.

These public community/demo services are not a guaranteed production navigation backend. Respect each service's current usage rules and attribution. Do not send automated/high-volume searches. The app must be tested before any real-world driving use.

## Current limitations
- This is a web app/PWA prototype, not a native Android APK.
- Route line and estimated distance/time are shown, but there is no turn-by-turn voice guidance yet.
- GPS tracking depends on browser permission, device settings, HTTPS, and network/device conditions.
- The initial map view is Bengaluru; GPS recenters to the actual device location after permission.
- Map themes are separate base styles; the custom game aesthetic will be developed further.

## Next development steps
1. Test map loading and GPS on the phone.
2. Improve the game-style player marker and HUD.
3. Add turn-by-turn route steps and voice prompts.
4. Review geocoding/routing provider terms and reliability before public release.
5. Add proper app icons and offline strategy.
