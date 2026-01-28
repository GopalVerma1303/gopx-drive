import { useRef } from 'react';
import type { Snapshot } from '../types';

const MAX_HISTORY = 200;

/**
 * Custom hook for managing undo/redo functionality
 */
export const useUndoRedo = () => {
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);

  const pushUndoSnapshot = (snapshot: Snapshot) => {
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
  };

  const pushRedoSnapshot = (snapshot: Snapshot) => {
    redoStackRef.current.push(snapshot);
    if (redoStackRef.current.length > MAX_HISTORY) {
      redoStackRef.current.shift();
    }
  };

  const clearHistory = () => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  };

  return {
    undoStackRef,
    redoStackRef,
    pushUndoSnapshot,
    pushRedoSnapshot,
    clearHistory,
  };
};
