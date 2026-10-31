const styles = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
  bright: "https://tiles.openfreemap.org/styles/bright",
  "3d": "https://tiles.openfreemap.org/styles/3d"
};

let currentStyle = "liberty";
let userMarker = null;
let destinationMarker = null;
let watchId = null;
let routeLayerAdded = false;

const statusEl = document.getElementById("searchStatus");
const gpsEl = document.getElementById("gpsStatus");
const coordsEl = document.getElementById("coordinates");
const resultsEl = document.getElementById("results");

const map = new maplibregl.Map({
  container: "map",
  style: styles[currentStyle],
  center: [77.5946, 12.9716], // Initial view: Bengaluru
  zoom: 11,
  pitch: 35,
  bearing: -12,
  attributionControl: true
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
map.addControl(new maplibregl.ScaleControl(), "bottom-left");

map.on("load", () => {
  statusEl.textContent = "Map loaded. Enable GPS to find your position.";
  startGPS();
});

function setStatus(message) { statusEl.textContent = message; }

function startGPS() {
  if (!("geolocation" in navigator)) {
    gpsEl.textContent = "GPS: NOT SUPPORTED";
    setStatus("This browser does not support location.");
    return;
  }
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(position => {
    const { latitude, longitude, accuracy } = position.coords;
    const point = [longitude, latitude];
    gpsEl.textContent = `GPS: ACTIVE · ±${Math.round(accuracy)}M`;
    coordsEl.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    if (!userMarker) {
      const el = document.createElement("div");
      el.className = "player-marker";
      el.innerHTML = '<span></span>';
      userMarker = new maplibregl.Marker({ element: el }).setLngLat(point).addTo(map);
      map.flyTo({ center: point, zoom: 15, pitch: 50, essential: true });
    } else {
      userMarker.setLngLat(point);
    }
  }, error => {
    gpsEl.textContent = "GPS: PERMISSION NEEDED";
    const messages = {
      1: "Location permission was denied. Allow location access in your browser settings.",
      2: "Your location is currently unavailable. Try again outdoors.",
      3: "Location request timed out. Try again."
    };
    setStatus(messages[error.code] || "Unable to get your location.");
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
}

document.getElementById("locateButton").addEventListener("click", () => {
  if (userMarker) {
    map.flyTo({ center: userMarker.getLngLat(), zoom: 16, pitch: 55, essential: true });
    setStatus("Showing your current position.");
  } else {
    startGPS();
    setStatus("Requesting your phone's location permission…");
  }
});

document.getElementById("themeButton").addEventListener("click", () => {
  const drawer = document.getElementById("themeDrawer");
  drawer.hidden = !drawer.hidden;
});
document.querySelectorAll("[data-style]").forEach(button => {
  button.addEventListener("click", () => {
    currentStyle = button.dataset.style;
    map.setStyle(styles[currentStyle]);
    document.getElementById("themeDrawer").hidden = true;
    setStatus(`Theme changed: ${button.textContent}.`);
  });
});

async function searchPlace(query) {
  // Photon is a public community geocoder. Use only for deliberate, user-submitted searches;
  // do not turn this into autocomplete or high-volume automated geocoding.
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Search service is unavailable.");
  const data = await response.json();
  return (data.features || []).map(feature => ({
    name: [feature.properties.name, feature.properties.city, feature.properties.country]
      .filter(Boolean).join(", "),
    coordinates: feature.geometry.coordinates
  }));
}

document.getElementById("searchForm").addEventListener("submit", async event => {
  event.preventDefault();
  const query = document.getElementById("destination").value.trim();
  if (!query) return;
  resultsEl.replaceChildren();
  setStatus("Searching destination…");
  try {
    const places = await searchPlace(query);
    if (!places.length) { setStatus("No results found. Try a nearby landmark or full address."); return; }
    setStatus("Choose your destination:");
    places.forEach(place => {
      const button = document.createElement("button");
      button.className = "result";
      button.textContent = place.name || "Unnamed place";
      button.addEventListener("click", () => chooseDestination(place));
      resultsEl.appendChild(button);
    });
  } catch (error) {
    setStatus(`${error.message} Try again later.`);
  }
});

async function chooseDestination(place) {
  resultsEl.replaceChildren();
  const [lon, lat] = place.coordinates;
  if (destinationMarker) destinationMarker.remove();
  destinationMarker = new maplibregl.Marker({ color: "#ff4b5c" })
    .setLngLat([lon, lat]).setPopup(new maplibregl.Popup().setText(place.name)).addTo(map);
  map.flyTo({ center: [lon, lat], zoom: 14, pitch: 45, essential: true });
  setStatus("Calculating driving route…");
  await drawRoute(place.coordinates);
}

async function drawRoute(destination) {
  if (!userMarker) {
    setStatus("Enable GPS first so we can calculate a route from your position.");
    return;
  }
  const origin = userMarker.getLngLat();
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination[0]},${destination[1]}?overview=full&geometries=geojson&steps=true`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Routing service unavailable.");
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("No driving route found.");
    const route = data.routes[0];
    const feature = { type: "Feature", properties: {}, geometry: route.geometry };
    if (map.getSource("game-route")) {
      map.getSource("game-route").setData(feature);
    } else {
      map.addSource("game-route", { type: "geojson", data: feature });
      map.addLayer({
        id: "game-route-glow", type: "line", source: "game-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#b8ff3b", "line-width": 10, "line-opacity": 0.25, "line-blur": 3 }
      });
      map.addLayer({
        id: "game-route-line", type: "line", source: "game-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#caff55", "line-width": 5 }
      });
    }
    const bounds = new maplibregl.LngLatBounds();
    route.geometry.coordinates.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, { padding: { top: 130, bottom: 100, left: 45, right: 45 }, duration: 900 });
    const km = (route.distance / 1000).toFixed(1);
    const mins = Math.round(route.duration / 60);
    setStatus(`Route ready · ${km} km · about ${mins} min. Follow road signs and local traffic rules.`);
  } catch (error) {
    setStatus(`${error.message} This prototype uses a public demo routing server.`);
  }
}

document.getElementById("clearRouteButton").addEventListener("click", () => {
  if (map.getLayer("game-route-line")) map.removeLayer("game-route-line");
  if (map.getLayer("game-route-glow")) map.removeLayer("game-route-glow");
  if (map.getSource("game-route")) map.removeSource("game-route");
  if (destinationMarker) { destinationMarker.remove(); destinationMarker = null; }
  setStatus("Route cleared.");
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
