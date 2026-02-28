import { useMemo } from 'react';
import { useDiff } from '../../hooks/useDiff';
import { JsonInputPanel } from '../JsonInputPanel/JsonInputPanel';
import { ControlBar } from '../ControlBar/ControlBar';
import { DiffViewer } from '../DiffViewer/DiffViewer';
import { NoDiffMessage } from '../NoDiffMessage/NoDiffMessage';
import { ErrorBanner } from '../ErrorBanner/ErrorBanner';
import styles from './App.module.css';

export function App() {
  const {
    leftInput,
    rightInput,
    diffResult,
    setLeftRaw,
    setRightRaw,
    compare,
    clear,
  } = useDiff();

  const diffLines = useMemo(
    () => (diffResult.status === 'diff' ? diffResult.lines : []),
    [diffResult],
  );

  return (
    <main className={styles.appLayout}>
      <header className={styles.header}>
        <h1 className={styles.title}>JSON Diff Checker</h1>
      </header>

      <section className={styles.inputPanels}>
        <JsonInputPanel
          side="left"
          value={leftInput.raw}
          error={leftInput.error}
          onChange={setLeftRaw}
        />
        <JsonInputPanel
          side="right"
          value={rightInput.raw}
          error={rightInput.error}
          onChange={setRightRaw}
        />
      </section>

      <ControlBar onCompare={compare} onClear={clear} />

      <section className={styles.resultsArea}>
        {diffResult.status === 'error' && diffResult.internalError && (
          <ErrorBanner message={diffResult.internalError} />
        )}
        {diffResult.status === 'diff' && <DiffViewer lines={diffLines} />}
        {diffResult.status === 'identical' && <NoDiffMessage />}
      </section>
    </main>
  );
}
