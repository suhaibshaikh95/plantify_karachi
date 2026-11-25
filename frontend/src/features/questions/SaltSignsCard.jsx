// Question 1: four yes/no salt signs. Unanswered signs stay null ("not sure").
import { SALT_SIGNS } from '../../constants/questions';
import ToggleChip from '../../components/ui/ToggleChip';
import styles from './SaltSignsCard.module.css';

export default function SaltSignsCard({ values, onChange }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>1. Signs of salt</legend>
      <p className={styles.hint}>Tap again to clear an answer if you are not sure.</p>
      <div className={styles.card}>
        {SALT_SIGNS.map((sign) => {
          const v = sign.key in values ? values[sign.key] : null;
          const toggle = (next) => onChange(sign.key, v === next ? null : next);
          return (
            <div key={sign.key} className={styles.row}>
              <span id={`sign-${sign.key}`}>{sign.label}</span>
              <div className={styles.buttons} role="group" aria-labelledby={`sign-${sign.key}`}>
                <ToggleChip size="sm" pressed={v === true} onClick={() => toggle(true)}>
                  Yes
                </ToggleChip>
                <ToggleChip size="sm" pressed={v === false} onClick={() => toggle(false)}>
                  No
                </ToggleChip>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
