// "Not recommended here": every plant the backend ruled out, with its reason.
import Icon from '../../components/ui/Icon';
import styles from './ExcludedList.module.css';

export default function ExcludedList({ items }) {
  if (!items?.length) return null;
  return (
    <details className={styles.box} open={items.length <= 5}>
      <summary className={styles.summary}>
        <span>Not recommended here ({items.length})</span>
        <Icon name="chevronDown" size={18} className={styles.chev} />
      </summary>
      <ul className={styles.list}>
        {items.map((x) => (
          <li key={x.scientific_name} className={styles.row}>
            <span className={styles.name}>{x.common_name || x.scientific_name}</span>
            <span className={styles.reason}>{x.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
