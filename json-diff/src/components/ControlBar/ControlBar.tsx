import styles from './ControlBar.module.css';

interface ControlBarProps {
  onCompare: () => void;
  onClear: () => void;
  isComparing?: boolean;
}

export function ControlBar({ onCompare, onClear, isComparing = false }: ControlBarProps) {
  return (
    <div className={styles.controlBar} role="toolbar" aria-label="Actions">
      <button
        type="button"
        aria-label="Compare JSON inputs"
        disabled={isComparing}
        onClick={onCompare}
        className={`${styles.btn} ${styles['btn--primary']}`}
      >
        Compare
      </button>
      <button
        type="button"
        aria-label="Clear all inputs and results"
        onClick={onClear}
        className={`${styles.btn} ${styles['btn--secondary']}`}
      >
        Clear
      </button>
    </div>
  );
}
