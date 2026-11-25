// Step 1: photo of the plot and its location (photo GPS, current location, map pin or area list).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import StepProgress from '../components/ui/StepProgress';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Notice from '../components/ui/Notice';
import Icon from '../components/ui/Icon';
import PhotoPicker from '../features/location/PhotoPicker';
import LocationMap from '../features/location/LocationMap';
import AreaSelect from '../features/location/AreaSelect';
import { usePlan } from '../context/PlanContext';
import { getNearestSite } from '../services/plantifyApi';
import { ROUTES } from '../constants/routes';
import { formatCoords, siteName } from '../utils/format';
import styles from './LocationPage.module.css';

const FAR_FROM_SITE_KM = 15;

export default function LocationPage() {
  const navigate = useNavigate();
  const { plan, setPhoto, setLocation } = usePlan();
  const { location, photo } = plan;
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(null); // 'gps' | 'lookup' | null
  const [message, setMessage] = useState(null); // { tone, text }

  async function setPoint(lat, lon, source) {
    setBusy('lookup');
    setMessage(null);
    try {
      const res = await getNearestSite(lat, lon);
      setLocation({ lat, lon, source, site: res.site, distance_km: res.distance_km ?? null });
      if (res.distance_km > FAR_FROM_SITE_KM) {
        setMessage({
          tone: 'warning',
          text: `This point is ${res.distance_km} km from the nearest Karachi reference site. Plantify covers Karachi only, so check the pin.`,
        });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  async function handlePhoto({ name, gps }) {
    setPhoto({ name, hasGps: !!gps });
    if (gps) await setPoint(gps.lat, gps.lon, 'photo');
    else if (!location) setMessage({ tone: 'info', text: 'This photo has no location in it. Use your current location, drop a pin or choose your area.' });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage({ tone: 'error', text: 'Your browser cannot share its location. Choose your area from the list.' });
      return;
    }
    setBusy('gps');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint(pos.coords.latitude, pos.coords.longitude, 'gps'),
      (err) => {
        setBusy(null);
        setMessage({
          tone: 'error',
          text:
            err.code === 1
              ? 'Location permission was blocked. Allow it in your browser, or choose your area from the list.'
              : 'Could not find your location. Try again, or choose your area from the list.',
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function chooseArea(site) {
    setMessage(null);
    setLocation({ lat: site.lat, lon: site.lon, source: 'list', site, distance_km: 0 });
  }

  return (
    <div className={`container page-enter ${styles.page}`}>
      <StepProgress current={1} />
      <PageHeader backTo={ROUTES.home} title="Your plot" subtitle="A clear photo of the ground and where it is." />

      <div className={styles.grid}>
        <section aria-label="Photo of the land" className={styles.photoCol}>
          <p className={styles.label}>Photo of the land</p>
          <PhotoPicker photo={photo} onPhoto={handlePhoto} />
        </section>

        <section aria-label="Location" className={styles.placeCol}>
          <p className={styles.label}>Location</p>
          <Card padded={false} className={styles.mapCard}>
            <LocationMap point={location} moving={moving} onPick={(lat, lon) => setPoint(lat, lon, 'map')} />
            <div className={styles.place}>
              <span className={styles.placeIcon}>
                <Icon name="pin" size={18} />
              </span>
              <div className={styles.placeText} aria-live="polite">
                <p className={styles.placeName}>{location ? siteName(location.site) : 'Set your location'}</p>
                <p className={styles.placeMeta}>
                  {busy === 'lookup'
                    ? 'Finding the nearest reference site…'
                    : location
                      ? `${formatCoords(location.lat, location.lon)}${location.distance_km ? ` · ${location.distance_km} km from reference site` : ''}`
                      : 'Use a photo with GPS, your current location, or the map'}
                </p>
              </div>
              <button type="button" className={styles.moveBtn} onClick={() => setMoving((m) => !m)} aria-pressed={moving}>
                {moving ? 'Done' : 'Move pin'}
              </button>
            </div>
          </Card>
          {moving && <p className={styles.hint}>Tap the map or drag the pin to your plot.</p>}

          <div className={styles.controls}>
            <Button variant="secondary" icon="crosshair" block onClick={useCurrentLocation} loading={busy === 'gps'}>
              Use my current location
            </Button>
            <AreaSelect selectedId={location?.source === 'list' ? location.site?.site_id : null} onSelect={chooseArea} />
          </div>

          {message && (
            <Notice tone={message.tone} className={styles.message}>
              {message.text}
            </Notice>
          )}
        </section>
      </div>

      <div className={styles.footer}>
        <Button size="lg" iconRight="arrowRight" disabled={!location || busy === 'lookup'} onClick={() => navigate(ROUTES.questions)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
