// "Step 1 of 3" progress bar with step names.
import styles from './StepProgress.module.css';

const STEPS = ['Your plot', 'Site questions', 'Your plants'];

export default function StepProgress({ current }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.label}>
        Step {current} of {STEPS.length}
      </p>
      <ol className={styles.steps} aria-label={`Step ${current} of ${STEPS.length}`}>
        {STEPS.map((name, i) => {
          const n = i + 1;
          const state = n < current ? 'done' : n === current ? 'current' : 'todo';
          return (
            <li key={name} className={`${styles.step} ${styles[state]}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className={styles.bar} />
              <span className={styles.name}>{name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
