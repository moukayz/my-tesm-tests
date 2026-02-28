import React from 'react';
import type { DiffLine, InlineSegment } from '../../types/diff';
import styles from './DiffViewer.module.css';

interface DiffViewerProps {
  lines: DiffLine[];
}

interface DiffLineRowProps {
  line: DiffLine;
}

function InlineContent({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className={styles.inlineHighlight}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function DiffLineRow({ line }: DiffLineRowProps) {
  const rowClass = `${styles.diffRow} ${styles[`diffRow--${line.type}`]}`;

  if (line.type === 'modified') {
    return (
      <div className={rowClass}>
        {/* Left column — old value with inline highlights */}
        <div className={`${styles.col} ${styles['col--left']} ${styles['col--modifiedLeft']}`}>
          <span className={styles.lineno}>{line.leftLineNo ?? ''}</span>
          <span className={styles.marker} aria-hidden="true">
            {'~'}
          </span>
          <span className={styles.content}>
            {line.leftSegments ? (
              <InlineContent segments={line.leftSegments} />
            ) : (
              line.leftValue ?? ''
            )}
          </span>
        </div>
        {/* Right column — new value with inline highlights */}
        <div className={`${styles.col} ${styles['col--right']} ${styles['col--modifiedRight']}`}>
          <span className={styles.lineno}>{line.rightLineNo ?? ''}</span>
          <span className={styles.marker} aria-hidden="true">
            {'~'}
          </span>
          <span className={styles.content}>
            {line.rightSegments ? (
              <InlineContent segments={line.rightSegments} />
            ) : (
              line.rightValue ?? ''
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={rowClass}>
      {/* Left column */}
      <div className={`${styles.col} ${styles['col--left']}`}>
        <span className={styles.lineno}>{line.leftLineNo ?? ''}</span>
        <span className={styles.marker} aria-hidden="true">
          {line.type === 'removed' ? '-' : ' '}
        </span>
        <span className={styles.content}>
          {line.type !== 'added' ? line.value : ''}
        </span>
      </div>
      {/* Right column */}
      <div className={`${styles.col} ${styles['col--right']}`}>
        <span className={styles.lineno}>{line.rightLineNo ?? ''}</span>
        <span className={styles.marker} aria-hidden="true">
          {line.type === 'added' ? '+' : ' '}
        </span>
        <span className={styles.content}>
          {line.type !== 'removed' ? line.value : ''}
        </span>
      </div>
    </div>
  );
}

export const DiffViewer = React.memo(function DiffViewer({ lines }: DiffViewerProps) {
  return (
    <div role="region" aria-label="Diff output" className={styles.diffViewer}>
      <div className={styles.header}>
        <div className={styles.colHeader}>Left (Original)</div>
        <div className={styles.colHeader}>Right (Modified)</div>
      </div>
      <div className={styles.body}>
        {lines.map((line, i) => (
          <DiffLineRow key={i} line={line} />
        ))}
      </div>
    </div>
  );
});
