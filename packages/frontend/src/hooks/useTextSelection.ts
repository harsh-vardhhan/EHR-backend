import { useState, useEffect } from 'react';
import type { RefObject } from 'react';

export interface SelectionState {
  text: string;
  startOffset: number;
  endOffset: number;
  position: { x: number; y: number } | null;
}

export function useTextSelection(containerRef: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !containerRef.current) {
        setSelection(null);
        return;
      }

      // Ensure the selection is within the container
      if (!containerRef.current.contains(sel.anchorNode) || !containerRef.current.contains(sel.focusNode)) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(containerRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const startOffset = preSelectionRange.toString().length;
      const text = range.toString();
      const endOffset = startOffset + text.length;

      const rect = range.getBoundingClientRect();

      setSelection({
        text,
        startOffset,
        endOffset,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        },
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef]);

  return { selection, setSelection };
}
