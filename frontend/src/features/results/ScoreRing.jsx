// Circular gauge for a 0–100 suitability score.
import styles from './ScoreRing.module.css';

const R = 20;
const C = 2 * Math.PI * R;

export default function ScoreRing({ score, highlight = false }) {
  const v = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  return (
    <div className={`${styles.ring} ${highlight ? styles.highlight : ''}`} role="img" aria-label={`Suitability ${v} out of 100`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className={styles.track} cx="24" cy="24" r={R} />
        <circle
          className={styles.fill}
          cx="24"
          cy="24"
          r={R}
          strokeDasharray={C.toFixed(1)}
          style={{ '--len': C.toFixed(1), '--off': (C * (1 - v / 100)).toFixed(1) }}
        />
      </svg>
      <span className={styles.value}>{v}</span>
    </div>
  );
}
