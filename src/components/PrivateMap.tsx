import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  zoom?: number;
  /** Pixel height. Width is always 100%. */
  height?: number;
  /** Optional marker label */
  label?: string;
  className?: string;
}

/**
 * Privacy-respecting map embed. Uses Leaflet + OpenStreetMap tiles instead
 * of Google Maps iframes, so coordinates are NOT sent to Google as third
 * party (RGPD/AEPD compliance). Replaces the previous
 * https://maps.google.com/maps?q=...&output=embed pattern.
 */
export function PrivateMap({
  lat,
  lng,
  zoom = 16,
  height = 220,
  label,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([lat, lng]).addTo(map);
      if (label) marker.bindPopup(label);
      mapRef.current = map;
    } else {
      mapRef.current.setView([lat, lng], zoom);
    }

    return () => {
      // we keep the map alive across re-renders; only destroy on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`rounded-md overflow-hidden border ${className || ""}`}
      style={{ width: "100%", height }}
    />
  );
}

export default PrivateMap;
