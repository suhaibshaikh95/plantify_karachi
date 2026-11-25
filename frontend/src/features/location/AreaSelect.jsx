// "Or choose your area" dropdown, filled from GET /api/sites.
import { getSites } from '../../services/plantifyApi';
import { useAsync } from '../../hooks/useAsync';
import styles from './AreaSelect.module.css';

export default function AreaSelect({ selectedId, onSelect }) {
  const { status, data: sites, error, run } = useAsync(({ signal }) => getSites({ signal }), { immediate: true });

  if (status === 'error') {
    return (
      <p className={styles.error}>
        Could not load the list of areas. {error?.message}{' '}
        <button type="button" className={styles.retry} onClick={() => run()}>
          Try again
        </button>
      </p>
    );
  }

  const sorted = [...(sites || [])].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <label className={styles.wrap}>
      <span className="visually-hidden">Or choose your area</span>
      <select
        className={styles.select}
        value={selectedId ?? ''}
        disabled={status === 'loading'}
        onChange={(e) => {
          const site = sorted.find((s) => String(s.site_id) === e.target.value);
          if (site) onSelect(site);
        }}
      >
        <option value="">{status === 'loading' ? 'Loading areas…' : 'Or choose your area from the list'}</option>
        {sorted.map((s) => (
          <option key={s.site_id} value={s.site_id}>
            {s.label}
            {s.town ? ` · ${s.town}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
