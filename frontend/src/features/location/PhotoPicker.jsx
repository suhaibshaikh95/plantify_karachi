// Photo of the plot: pick or take a picture, preview it, and report GPS found inside it.
import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { readPhotoGps } from '../../utils/exif';
import styles from './PhotoPicker.module.css';

/**
 * onPhoto({ name, gps }) is called after a photo is chosen; gps is { lat, lon } or null.
 * `photo` is the saved { name, hasGps } (the preview is only kept while the page is open).
 */
export default function PhotoPicker({ photo, onPhoto }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const gps = await readPhotoGps(file);
    onPhoto({ name: file.name, gps });
    e.target.value = '';
  }

  return (
    <div className={styles.photo}>
      {preview ? (
        <img src={preview} alt="Your plot" className={styles.image} onError={() => setPreview(null)} />
      ) : (
        <button type="button" className={styles.empty} onClick={() => inputRef.current?.click()}>
          <span className={styles.emptyIcon}>
            <Icon name="camera" size={26} />
          </span>
          <span className={styles.emptyTitle}>{photo ? 'Add the photo again to see it' : 'Add a photo of the land'}</span>
          <span className={styles.emptyText}>Take one now or choose from your gallery</span>
        </button>
      )}

      {photo && (
        <div className={styles.chips}>
          <span className={styles.chip}>{photo.name}</span>
          <span className={`${styles.chip} ${photo.hasGps ? styles.ok : ''}`}>
            {photo.hasGps ? 'GPS found in photo' : 'No GPS in photo'}
          </span>
        </div>
      )}
      {preview && (
        <button type="button" className={styles.replace} onClick={() => inputRef.current?.click()}>
          Replace
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="visually-hidden" onChange={handleChange} aria-label="Photo of the land" tabIndex={-1} />
    </div>
  );
}
