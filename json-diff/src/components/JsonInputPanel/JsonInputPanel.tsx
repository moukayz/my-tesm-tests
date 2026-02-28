import styles from './JsonInputPanel.module.css';

interface JsonInputPanelProps {
  side: 'left' | 'right';
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}

export function JsonInputPanel({ side, value, error, onChange }: JsonInputPanelProps) {
  const label = side === 'left' ? 'Left (Original)' : 'Right (Modified)';
  const ariaLabel = side === 'left' ? 'Left JSON input' : 'Right JSON input';
  const errorId = `panel-${side}-error`;

  return (
    <div className={`${styles.panel} ${styles[`panel--${side}`]}`}>
      <label className={styles.label} htmlFor={`panel-${side}-input`}>
        {label}
      </label>
      <textarea
        id={`panel-${side}-input`}
        className={`${styles.textarea} ${error ? styles['textarea--error'] : ''}`}
        aria-label={ariaLabel}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Paste ${side === 'left' ? 'original' : 'modified'} JSON here...`}
      />
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
