// Site facts returned by the backend (salinity, soil, texture, temperature) and any notes.
import Card from '../../components/ui/Card';
import styles from './SiteSummary.module.css';

export default function SiteSummary({ site }) {
  if (!site) return null;
  return (
    <>
      {site.stats?.length > 0 && (
        <Card className={styles.stats} padded={false}>
          {site.stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.value}>{s.value}</span>
              <span className={styles.label}>{s.label}</span>
            </div>
          ))}
        </Card>
      )}
      {site.notes?.map((n) => (
        <p key={n} className={styles.note}>
          {n}
        </p>
      ))}
    </>
  );
}
