import { useState, useRef } from 'react';

/**
 * Custom hook for managing text selection state
 */
export const useSelection = () => {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const selectionRef = useRef(selection);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const suppressSelectionUpdatesRef = useRef<number>(0);

  const setSelectionBoth = (nextSelection: { start: number; end: number }) => {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  };

  const beginProgrammaticSelection = (nextSelection: { start: number; end: number }) => {
    pendingSelectionRef.current = nextSelection;
    suppressSelectionUpdatesRef.current += 1;
    setSelectionBoth(nextSelection);
  };

  const endProgrammaticSelection = () => {
    suppressSelectionUpdatesRef.current = Math.max(0, suppressSelectionUpdatesRef.current - 1);
    if (suppressSelectionUpdatesRef.current === 0) {
      pendingSelectionRef.current = null;
    }
  };

  return {
    selection,
    selectionRef,
    pendingSelectionRef,
    suppressSelectionUpdatesRef,
    setSelectionBoth,
    beginProgrammaticSelection,
    endProgrammaticSelection,
  };
};
