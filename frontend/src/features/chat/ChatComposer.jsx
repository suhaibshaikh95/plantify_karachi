// Suggested questions and the message input.
import { useState } from 'react';
import Icon from '../../components/ui/Icon';
import styles from './ChatComposer.module.css';

export default function ChatComposer({ suggestions, onSend, disabled }) {
  const [text, setText] = useState('');

  function submit(e) {
    e.preventDefault();
    const q = text.trim();
    if (!q || disabled) return;
    onSend(q);
    setText('');
  }

  return (
    <div className={styles.wrap}>
      {suggestions?.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((s) => (
            <button key={s} type="button" className={styles.suggestion} onClick={() => onSend(s)} disabled={disabled}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form className={styles.composer} onSubmit={submit}>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about watering, space, pests…"
          aria-label="Your question"
          autoComplete="off"
        />
        <button type="submit" className={styles.send} aria-label="Send" disabled={disabled || !text.trim()}>
          <Icon name="arrowRight" size={18} strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
