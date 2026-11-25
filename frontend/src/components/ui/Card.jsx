// Rounded white surface with a soft border and shadow. `glass` adds a frosted look.
import styles from './Card.module.css';

export default function Card({ as: Tag = 'div', glass = false, padded = true, className = '', children, ...props }) {
  const cls = [styles.card, glass ? styles.glass : '', padded ? styles.padded : '', className].join(' ');
  return (
    <Tag className={cls} {...props}>
      {children}
    </Tag>
  );
}
