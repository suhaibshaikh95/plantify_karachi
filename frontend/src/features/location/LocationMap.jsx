// Map of Karachi with a draggable pin. In "move" mode a tap on the map moves the pin.
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_DEFAULT } from '../../config/env';
import styles from './LocationMap.module.css';

const pinIcon = L.divIcon({
  className: styles.pinIcon,
  iconSize: [36, 44],
  iconAnchor: [18, 43],
  html: `<svg width="36" height="44" viewBox="0 0 24 30" aria-hidden="true">
    <path d="M12 29s9-9.5 9-17A9 9 0 0 0 3 12c0 7.5 9 17 9 17z" fill="#2E6B45"/>
    <circle cx="12" cy="12" r="3.5" fill="#fff"/></svg>`,
});

function FollowPoint({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lon], Math.max(map.getZoom(), 14), { animate: true });
  }, [map, point?.lat, point?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickToMove({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMap({ point, moving, onPick }) {
  return (
    <div className={`${styles.map} ${moving ? styles.moving : ''}`}>
      <MapContainer
        center={point ? [point.lat, point.lon] : [MAP_DEFAULT.lat, MAP_DEFAULT.lon]}
        zoom={point ? 14 : MAP_DEFAULT.zoom}
        minZoom={9}
        zoomControl={false}
        scrollWheelZoom={false}
        className={styles.leaflet}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={18} />
        <FollowPoint point={point} />
        <ClickToMove enabled={moving} onPick={onPick} />
        {point && (
          <Marker
            position={[point.lat, point.lon]}
            icon={pinIcon}
            draggable
            title="Your plot"
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onPick(p.lat, p.lng);
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
