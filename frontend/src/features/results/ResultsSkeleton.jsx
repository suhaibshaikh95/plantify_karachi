// Shimmering placeholder shown while /api/recommend is running.
import styles from './ResultsSkeleton.module.css';

export default function ResultsSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true" aria-live="polite">
      <div className={styles.side}>
        <div className={`${styles.sk} ${styles.title}`} />
        <div className={`${styles.sk} ${styles.line}`} />
        <div className={`${styles.sk} ${styles.card}`} />
      </div>
      <div>
        <div className={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${styles.sk} ${styles.plant}`} />
          ))}
        </div>
        <p className={styles.text}>Checking plants against your site…</p>
      </div>
    </div>
  );
}
