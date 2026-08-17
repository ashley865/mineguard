import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SiteWeatherReading } from "../api/types";

// react-leaflet's default marker icon references relative image paths that Vite doesn't
// resolve correctly — pointing at the same package version's own CDN copy sidesteps
// bundling marker images ourselves, a standard fix for this well-known issue.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length, points.map((p) => p.join(",")).join("|")]);
  return null;
}

type LocatedReading = SiteWeatherReading & { latitude: number; longitude: number };

export default function SiteLocationMap({ sites }: { sites: SiteWeatherReading[] }) {
  const located = sites.filter((s): s is LocatedReading => s.latitude != null && s.longitude != null);
  const points = useMemo<[number, number][]>(() => located.map((s) => [s.latitude, s.longitude]), [located]);

  if (located.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden border border-white/10 h-56">
      <MapContainer center={points[0]} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitToMarkers points={points} />
        {located.map((s) => (
          <Marker key={s.siteId} position={[s.latitude, s.longitude]} icon={markerIcon}>
            <Popup>
              <div className="text-xs font-semibold text-mine-50">{s.siteName}</div>
              <div className="text-xs text-mine-300">
                {Math.round(s.weather.temperatureC)}°C · {s.weather.condition}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
