// One recommended plant: photo, name, score, reason, tags, and an expandable "Why this score".
import Icon from '../../components/ui/Icon';
import ScoreRing from './ScoreRing';
import PlantPhoto from './PlantPhoto';
import styles from './PlantCard.module.css';

const FORM_LABEL = { tree: 'Tree', shrub: 'Shrub', palm: 'Palm' };

export default function PlantCard({ plant, rank }) {
  const photo = plant.image;
  const hasDetails = plant.score_breakdown?.length > 0 || plant.notes?.length > 0 || photo?.credit;

  return (
    <details className={styles.card} style={{ '--i': rank }}>
      <summary className={styles.summary}>
        <PlantPhoto plant={plant} photo={photo} className={styles.photo} />
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <div className={styles.names}>
              <h3 className={styles.name}>{plant.common_name}</h3>
              <p className={styles.latin}>
                {FORM_LABEL[plant.form] && (
                  <>
                    <span className={styles.form}>
                      <Icon name={plant.form} size={14} />
                      {FORM_LABEL[plant.form]}
                    </span>
                    {' · '}
                  </>
                )}
                <i>{plant.scientific_name}</i>
              </p>
            </div>
            <ScoreRing score={plant.score} highlight={rank < 3} />
          </div>
          {plant.summary && <p className={styles.summaryText}>{plant.summary}</p>}
          {plant.tags?.length > 0 && (
            <ul className={styles.tags}>
              {plant.tags.map((t) => (
                <li key={t} className={styles.tag}>
                  {t}
                </li>
              ))}
            </ul>
          )}
          {hasDetails && (
            <span className={styles.more}>
              Why this score <Icon name="chevronDown" size={16} className={styles.chev} />
            </span>
          )}
        </div>
      </summary>

      {hasDetails && (
        <div className={styles.details}>
          {plant.score_breakdown?.map((b) => {
            const pct = Math.round(Math.max(0, Math.min(1, b.value)) * 100);
            return (
              <div key={b.label} className={styles.bar}>
                <span>{b.label}</span>
                <span className={styles.track}>
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className={styles.pct}>{pct}%</span>
              </div>
            );
          })}
          {plant.notes?.map((n) => (
            <p key={n} className={styles.note}>
              {n}
            </p>
          ))}
          {photo?.credit && (
            <p className={styles.credit}>
              Photo:{' '}
              {photo.source_url ? (
                <a href={photo.source_url} target="_blank" rel="noopener noreferrer">
                  {photo.credit}
                </a>
              ) : (
                photo.credit
              )}
              {photo.license ? `, ${photo.license}` : ''}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
