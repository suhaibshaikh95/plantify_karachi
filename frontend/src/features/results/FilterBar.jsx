// Filter chips (Native, Low water, …). Shown only when the backend sends plant traits.
import { RESULT_FILTERS } from '../../constants/questions';
import ToggleChip from '../../components/ui/ToggleChip';
import styles from './FilterBar.module.css';

export default function FilterBar({ active, onToggle }) {
  return (
    <div className={styles.bar} role="group" aria-label="Filter plants">
      {RESULT_FILTERS.map((f) => (
        <ToggleChip key={f.key} size="sm" tone="soft" pressed={active.includes(f.key)} onClick={() => onToggle(f.key)}>
          {f.label}
        </ToggleChip>
      ))}
    </div>
  );
}
