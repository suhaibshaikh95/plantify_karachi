// One multiple-choice question rendered as a row of pill buttons. `value` is the selected option id.
import ToggleChip from '../../components/ui/ToggleChip';
import styles from './ChoiceQuestion.module.css';

export default function ChoiceQuestion({ question, value, onChange, missing = false }) {
  const { key, number, title, options, required } = question;
  return (
    <fieldset className={`${styles.fieldset} ${missing ? styles.missing : ''}`} id={`q-${key}`}>
      <legend className={styles.legend}>
        {number}. {title}
        {!required && <span className={styles.optional}> (optional)</span>}
      </legend>
      <div className={styles.options}>
        {options.map((opt) => (
          <ToggleChip key={opt.id} pressed={value === opt.id} onClick={() => onChange(key, opt.id)}>
            {opt.label}
          </ToggleChip>
        ))}
      </div>
      {missing && <p className={styles.error}>Please choose one.</p>}
    </fieldset>
  );
}
