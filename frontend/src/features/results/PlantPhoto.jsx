// Plant photo served by the backend. Shows a tree/shrub/palm icon until it loads (or if there is none).
import { useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon';
import styles from './PlantPhoto.module.css';

export default function PlantPhoto({ plant, photo, className = '' }) {
  const [state, setState] = useState('loading'); // loading | loaded | failed
  const form = ['tree', 'shrub', 'palm'].includes(plant.form) ? plant.form : 'tree';

  useEffect(() => {
    setState('loading');
  }, [photo?.url]);

  return (
    <div className={`${styles.photo} ${className}`}>
      <Icon name={form} size={36} strokeWidth={1.5} className={styles.icon} />
      {photo?.url && state !== 'failed' && (
        <img
          src={photo.url}
          alt={`Photo of ${plant.common_name}`}
          loading="lazy"
          decoding="async"
          className={`${styles.img} ${state === 'loaded' ? styles.loaded : ''}`}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      )}
    </div>
  );
}
