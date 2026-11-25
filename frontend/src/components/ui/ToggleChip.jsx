// A pill button that can be on or off (aria-pressed). Used for answers and filters.
import styles from './ToggleChip.module.css';

export default function ToggleChip({ pressed, onClick, size = 'md', tone = 'solid', children, ...props }) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles[size]} ${styles[tone]}`}
      aria-pressed={pressed}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
