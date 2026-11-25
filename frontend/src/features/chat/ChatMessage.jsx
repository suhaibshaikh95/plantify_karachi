// One chat bubble. Assistant answers can show where they came from.
import styles from './ChatMessage.module.css';

export default function ChatMessage({ role, text, source, pending = false, error = false }) {
  const cls = [styles.bubble, role === 'user' ? styles.user : styles.assistant, pending ? styles.pending : '', error ? styles.error : ''].join(' ');
  return (
    <div className={cls}>
      {pending ? (
        <span className={styles.dots} aria-label="Thinking">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <p className={styles.text}>{text}</p>
      )}
      {source && <span className={styles.source}>From: {source}</span>}
    </div>
  );
}
