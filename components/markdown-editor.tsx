import { detectCheckboxInLine, toggleCheckboxInMarkdown } from "@/components/markdown-toolbar";
import { SyntaxHighlighter } from "@/components/syntax-highlighter";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, Text as RNText, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import Markdown, { renderRules } from "react-native-markdown-display";

// Import extracted modules
import { useSelection } from "./markdown-editor/hooks/useSelection";
import { useUndoRedo } from "./markdown-editor/hooks/useUndoRedo";
import type { MarkdownEditorProps, MarkdownEditorRef } from "./markdown-editor/types";
import { getListInfo } from "./markdown-editor/utils/list-detection";
import {
  alphabetToNumber,
  getMarkerString,
  getNextMarkerType,
  getPreviousMarkerType,
  isValidRoman,
  numberToAlphabet,
  numberToRoman,
  romanToNumber
} from "./markdown-editor/utils/list-markers";
import { renumberOrderedList, TAB_SPACES } from "./markdown-editor/utils/list-processing";
import { linkifyMarkdown } from "./markdown-editor/utils/text-helpers";

// Re-export types for backward compatibility
export type { MarkdownEditorProps, MarkdownEditorRef };

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChangeText,
      placeholder = "Start writing in markdown...",
      className,
      isPreview = false,
      onSave,
      onSelectionChange,
    },
    ref
  ) {
    const { colors } = useThemeColors();
    const { width: windowWidth } = useWindowDimensions();
    const inputRef = useRef<TextInput>(null);
    const previousValueRef = useRef<string>(value);
    const isProcessingListRef = useRef<boolean>(false);
    const pendingInternalValueRef = useRef<string | null>(null);
    const [imageMeta, setImageMeta] = useState<Record<string, { width: number; height: number }>>({});

    // Use extracted hooks
    const {
      selection,
      selectionRef,
      pendingSelectionRef,
      suppressSelectionUpdatesRef,
      setSelectionBoth,
      beginProgrammaticSelection,
      endProgrammaticSelection,
    } = useSelection();

    const {
      undoStackRef,
      redoStackRef,
      pushUndoSnapshot,
      pushRedoSnapshot,
      clearHistory,
    } = useUndoRedo();

    // Utility functions are now imported from extracted modules

    // detectMarkerTypeFromContext and getListInfo are now imported from list-detection utils
    // Helper function wrapper for getListInfo (to maintain compatibility)
    const getListInfoLocal = (text: string, cursorPosition: number) => {
      return getListInfo(text, cursorPosition);
    };

    // Handle text changes to detect and process list continuations
    const handleTextChange = (newText: string) => {
      // Skip processing if we're already processing a list change (avoid infinite loops)
      if (isProcessingListRef.current) {
        previousValueRef.current = newText;
        pendingInternalValueRef.current = newText;
        onChangeText(newText);
        return;
      }

      const oldText = previousValueRef.current;
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');

      // Record undo snapshot (user typing) before any auto-transforms.
      if (!isPreview && oldText !== newText) {
        pushUndoSnapshot({ text: oldText, selection: selectionRef.current });
        redoStackRef.current = [];
      }

      // Helper function to renumber ordered list items after a deletion
      // Now uses imported renumberOrderedList function
      const renumberOrderedListLocal = (lines: string[], startIndex: number, indent: string, markerSubtype: 'numeric' | 'lowercase-alpha' | 'uppercase-alpha' | 'lowercase-roman' | 'uppercase-roman') => {
        return renumberOrderedList(lines, startIndex, indent, markerSubtype);
      };

      // Check if lines were deleted (text decreased)
      if (newLines.length < oldLines.length && !isProcessingListRef.current) {
        // Detect deletion and renumber subsequent list items
        // Find where the deletion occurred by comparing lines
        let deletionStartIndex = -1;
        let deletionEndIndex = -1;

        // Find the first line that differs
        for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
          if (oldLines[i] !== newLines[i]) {
            deletionStartIndex = i;
            break;
          }
        }

        // If no difference found in common prefix, deletion happened at the end
        if (deletionStartIndex === -1) {
          deletionStartIndex = newLines.length;
        }

        // Check lines around the deletion point to find list context
        // Try the line before deletion, then the line at deletion point, then the line after
        const checkIndices = [
          Math.max(0, deletionStartIndex - 1),
          deletionStartIndex,
          Math.min(newLines.length - 1, deletionStartIndex)
        ].filter(idx => idx >= 0 && idx < newLines.length);

        for (const checkLineIndex of checkIndices) {
          const checkLine = newLines[checkLineIndex];
          if (!checkLine || checkLine.trim() === '') continue;

          // Calculate cursor position at the start of this line
          let lineStartPos = 0;
          for (let i = 0; i < checkLineIndex; i++) {
            lineStartPos += (newLines[i]?.length || 0) + 1;
          }

          const listInfo = getListInfoLocal(newText, lineStartPos);

          if (listInfo && listInfo.markerType === 'ordered' && listInfo.markerSubtype) {
            // Find the first line at the same indentation level after the deletion
            let renumberStartIndex = checkLineIndex + 1;

            // If we're checking the line before deletion, start renumbering from deletion point
            if (checkLineIndex === deletionStartIndex - 1) {
              renumberStartIndex = deletionStartIndex;
            }

            // Renumber subsequent items at the same indentation level
            isProcessingListRef.current = true;
            const renumberedLines = renumberOrderedListLocal(
              newLines,
              renumberStartIndex,
              listInfo.indent,
              listInfo.markerSubtype
            );
            const renumberedText = renumberedLines.join('\n');

            previousValueRef.current = renumberedText;
            pendingInternalValueRef.current = renumberedText;
            onChangeText(renumberedText);

            requestAnimationFrame(() => {
              setTimeout(() => {
                isProcessingListRef.current = false;
              }, Platform.OS === "android" ? 16 : 0);
            });
            return;
          }
        }
      }

      // Check if a newline was just added (text increased by exactly one line)
      if (newLines.length === oldLines.length + 1) {
        // Determine the exact insertion point for the newline using a prefix/suffix diff.
        // This is more reliable than line-by-line comparison when inserting in the middle
        // of a document (e.g., adding a new list item between existing items).
        let prefixLen = 0;
        const maxPrefix = Math.min(oldText.length, newText.length);
        while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) {
          prefixLen++;
        }

        let oldSuffixIdx = oldText.length - 1;
        let newSuffixIdx = newText.length - 1;
        while (
          oldSuffixIdx >= prefixLen &&
          newSuffixIdx >= prefixLen &&
          oldText[oldSuffixIdx] === newText[newSuffixIdx]
        ) {
          oldSuffixIdx--;
          newSuffixIdx--;
        }

        const inserted = newText.slice(prefixLen, newSuffixIdx + 1);
        const removed = oldText.slice(prefixLen, oldSuffixIdx + 1);
        const normalizedInserted = inserted.replace(/\r/g, "");

        // Only auto-continue lists for a plain "Enter" that inserts exactly one newline.
        if (!(removed.length === 0 && normalizedInserted === "\n")) {
          previousValueRef.current = newText;
          pendingInternalValueRef.current = newText;
          onChangeText(newText);
          return;
        }

        // Figure out where the newline was inserted in the OLD text.
        // Prefix/suffix diffs can be ambiguous when inserting "\n" next to an existing "\n"
        // (e.g., adding a blank line between existing lines). Prefer the current selection
        // (often still at the pre-change cursor) and fall back to diff-derived candidates.
        const insertedRawLen = inserted.length;
        const isValidInsertionAt = (pos: number) => {
          if (pos < 0 || pos > oldText.length) return false;
          if (newText.slice(0, pos) !== oldText.slice(0, pos)) return false;
          if (newText.slice(pos, pos + insertedRawLen).replace(/\r/g, "") !== "\n") return false;
          return newText.slice(pos + insertedRawLen) === oldText.slice(pos);
        };

        const selStart = selectionRef.current.start;
        const cursorCandidates = [
          selStart,
          selStart - insertedRawLen,
          prefixLen,
          prefixLen - insertedRawLen,
          prefixLen - 1,
        ].filter((n) => Number.isFinite(n));

        const resolvedCursorBeforeSplit =
          cursorCandidates.find((pos) => isValidInsertionAt(pos)) ?? prefixLen;

        const cursorBeforeSplit = Math.max(0, Math.min(oldText.length, resolvedCursorBeforeSplit));

        // Check if we're in a list context at the cursor position before split
        const listInfo = getListInfoLocal(oldText, cursorBeforeSplit);

        if (listInfo) {
          const { indent, marker, markerType, markerSubtype, nextMarker, currentLine, lineIndex: splitLineIndex } = listInfo;

          const newLineAfterSplit = newLines[splitLineIndex + 1] || '';

          // Avoid inserting list markers if the cursor is before (or inside) the list marker itself.
          // Example: cursor at the start of "- [ ] item" shouldn't cause "- [ ] - [ ] item".
          const lineStart = oldText.lastIndexOf('\n', Math.max(0, cursorBeforeSplit - 1)) + 1;
          const cursorColumn = cursorBeforeSplit - lineStart;
          const markerEndColumn = indent.length + marker.length;
          if (cursorColumn < markerEndColumn) {
            previousValueRef.current = newText;
            pendingInternalValueRef.current = newText;
            onChangeText(newText);
            return;
          }

          // Check if the old line (before split) was empty (only marker, no content)
          const oldLineContent = currentLine.replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '') // Remove checkbox
            .replace(/^\s*\d+\.\s+/, '') // Remove numeric ordered marker
            .replace(/^\s*[a-z]+\.\s+/, '') // Remove lowercase alphabet ordered marker
            .replace(/^\s*[A-Z]+\.\s+/, '') // Remove uppercase alphabet ordered marker
            .replace(/^\s*[ivxlcdm]+\.\s+/, '') // Remove lowercase roman ordered marker
            .replace(/^\s*[IVXLCDM]+\.\s+/, '') // Remove uppercase roman ordered marker
            .replace(/^\s*[-*+]\s+/, '') // Remove unordered marker
            .trim();

          if (oldLineContent === '' && newLineAfterSplit.trim() === '') {
            // Empty list item - remove it and keep just the newline
            isProcessingListRef.current = true;
            const updatedLines = [...newLines];
            updatedLines.splice(splitLineIndex, 1);
            const updatedText = updatedLines.join('\n');

            // Calculate new cursor position (at the start of what was the next line)
            let newCursorPosition = 0;
            for (let i = 0; i < splitLineIndex; i++) {
              newCursorPosition += (updatedLines[i]?.length || 0) + 1;
            }

            // Establish the cursor position early so RN doesn't briefly reset it (e.g., to 0)
            beginProgrammaticSelection({
              start: newCursorPosition,
              end: newCursorPosition,
            });

            previousValueRef.current = updatedText;
            pendingInternalValueRef.current = updatedText;
            onChangeText(updatedText);

            requestAnimationFrame(() => {
              setTimeout(() => {
                if (Platform.OS === "web") {
                  const input = inputRef.current as any;
                  if (input && input.setSelectionRange) {
                    input.setSelectionRange(newCursorPosition, newCursorPosition);
                  }
                } else {
                  const input = inputRef.current as any;
                  if (input && typeof input.setNativeProps === "function") {
                    input.setNativeProps({
                      selection: { start: newCursorPosition, end: newCursorPosition },
                    });
                  }
                }
                inputRef.current?.focus();
                isProcessingListRef.current = false;
                endProgrammaticSelection();
              }, Platform.OS === "android" ? 16 : 0);
            });
            return;
          } else if (oldLineContent !== '') {
            // Non-empty list item - add next marker to the new line
            isProcessingListRef.current = true;
            const updatedLines = [...newLines];
            // Remove any existing content from the new line and add the marker
            updatedLines[splitLineIndex + 1] = indent + nextMarker + newLineAfterSplit;

            // If we're inserting into an ordered list, renumber subsequent siblings (+1) until the list ends.
            // Stop at the first blank line; also stop when we encounter a line that isn't part of this list level.
            if (markerType === 'ordered' && markerSubtype) {
              // Extract the current marker value for incrementing
              let currentValue: number = 0;
              if (markerSubtype === 'numeric') {
                currentValue = parseInt(nextMarker.replace('.', ''), 10);
              } else if (markerSubtype === 'lowercase-alpha' || markerSubtype === 'uppercase-alpha') {
                currentValue = alphabetToNumber(nextMarker.replace('.', '').replace(/\s+/, ''));
              } else if (markerSubtype === 'lowercase-roman' || markerSubtype === 'uppercase-roman') {
                currentValue = romanToNumber(nextMarker.replace('.', '').replace(/\s+/, ''));
              }

              let nextValue = currentValue + 1;

              // Build regex pattern based on marker subtype
              let orderedRegex: RegExp;
              if (markerSubtype === 'numeric') {
                orderedRegex = /^(\s*)(\d+)\.\s+(.*)$/;
              } else if (markerSubtype === 'lowercase-alpha') {
                orderedRegex = /^(\s*)([a-z]+)\.\s+(.*)$/;
              } else if (markerSubtype === 'uppercase-alpha') {
                orderedRegex = /^(\s*)([A-Z]+)\.\s+(.*)$/;
              } else if (markerSubtype === 'lowercase-roman') {
                orderedRegex = /^(\s*)([ivxlcdm]+)\.\s+(.*)$/;
              } else { // uppercase-roman
                orderedRegex = /^(\s*)([IVXLCDM]+)\.\s+(.*)$/;
              }

              for (let i = splitLineIndex + 2; i < updatedLines.length; i++) {
                const line = updatedLines[i] ?? '';

                // A blank line terminates the list.
                if (line.trim() === '') break;

                const orderedMatch = line.match(orderedRegex);

                if (!orderedMatch) {
                  // Allow nested content (more-indented) to exist inside a list item without ending the list.
                  const lineIndent = (line.match(/^(\s*)/)?.[1]) ?? '';
                  if (lineIndent.length > indent.length) {
                    continue;
                  }
                  break;
                }

                const lineIndent = orderedMatch[1] ?? '';
                const lineMarker = orderedMatch[2] ?? '';
                const lineContent = orderedMatch[3] ?? '';

                // Validate marker type matches (e.g., roman numerals must be valid)
                let isValidMarker = true;
                if (markerSubtype === 'lowercase-roman' || markerSubtype === 'uppercase-roman') {
                  isValidMarker = isValidRoman(lineMarker);
                } else if (markerSubtype === 'lowercase-alpha' || markerSubtype === 'uppercase-alpha') {
                  isValidMarker = markerSubtype === 'lowercase-alpha'
                    ? /^[a-z]+$/.test(lineMarker)
                    : /^[A-Z]+$/.test(lineMarker);
                }

                if (!isValidMarker) {
                  // Allow nested content (more-indented) to exist inside a list item without ending the list.
                  const lineIndent = (line.match(/^(\s*)/)?.[1]) ?? '';
                  if (lineIndent.length > indent.length) {
                    continue;
                  }
                  break;
                }

                if (lineIndent === indent) {
                  // Generate next marker based on subtype
                  let nextMarkerStr: string;
                  if (markerSubtype === 'numeric') {
                    nextMarkerStr = `${nextValue}. `;
                  } else if (markerSubtype === 'lowercase-alpha') {
                    nextMarkerStr = `${numberToAlphabet(nextValue, false)}. `;
                  } else if (markerSubtype === 'uppercase-alpha') {
                    nextMarkerStr = `${numberToAlphabet(nextValue, true)}. `;
                  } else if (markerSubtype === 'lowercase-roman') {
                    nextMarkerStr = `${numberToRoman(nextValue, false)}. `;
                  } else { // uppercase-roman
                    nextMarkerStr = `${numberToRoman(nextValue, true)}. `;
                  }

                  updatedLines[i] = `${indent}${nextMarkerStr}${lineContent}`;
                  nextValue += 1;
                  continue;
                }

                // Nested ordered list (more-indented) - don't renumber at this level, but don't end the list either.
                if (lineIndent.length > indent.length) {
                  continue;
                }

                // Less indentation indicates we've left this list level.
                break;
              }
            }

            const updatedText = updatedLines.join('\n');

            // Calculate new cursor position (after the marker on the new line)
            let newCursorPosition = 0;
            for (let i = 0; i <= splitLineIndex; i++) {
              newCursorPosition += (updatedLines[i]?.length || 0) + 1;
            }
            newCursorPosition += indent.length + nextMarker.length;

            // Establish the cursor position early so RN doesn't briefly reset it (e.g., to 0)
            beginProgrammaticSelection({
              start: newCursorPosition,
              end: newCursorPosition,
            });

            previousValueRef.current = updatedText;
            pendingInternalValueRef.current = updatedText;
            onChangeText(updatedText);

            requestAnimationFrame(() => {
              setTimeout(() => {
                if (Platform.OS === "web") {
                  const input = inputRef.current as any;
                  if (input && input.setSelectionRange) {
                    input.setSelectionRange(newCursorPosition, newCursorPosition);
                  }
                } else {
                  const input = inputRef.current as any;
                  if (input && typeof input.setNativeProps === "function") {
                    input.setNativeProps({
                      selection: { start: newCursorPosition, end: newCursorPosition },
                    });
                  }
                }
                inputRef.current?.focus();
                isProcessingListRef.current = false;
                endProgrammaticSelection();
              }, Platform.OS === "android" ? 16 : 0);
            });
            return;
          }
        }
      }

      // Update previous value and call original onChangeText
      previousValueRef.current = newText;
      pendingInternalValueRef.current = newText;
      onChangeText(newText);
    };

    // Update previousValueRef when value changes externally
    useEffect(() => {
      if (!isProcessingListRef.current) {
        if (pendingInternalValueRef.current !== null) {
          if (pendingInternalValueRef.current === value) {
            pendingInternalValueRef.current = null;
            previousValueRef.current = value;
            return;
          }
          pendingInternalValueRef.current = null;
        }

        // External value update (e.g. note load/refresh) - reset history.
        previousValueRef.current = value;
        clearHistory();
      }
    }, [value]);

    const applyTextAndSelection = (
      nextText: string,
      nextSelection: { start: number; end: number },
      options?: { skipHistory?: boolean }
    ) => {
      if (isPreview || !inputRef.current) return;

      const currentText = previousValueRef.current;
      if (!options?.skipHistory && currentText !== nextText) {
        pushUndoSnapshot({ text: currentText, selection: selectionRef.current });
        redoStackRef.current = [];
      }

      beginProgrammaticSelection(nextSelection);
      previousValueRef.current = nextText;
      pendingInternalValueRef.current = nextText;
      onChangeText(nextText);
      inputRef.current?.focus();

      const setCursorPosition = () => {
        if (Platform.OS === "web") {
          const input = inputRef.current as any;
          if (input && input.setSelectionRange) {
            input.setSelectionRange(nextSelection.start, nextSelection.end);
          } else if (input && input.selectionStart !== undefined) {
            input.selectionStart = nextSelection.start;
            input.selectionEnd = nextSelection.end;
          }
        } else {
          const input = inputRef.current as any;
          if (input && typeof input.setNativeProps === "function") {
            input.setNativeProps({
              selection: { start: nextSelection.start, end: nextSelection.end },
            });
          }
          inputRef.current?.focus();
        }
        endProgrammaticSelection();
      };

      requestAnimationFrame(() => {
        setTimeout(setCursorPosition, Platform.OS === "android" ? 16 : 0);
      });
    };

    const insertTextAtSelection = (text: string, cursorOffset?: number) => {
      if (isPreview || !inputRef.current) return;

      const start = selection.start;
      const end = selection.end;
      const currentText = previousValueRef.current;
      const beforeText = currentText.substring(0, start);
      const afterText = currentText.substring(end);
      const nextText = beforeText + text + afterText;
      const newCursorPosition = start + (cursorOffset ?? text.length);

      applyTextAndSelection(nextText, { start: newCursorPosition, end: newCursorPosition });
    };

    // Marker type helpers are now imported from list-markers utils

    const indentAtSelection = () => {
      if (isPreview || !inputRef.current) return;

      const start = selection.start;
      const end = selection.end;
      const currentText = previousValueRef.current;

      // Check if we're in a list at the cursor position
      const listInfo = getListInfoLocal(currentText, start);

      if (listInfo && listInfo.isList) {
        // Handle list indentation
        const lines = currentText.split('\n');
        const beforeCursor = currentText.substring(0, start);
        const lineIndex = beforeCursor.split('\n').length - 1;
        const currentLine = lines[lineIndex] || '';

        // Determine which lines to indent (single line or selection)
        const blockStart = currentText.lastIndexOf("\n", start - 1) + 1;
        let blockEnd = currentText.indexOf("\n", end);
        if (blockEnd === -1) blockEnd = currentText.length;

        const affectedLines: number[] = [];
        let lineStartPos = blockStart;
        for (let i = lineIndex; i < lines.length; i++) {
          if (lineStartPos > blockEnd) break;
          affectedLines.push(i);
          lineStartPos += (lines[i]?.length || 0) + 1;
        }

        const updatedLines = [...lines];
        let startOffset = 0;
        let endOffset = 0;
        let cumulativeOffset = 0;

        for (const idx of affectedLines) {
          const line = updatedLines[idx] || '';
          // Calculate cursor position at the start of this line
          let lineStartPos = 0;
          for (let i = 0; i < idx; i++) {
            lineStartPos += (lines[i]?.length || 0) + 1;
          }
          const lineListInfo = getListInfo(currentText, lineStartPos);

          const oldLineLength = line.length;
          let newLineLength = oldLineLength;

          if (lineListInfo && lineListInfo.isList) {
            if (lineListInfo.markerType === 'ordered' && lineListInfo.markerSubtype) {
              // Ordered list: increase indentation and cycle marker type
              // Be aware of nested level - continue from existing items at that level if they exist
              const newIndent = lineListInfo.indent + TAB_SPACES;
              const nextMarkerType = getNextMarkerType(lineListInfo.markerSubtype);

              // Check if there are already items at this nested level
              // If yes, continue from the last item; if no, start from 1/i/a
              let currentValue = 1;

              // Build regex pattern for the new marker type at the new indentation level
              let nestedRegex: RegExp;
              if (nextMarkerType === 'numeric') {
                nestedRegex = /^(\s*)(\d+)\.\s+(.*)$/;
              } else if (nextMarkerType === 'lowercase-roman') {
                nestedRegex = /^(\s*)([ivxlcdm]+)\.\s+(.*)$/;
              } else { // lowercase-alpha
                nestedRegex = /^(\s*)([a-z]+)\.\s+(.*)$/;
              }

              // Look backwards to find the LAST item at the new nested indentation level
              // This ensures we continue the sequence correctly at any nested level
              let lastNestedValue = 0;
              for (let i = idx - 1; i >= 0; i--) {
                const prevLine = lines[i] ?? '';
                if (prevLine.trim() === '') continue;

                const lineIndent = (prevLine.match(/^(\s*)/)?.[1]) ?? '';

                // If indentation is less than the new nested level, we've left that level
                if (lineIndent.length < newIndent.length) {
                  break;
                }

                // Check if this line is at the new nested indentation level
                if (lineIndent === newIndent) {
                  const nestedMatch = prevLine.match(nestedRegex);
                  if (nestedMatch) {
                    const nestedMarker = nestedMatch[2] ?? '';
                    let markerValue = 0;

                    // Extract the value from the marker
                    if (nextMarkerType === 'numeric') {
                      markerValue = parseInt(nestedMarker, 10);
                    } else if (nextMarkerType === 'lowercase-roman') {
                      if (isValidRoman(nestedMarker)) {
                        markerValue = romanToNumber(nestedMarker);
                      }
                    } else { // lowercase-alpha
                      if (/^[a-z]+$/.test(nestedMarker) && !isValidRoman(nestedMarker)) {
                        markerValue = alphabetToNumber(nestedMarker);
                      }
                    }

                    // Keep track of the last (highest) value we find at this nested level
                    if (markerValue > lastNestedValue) {
                      lastNestedValue = markerValue;
                    }
                  }
                }
              }

              // If we found items at this nested level, continue from the last value + 1
              // Otherwise, start from 1 (or i, or a)
              if (lastNestedValue > 0) {
                currentValue = lastNestedValue + 1;
              }

              // Extract content after marker
              const contentMatch = line.match(/^(\s*)([-*+]|\d+|[a-zA-Z]+|[ivxlcdmIVXLCDM]+)\.\s+(.*)$/);
              const content = contentMatch ? contentMatch[3] : '';

              // Create new marker - dynamically continue from existing items at this nested level
              const newMarker = getMarkerString(nextMarkerType, currentValue);
              updatedLines[idx] = newIndent + newMarker + content;
              newLineLength = updatedLines[idx].length;

              // Track offset for cursor adjustment
              const lineOffset = newLineLength - oldLineLength;
              if (idx === lineIndex) {
                startOffset = cumulativeOffset + lineOffset;
              }
              cumulativeOffset += lineOffset;
            } else if (lineListInfo.markerType === 'unordered') {
              // Unordered list: just increase indentation
              const newIndent = lineListInfo.indent + TAB_SPACES;
              const contentMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
              const marker = contentMatch ? contentMatch[2] : '-';
              const content = contentMatch ? contentMatch[3] : '';
              updatedLines[idx] = newIndent + marker + ' ' + content;
              newLineLength = updatedLines[idx].length;

              const lineOffset = TAB_SPACES.length;
              if (idx === lineIndex) {
                startOffset = cumulativeOffset + lineOffset;
              }
              cumulativeOffset += lineOffset;
            } else if (lineListInfo.markerType === 'checkbox') {
              // Checkbox list: increase indentation and keep checkbox marker (nested checkbox)
              const newIndent = lineListInfo.indent + TAB_SPACES;
              const contentMatch = line.match(/^(\s*)([-*+])\s+\[([\s*xX*])\]\s*(.*)$/);
              const marker = contentMatch ? contentMatch[2] : '-';
              const checkboxState = contentMatch ? contentMatch[3] : ' ';
              const content = contentMatch ? contentMatch[4] : '';
              updatedLines[idx] = newIndent + marker + ' [' + checkboxState + '] ' + content;
              newLineLength = updatedLines[idx].length;

              const lineOffset = TAB_SPACES.length;
              if (idx === lineIndex) {
                startOffset = cumulativeOffset + lineOffset;
              }
              cumulativeOffset += lineOffset;
            }
          } else {
            // Not a list line, use default behavior
            updatedLines[idx] = TAB_SPACES + line;
            newLineLength = updatedLines[idx].length;

            const lineOffset = TAB_SPACES.length;
            if (idx === lineIndex) {
              startOffset = cumulativeOffset + lineOffset;
            }
            cumulativeOffset += lineOffset;
          }

          // Calculate end offset for multi-line selections
          if (idx === affectedLines[affectedLines.length - 1]) {
            endOffset = cumulativeOffset;
          }
        }

        const nextText = updatedLines.join('\n');
        const newStart = start + startOffset;
        const newEnd = end + endOffset;
        applyTextAndSelection(nextText, { start: newStart, end: newEnd });
        return;
      }

      // Not in a list: use default behavior
      // No selection: behave like inserting TAB_SPACES at cursor
      if (start === end) {
        insertTextAtSelection(TAB_SPACES, TAB_SPACES.length);
        return;
      }

      // Selection: indent each line touched by the selection (prepend TAB_SPACES)
      const blockStart = currentText.lastIndexOf("\n", start - 1) + 1;
      let blockEnd = value.indexOf("\n", end);
      if (blockEnd === -1) blockEnd = currentText.length;

      const block = currentText.slice(blockStart, blockEnd);
      const lines = block.split("\n");

      const insertionStarts: number[] = [];
      let runningIndex = blockStart;
      const nextLines = lines.map((line) => {
        insertionStarts.push(runningIndex);
        // advance using ORIGINAL line length (+ newline)
        runningIndex += line.length + 1;
        return TAB_SPACES + line;
      });

      const nextBlock = nextLines.join("\n");
      const nextText = currentText.slice(0, blockStart) + nextBlock + currentText.slice(blockEnd);

      const adjustPos = (pos: number) => {
        let nextPos = pos;
        for (const p of insertionStarts) {
          if (pos < p) continue;
          nextPos += TAB_SPACES.length;
        }
        return nextPos;
      };

      applyTextAndSelection(nextText, { start: adjustPos(start), end: adjustPos(end) });
    };

    const unindentAtSelection = () => {
      if (isPreview || !inputRef.current) return;

      const start = selection.start;
      const end = selection.end;
      const currentText = previousValueRef.current;

      // Check if we're in a list at the cursor position
      const listInfo = getListInfoLocal(currentText, start);

      if (listInfo && listInfo.isList && listInfo.indent.length >= TAB_SPACES.length) {
        // Handle list outdentation
        const lines = currentText.split('\n');
        const beforeCursor = currentText.substring(0, start);
        const lineIndex = beforeCursor.split('\n').length - 1;
        const currentLine = lines[lineIndex] || '';

        // Determine which lines to outdent (single line or selection)
        const blockStart = currentText.lastIndexOf("\n", start - 1) + 1;
        let blockEnd = currentText.indexOf("\n", end);
        if (blockEnd === -1) blockEnd = currentText.length;

        const affectedLines: number[] = [];
        let lineStartPos = blockStart;
        for (let i = lineIndex; i < lines.length; i++) {
          if (lineStartPos > blockEnd) break;
          affectedLines.push(i);
          lineStartPos += (lines[i]?.length || 0) + 1;
        }

        const updatedLines = [...lines];
        let startOffset = 0;
        let endOffset = 0;
        let cumulativeOffset = 0;

        for (const idx of affectedLines) {
          const line = updatedLines[idx] || '';
          // Calculate cursor position at the start of this line
          let lineStartPos = 0;
          for (let i = 0; i < idx; i++) {
            lineStartPos += (lines[i]?.length || 0) + 1;
          }
          const lineListInfo = getListInfo(currentText, lineStartPos);

          const oldLineLength = line.length;
          let newLineLength = oldLineLength;

          if (lineListInfo && lineListInfo.isList && lineListInfo.indent.length >= TAB_SPACES.length) {
            if (lineListInfo.markerType === 'ordered' && lineListInfo.markerSubtype) {
              // Ordered list: decrease indentation and cycle marker type backwards
              const newIndent = lineListInfo.indent.slice(TAB_SPACES.length);
              const prevMarkerType = getPreviousMarkerType(lineListInfo.markerSubtype);

              // When outdenting, we need to find the LAST item at the parent indentation level
              // This ensures we continue the sequence correctly (e.g., iv. -> v., not i.)
              // Professional markdown editors continue the parent sequence when outdenting
              let currentValue = 1;

              // Build regex pattern for the parent marker type
              let parentRegex: RegExp;
              if (prevMarkerType === 'numeric') {
                parentRegex = /^(\s*)(\d+)\.\s+(.*)$/;
              } else if (prevMarkerType === 'lowercase-roman') {
                parentRegex = /^(\s*)([ivxlcdm]+)\.\s+(.*)$/;
              } else { // lowercase-alpha
                parentRegex = /^(\s*)([a-z]+)\.\s+(.*)$/;
              }

              // Look backwards to find the LAST item at the parent indentation level
              // This is the item we should continue from
              let lastParentValue = 0;
              for (let i = idx - 1; i >= 0; i--) {
                const prevLine = lines[i] ?? '';
                if (prevLine.trim() === '') continue;

                const lineIndent = (prevLine.match(/^(\s*)/)?.[1]) ?? '';

                // If indentation is less than parent, we've left the parent list
                if (lineIndent.length < newIndent.length) {
                  break;
                }

                // Check if this line is at the parent indentation level
                if (lineIndent === newIndent) {
                  const parentMatch = prevLine.match(parentRegex);
                  if (parentMatch) {
                    const prevMarker = parentMatch[2] ?? '';
                    let markerValue = 0;

                    // Extract the value from the marker
                    if (prevMarkerType === 'numeric') {
                      markerValue = parseInt(prevMarker, 10);
                    } else if (prevMarkerType === 'lowercase-roman') {
                      if (isValidRoman(prevMarker)) {
                        markerValue = romanToNumber(prevMarker);
                      }
                    } else { // lowercase-alpha
                      if (/^[a-z]+$/.test(prevMarker) && !isValidRoman(prevMarker)) {
                        markerValue = alphabetToNumber(prevMarker);
                      }
                    }

                    // Keep track of the last (highest) value we find
                    if (markerValue > lastParentValue) {
                      lastParentValue = markerValue;
                    }
                  }
                }
              }

              // If we found a parent item, continue from its value + 1
              // Otherwise, start from 1
              if (lastParentValue > 0) {
                currentValue = lastParentValue + 1;
              }

              // Extract content after marker
              const contentMatch = line.match(/^(\s*)([-*+]|\d+|[a-zA-Z]+|[ivxlcdmIVXLCDM]+)\.\s+(.*)$/);
              const content = contentMatch ? contentMatch[3] : '';

              // Create new marker with the correct value at parent level
              const newMarker = getMarkerString(prevMarkerType, currentValue);
              updatedLines[idx] = newIndent + newMarker + content;
              newLineLength = updatedLines[idx].length;

              // Track offset for cursor adjustment
              const lineOffset = newLineLength - oldLineLength;
              if (idx === lineIndex) {
                startOffset = cumulativeOffset + lineOffset;
              }
              cumulativeOffset += lineOffset;
            } else if (lineListInfo.markerType === 'unordered') {
              // Unordered list: just decrease indentation
              const newIndent = lineListInfo.indent.slice(TAB_SPACES.length);
              const contentMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
              const marker = contentMatch ? contentMatch[2] : '-';
              const content = contentMatch ? contentMatch[3] : '';
              updatedLines[idx] = newIndent + marker + ' ' + content;
              newLineLength = updatedLines[idx].length;

              const lineOffset = -TAB_SPACES.length;
              if (idx === lineIndex) {
                startOffset = cumulativeOffset + lineOffset;
              }
              cumulativeOffset += lineOffset;
            } else if (lineListInfo.markerType === 'checkbox') {
              // Checkbox list: decrease indentation and keep checkbox marker
              const newIndent = lineListInfo.indent.slice(TAB_SPACES.length);
              const contentMatch = line.match(/^(\s*)([-*+])\s+\[([\s*xX*])\]\s*(.*)$/);
              const marker = contentMatch ? contentMatch[2] : '-';
              const checkboxState = contentMatch ? contentMatch[3] : ' ';
              const content = contentMatch ? contentMatch[4] : '';
              updatedLines[idx] = newIndent + marker + ' [' + checkboxState + '] ' + content;
              newLineLength = updatedLines[idx].length;

              const lineOffset = newLineLength - oldLineLength;
              if (idx === lineIndex) {
                startOffset = cumulativeOffset + lineOffset;
              }
              cumulativeOffset += lineOffset;
            }
          } else if (line.startsWith(TAB_SPACES)) {
            // Not a list line but has TAB_SPACES, use default behavior
            updatedLines[idx] = line.slice(TAB_SPACES.length);
            newLineLength = updatedLines[idx].length;

            const lineOffset = -TAB_SPACES.length;
            if (idx === lineIndex) {
              startOffset = cumulativeOffset + lineOffset;
            }
            cumulativeOffset += lineOffset;
          }

          // Calculate end offset for multi-line selections
          if (idx === affectedLines[affectedLines.length - 1]) {
            endOffset = cumulativeOffset;
          }
        }

        const nextText = updatedLines.join('\n');
        const newStart = Math.max(0, start + startOffset);
        const newEnd = Math.max(0, end + endOffset);
        applyTextAndSelection(nextText, { start: newStart, end: newEnd });
        return;
      }

      // Not in a list or can't outdent: use default behavior
      // No selection: remove one indent level immediately before cursor if present
      if (start === end) {
        if (start >= TAB_SPACES.length && currentText.substring(start - TAB_SPACES.length, start) === TAB_SPACES) {
          const nextText = currentText.substring(0, start - TAB_SPACES.length) + currentText.substring(end);
          const nextPos = start - TAB_SPACES.length;
          applyTextAndSelection(nextText, { start: nextPos, end: nextPos });
        }
        return;
      }

      // Selection: unindent each line touched by the selection (remove leading TAB_SPACES)
      const blockStart = currentText.lastIndexOf("\n", start - 1) + 1;
      let blockEnd = currentText.indexOf("\n", end);
      if (blockEnd === -1) blockEnd = currentText.length;

      const block = currentText.slice(blockStart, blockEnd);
      const lines = block.split("\n");

      const removalStarts: number[] = [];
      let runningIndex = blockStart;
      const nextLines = lines.map((line) => {
        const didRemove = line.startsWith(TAB_SPACES);
        if (didRemove) {
          removalStarts.push(runningIndex);
        }
        // advance using ORIGINAL line length (+ newline)
        runningIndex += line.length + 1;
        return didRemove ? line.slice(TAB_SPACES.length) : line;
      });

      // If nothing to unindent, keep selection as-is
      if (removalStarts.length === 0) return;

      const nextBlock = nextLines.join("\n");
      const nextText = currentText.slice(0, blockStart) + nextBlock + currentText.slice(blockEnd);

      const adjustPos = (pos: number) => {
        let nextPos = pos;
        for (const p of removalStarts) {
          if (pos <= p) continue;
          const delta = pos - p;
          nextPos -= delta < TAB_SPACES.length ? delta : TAB_SPACES.length;
        }
        return nextPos;
      };

      applyTextAndSelection(nextText, { start: adjustPos(start), end: adjustPos(end) });
    };

    const getWebInputElement = (): any => {
      const refAny = inputRef.current as any;
      if (!refAny) return null;

      // In some react-native-web setups, the ref is the DOM element already.
      if (typeof refAny.addEventListener === "function") return refAny;

      // Try common helpers/fields across RNW versions.
      if (typeof refAny.getNode === "function") return refAny.getNode();
      if (typeof refAny.getNativeRef === "function") return refAny.getNativeRef();
      if (typeof refAny.getInputNode === "function") return refAny.getInputNode();

      if (refAny._node && typeof refAny._node.addEventListener === "function") return refAny._node;
      if (refAny._inputRef && typeof refAny._inputRef.addEventListener === "function") return refAny._inputRef;
      if (refAny._inputElement && typeof refAny._inputElement.addEventListener === "function") return refAny._inputElement;

      return null;
    };

    const handleTabKey = (e: any) => {
      const key = e?.key ?? e?.nativeEvent?.key;
      if (key !== "Tab") return;

      e?.preventDefault?.();
      e?.stopPropagation?.();
      e?.stopImmediatePropagation?.();

      // Shift+Tab: unindent; Tab: indent
      if (e?.shiftKey) {
        unindentAtSelection();
      } else {
        indentAtSelection();
      }
    };

    // Web: ensure Tab doesn't move focus away (RNW doesn't always forward onKeyDown for Tab).
    useEffect(() => {
      if (Platform.OS !== "web") return;
      if (typeof document === "undefined") return;

      const handleDocumentKeyDownCapture = (e: any) => {
        const el = getWebInputElement();
        const active = document.activeElement as any;
        const isEditorFocused = !!el && !!active && (active === el || (typeof el.contains === "function" && el.contains(active)));
        if (!isEditorFocused) return;

        if (e?.isComposing) return;

        const key = (e?.key ?? "").toLowerCase();
        const isCmdOrCtrl = !!e?.metaKey || !!e?.ctrlKey;

        // Bold: Ctrl/Cmd+B
        if (isCmdOrCtrl && key === "b") {
          e?.preventDefault?.();
          e?.stopPropagation?.();
          e?.stopImmediatePropagation?.();

          if (isPreview || !inputRef.current) return;

          const start = selectionRef.current.start;
          const end = selectionRef.current.end;
          const currentText = previousValueRef.current;
          const selectedText = currentText.substring(start, end);

          let nextText: string;
          let newCursorPosition: number;

          if (selectedText.length > 0) {
            // Wrap selected text
            nextText = currentText.substring(0, start) + "**" + selectedText + "**" + currentText.substring(end);
            newCursorPosition = start + 2 + selectedText.length + 2;
          } else {
            // No selection, insert formatting markers
            nextText = currentText.substring(0, start) + "****" + currentText.substring(end);
            newCursorPosition = start + 2; // Position cursor between the two ** markers
          }

          applyTextAndSelection(nextText, { start: newCursorPosition, end: newCursorPosition });
          return;
        }

        // Italic: Ctrl/Cmd+I
        if (isCmdOrCtrl && key === "i") {
          e?.preventDefault?.();
          e?.stopPropagation?.();
          e?.stopImmediatePropagation?.();

          if (isPreview || !inputRef.current) return;

          const start = selectionRef.current.start;
          const end = selectionRef.current.end;
          const currentText = previousValueRef.current;
          const selectedText = currentText.substring(start, end);

          let nextText: string;
          let newCursorPosition: number;

          if (selectedText.length > 0) {
            // Wrap selected text
            nextText = currentText.substring(0, start) + "*" + selectedText + "*" + currentText.substring(end);
            newCursorPosition = start + 1 + selectedText.length + 1;
          } else {
            // No selection, insert formatting markers
            nextText = currentText.substring(0, start) + "**" + currentText.substring(end);
            newCursorPosition = start + 1; // Position cursor between the two * markers
          }

          applyTextAndSelection(nextText, { start: newCursorPosition, end: newCursorPosition });
          return;
        }

        // Save: Ctrl/Cmd+S
        if (isCmdOrCtrl && key === "s") {
          e?.preventDefault?.();
          e?.stopPropagation?.();
          e?.stopImmediatePropagation?.();

          if (onSave) {
            onSave();
          }
          return;
        }

        // Undo / Redo
        if (isCmdOrCtrl && key === "z") {
          e?.preventDefault?.();
          e?.stopPropagation?.();
          e?.stopImmediatePropagation?.();

          if (e?.shiftKey) {
            // Cmd/Ctrl + Shift + Z => Redo
            const canRedo = redoStackRef.current.length > 0;
            if (!canRedo) return;

            const currentText = previousValueRef.current;
            const currentSel = selectionRef.current;
            const snap = redoStackRef.current.pop()!;
            pushUndoSnapshot({ text: currentText, selection: currentSel });
            applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
          } else {
            // Cmd/Ctrl + Z => Undo
            const canUndo = undoStackRef.current.length > 0;
            if (!canUndo) return;

            const currentText = previousValueRef.current;
            const currentSel = selectionRef.current;
            const snap = undoStackRef.current.pop()!;
            pushRedoSnapshot({ text: currentText, selection: currentSel });
            applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
          }
          return;
        }

        // Tab indentation
        if (e?.key === "Tab") {
          handleTabKey(e);
        }
      };

      document.addEventListener("keydown", handleDocumentKeyDownCapture, true);
      return () => {
        document.removeEventListener("keydown", handleDocumentKeyDownCapture, true);
      };
    }, [insertTextAtSelection, onSave, isPreview, applyTextAndSelection]);

    useImperativeHandle(ref, () => ({
      insertText: (text: string, cursorOffset?: number) => {
        insertTextAtSelection(text, cursorOffset);
      },
      wrapSelection: (before: string, after: string, cursorOffset?: number) => {
        if (isPreview || !inputRef.current) return;

        const start = selection.start;
        const end = selection.end;
        const currentText = previousValueRef.current;
        const selectedText = currentText.substring(start, end);

        // If there's selected text, wrap it; otherwise insert the formatting markers
        let nextText: string;
        let newCursorPosition: number;

        if (selectedText.length > 0) {
          // Wrap selected text - place cursor at the end of the wrapped text
          nextText = currentText.substring(0, start) + before + selectedText + after + currentText.substring(end);
          newCursorPosition = start + before.length + selectedText.length + after.length;
        } else {
          // No selection, insert formatting markers with cursor positioned according to cursorOffset
          nextText = currentText.substring(0, start) + before + after + currentText.substring(end);
          // cursorOffset should position cursor between before and after markers
          // e.g., for "**" + "**" with offset 2, cursor should be at start + 2 (after first "**")
          newCursorPosition = start + (cursorOffset ?? before.length);
        }

        applyTextAndSelection(nextText, { start: newCursorPosition, end: newCursorPosition });
      },
      indent: () => {
        indentAtSelection();
      },
      outdent: () => {
        unindentAtSelection();
      },
      undo: () => {
        if (isPreview || !inputRef.current) return;
        if (undoStackRef.current.length === 0) return;

        const currentText = previousValueRef.current;
        const currentSel = selectionRef.current;
        const snap = undoStackRef.current.pop()!;
        pushRedoSnapshot({ text: currentText, selection: currentSel });
        applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
      },
      redo: () => {
        if (isPreview || !inputRef.current) return;
        if (redoStackRef.current.length === 0) return;

        const currentText = previousValueRef.current;
        const currentSel = selectionRef.current;
        const snap = redoStackRef.current.pop()!;
        pushUndoSnapshot({ text: currentText, selection: currentSel });
        applyTextAndSelection(snap.text, snap.selection, { skipHistory: true });
      },
      canUndo: () => undoStackRef.current.length > 0,
      canRedo: () => redoStackRef.current.length > 0,
      focus: () => {
        inputRef.current?.focus();
      },
      getSelection: () => selection,
      replaceRange: (start: number, end: number, text: string) => {
        if (isPreview || !inputRef.current) return;
        const currentText = previousValueRef.current;
        const nextText = currentText.substring(0, start) + text + currentText.substring(end);
        const newCursorPosition = start + text.length;
        pushUndoSnapshot({ text: currentText, selection: selectionRef.current });
        redoStackRef.current = [];
        applyTextAndSelection(nextText, { start: newCursorPosition, end: newCursorPosition });
      },
    }));

    const markdownStyles = {
      body: {
        color: colors.foreground,
        fontSize: 16,
        lineHeight: 24,
        // fontFamily: "monospace",
      },
      heading1: {
        color: colors.foreground,
        fontSize: 32,
        fontWeight: "bold" as const,
        marginTop: 16,
        marginBottom: 8,
        lineHeight: 32,
        // fontFamily: "monospace",
      },
      heading2: {
        color: colors.foreground,
        fontSize: 28,
        fontWeight: "bold" as const,
        marginTop: 14,
        marginBottom: 7,
        lineHeight: 28,
        // fontFamily: "monospace",
      },
      heading3: {
        color: colors.foreground,
        fontSize: 24,
        fontWeight: "600" as const,
        marginTop: 12,
        marginBottom: 6,
        lineHeight: 24,
        // fontFamily: "monospace",
      },
      heading4: {
        color: colors.foreground,
        fontSize: 20,
        fontWeight: "600" as const,
        marginTop: 10,
        marginBottom: 5,
        lineHeight: 20,
        // fontFamily: "monospace",
      },
      paragraph: {
        color: colors.foreground,
        fontSize: 16,
        lineHeight: 24,
        marginTop: 8,
        marginBottom: 8,
        // fontFamily: "monospace",
      },
      strong: {
        fontWeight: "bold" as const,
        color: colors.foreground,
        // fontFamily: "monospace",
      },
      em: {
        fontStyle: "italic" as const,
        color: colors.foreground,
        // fontFamily: "monospace",
      },
      code_inline: {
        color: "#FF69B4",
        fontSize: 14,
        fontFamily: "monospace",
      },
      code_block: {
        backgroundColor: colors.muted,
        color: colors.foreground,
        fontSize: 14,
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 8,
        fontFamily: "monospace",
        borderWidth: 1,
        borderColor: colors.ring,
      },
      fence: {
        backgroundColor: colors.muted,
        color: colors.foreground,
        fontSize: 14,
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 8,
        fontFamily: "monospace",
        borderWidth: 1,
        borderColor: colors.ring,
      },
      blockquote: {
        backgroundColor: colors.muted,
        borderLeftWidth: 4,
        borderLeftColor: colors.ring,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        marginLeft: 0,
        marginTop: 8,
        marginBottom: 8,
        borderRadius: 4,
        fontStyle: "italic" as const,
        color: colors.mutedForeground,
        // fontFamily: "monospace",
      },
      bullet_list: {
        marginTop: 8,
        marginBottom: 8,
        paddingLeft: 8,
      },
      ordered_list: {
        marginTop: 8,
        marginBottom: 8,
        paddingLeft: 8,
      },
      list_item: {
        color: colors.foreground,
        fontSize: 16,
        lineHeight: 24,
        marginTop: 4,
        marginBottom: 4,
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        // fontFamily: "monospace",
      },
      list_item_content: {
        flex: 1,
        minWidth: 0,
      },
      link: {
        color: "#3b82f6",
        textDecorationLine: "underline" as const,
        // fontFamily: "monospace",
      },
      table: {
        borderWidth: 1,
        borderColor: colors.ring,
        borderRadius: 4,
        marginTop: 8,
        marginBottom: 8,
        overflow: "hidden" as const,
      },
      thead: {
        backgroundColor: colors.muted,
      },
      tbody: {
        backgroundColor: colors.muted,
      },
      th: {
        borderWidth: 1,
        borderColor: colors.ring,
        padding: 8,
        fontWeight: "bold" as const,
        color: colors.foreground,
        fontSize: 14,
      },
      tr: {
        borderBottomWidth: 1,
        borderBottomColor: colors.ring,
      },
      td: {
        borderWidth: 1,
        borderColor: colors.ring,
        padding: 8,
        color: colors.foreground,
        fontSize: 14,
      },
      hr: {
        backgroundColor: colors.ring,
        height: 1,
        marginTop: 16,
        marginBottom: 16,
        borderWidth: 0,
      },
    };

    // Helper function to toggle checkbox using the helper from markdown-toolbar
    const toggleCheckbox = (lineIndex: number) => {
      const newValue = toggleCheckboxInMarkdown(value, lineIndex);
      if (newValue !== value) {
        onChangeText(newValue);
      }
    };

    // Pre-process markdown to extract checkbox information
    const checkboxData = useMemo(() => {
      const lines = value.split('\n');
      const checkboxLines: Array<{
        lineIndex: number;
        info: { hasCheckbox: boolean; isChecked: boolean; prefix: string; restText: string; fullMatch: string }
      }> = [];

      lines.forEach((line, index) => {
        const checkboxInfo = detectCheckboxInLine(line);
        if (checkboxInfo?.hasCheckbox) {
          checkboxLines.push({ lineIndex: index, info: checkboxInfo });
        }
      });

      return checkboxLines;
    }, [value]);

    // Track rendered checkboxes using a ref to avoid re-render issues
    const renderedCheckboxesRef = useRef<Set<number>>(new Set());

    // Track the last value to detect changes synchronously
    const lastValueRef = useRef<string>(value);
    const lastPreviewRef = useRef<boolean>(isPreview);

    // Clear rendered checkboxes synchronously when value or preview mode changes
    // This must happen before markdownRules is created to ensure fresh state
    if (lastValueRef.current !== value || lastPreviewRef.current !== isPreview) {
      renderedCheckboxesRef.current.clear();
      lastValueRef.current = value;
      lastPreviewRef.current = isPreview;
    }

    // Also clear in useEffect as a safety net (though synchronous clearing above should handle it)
    useEffect(() => {
      renderedCheckboxesRef.current.clear();
    }, [value, isPreview]);

    // Helper function to extract plain text from React children
    const extractTextFromChildren = (children: any, preserveNewlines: boolean = false): string => {
      if (typeof children === 'string') {
        return preserveNewlines ? children : children.trim();
      }
      if (Array.isArray(children)) {
        const separator = preserveNewlines ? '' : ' ';
        return children
          .map((child) => extractTextFromChildren(child, preserveNewlines))
          .join(separator)
          .trim();
      }
      if (children && typeof children === 'object' && 'props' in children) {
        const childProps = children.props as any;
        if (childProps.children) {
          return extractTextFromChildren(childProps.children, preserveNewlines);
        }
        // Check if it's a Text component with children
        if (typeof childProps.children === 'string') {
          return preserveNewlines ? childProps.children : childProps.children.trim();
        }
      }
      return '';
    };

    // Helper function to normalize text for comparison (remove markdown formatting artifacts)
    const normalizeText = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Helper to strip markdown link syntax for matching.
    // This prevents URL-heavy markdown like `[Google](https://google.com)` from breaking
    // checkbox line matching (children render as "Google", but the source includes the URL).
    const stripLinksForMatching = (text: string): string => {
      return text
        // Images: ![alt](url) -> alt
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
        // Inline links: [text](url "title") -> text
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        // Reference links: [text][id] or [text][] -> text
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
        // Autolinks: <https://example.com> -> https://example.com
        .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1');
    };

    // linkifyMarkdown, normalizeText, and stripLinksForMatching are now imported from text-helpers utils

    // Helper function to ensure children have keys when they're arrays
    const ensureChildrenKeys = (children: any): any => {
      if (Array.isArray(children)) {
        return children.map((child, index) => {
          if (React.isValidElement(child) && !child.key) {
            return React.cloneElement(child, { key: `child-${index}` });
          }
          return child;
        });
      }
      return children;
    };

    // Helper function to remove checkbox markdown syntax from children
    // Handles patterns like: "[ ]", "[x]", "[X]", "[*]", "-[ ]", "- [x]", etc.
    const removeCheckboxFromChildren = (children: any): any => {
      // Comprehensive regex to match checkbox patterns at the start
      const checkboxPatterns = [
        /^\s*\[[\s*xX*]\]\s*/,           // [ ], [x], [X], [*]
        /^\s*[-*+]\s*\[[\s*xX*]\]\s*/,   // -[ ], -[x], *[ ], +[ ]
        /^\s*[-*+]\s+\[[\s*xX*]\]\s*/,   // - [ ], - [x], * [ ], + [ ]
      ];

      if (typeof children === 'string') {
        let cleaned = children;
        let patternMatched = false;
        // Try all patterns
        for (const pattern of checkboxPatterns) {
          if (pattern.test(cleaned)) {
            cleaned = cleaned.replace(pattern, '').trim();
            patternMatched = true;
          }
        }
        // Only trim if a pattern was matched, otherwise preserve the string as-is
        // This is important for preserving spaces in code_inline elements
        if (patternMatched) {
          return cleaned.length > 0 ? cleaned : null;
        }
        // No pattern matched, return string as-is (preserves spaces)
        return cleaned;
      }

      if (Array.isArray(children)) {
        const processed = children
          .map((child) => removeCheckboxFromChildren(child))
          .filter((child) => child !== null && child !== undefined);

        // Check and clean first child if it's a string
        if (processed.length > 0 && typeof processed[0] === 'string') {
          let firstChild = processed[0];
          let cleaned = false;

          for (const pattern of checkboxPatterns) {
            if (pattern.test(firstChild)) {
              firstChild = firstChild.replace(pattern, '').trim();
              cleaned = true;
            }
          }

          if (cleaned) {
            if (firstChild.length === 0) {
              return processed.slice(1);
            }
            return [firstChild, ...processed.slice(1)];
          }
        }

        return processed;
      }

      if (children && typeof children === 'object') {
        // Handle React elements
        if ('type' in children && 'props' in children) {
          const childProps = children.props as any;

          // Preserve code_inline elements as-is to maintain their spacing
          // Check if this is a code_inline element by checking its style characteristics
          if (childProps.style) {
            const elementStyle = Array.isArray(childProps.style)
              ? Object.assign({}, ...childProps.style)
              : childProps.style;

            // code_inline elements have:
            // - monospace fontFamily
            // - backgroundColor (for highlighting)
            // - fontSize of 14
            const isCodeInline =
              elementStyle.fontFamily === 'monospace' &&
              elementStyle.backgroundColor !== undefined &&
              (elementStyle.fontSize === 14 || elementStyle.fontSize === undefined);

            if (isCodeInline) {
              // This is a code_inline element, preserve it as-is to maintain spacing
              return children;
            }
          }

          if (childProps.children) {
            const processedChildren = removeCheckboxFromChildren(childProps.children);
            // Use React.cloneElement to properly clone the element
            return React.cloneElement(children, {
              ...childProps,
              children: processedChildren,
            });
          }
        }
      }

      return children;
    };

    // Create a stable key for Markdown component that changes when value changes
    // This ensures proper remounting when content is refreshed/saved
    const markdownKey = useMemo(() => {
      // Create a simple hash from value for the key
      // Use length + first 200 chars + last 200 chars to ensure uniqueness while being performant
      const hash = value.length > 400
        ? `${value.length}-${value.slice(0, 200)}-${value.slice(-200)}`
        : value;
      return `markdown-${hash}-${isPreview}`;
    }, [value, isPreview]);

    // NOTE (web): Strikethrough is "propagated" to nested inline elements.
    // If `~~` wraps inline code, the line color can come from the *parent* text color (often black),
    // even when the inline code text is pink. To make the code segment's strike match its color,
    // we render strikethrough by applying `textDecorationLine` to each child segment instead of
    // relying on a single parent decoration.
    const withLineThrough = (style: any) => {
      const strike = { textDecorationLine: "line-through" as const };
      if (!style) return strike;
      return Array.isArray(style) ? [...style, strike] : [style, strike];
    };

    const renderStrikeThrough = (node: any, children: any) => {
      const parts = Array.isArray(children) ? children : [children];
      return (
        <RNText key={node.key} selectable={true}>
          {parts.map((child, index) => {
            if (child === null || child === undefined || child === false) return null;

            if (typeof child === "string" || typeof child === "number") {
              return (
                <RNText key={`${node.key}-del-${index}`} style={{ textDecorationLine: "line-through" as const }} selectable={true}>
                  {child}
                </RNText>
              );
            }

            if (React.isValidElement(child)) {
              const element = child as React.ReactElement<any>;
              const childProps: any = element.props ?? {};
              if ("style" in childProps) {
                return React.cloneElement(element, {
                  key: `${node.key}-del-${index}`,
                  style: withLineThrough(childProps.style),
                  selectable: true,
                });
              }
              return React.cloneElement(element, { key: `${node.key}-del-${index}`, selectable: true });
            }

            return null;
          })}
        </RNText>
      );
    };

    const renderImage = (node: any) => {
      const src =
        node?.attributes?.src ||
        node?.src ||
        node?.url ||
        node?.href ||
        "";
      const alt = node?.attributes?.alt || node?.alt || "";

      // In preview we use paddingHorizontal: 32, so subtract that to get the available width.
      const availableWidth = Math.max(0, windowWidth - 64);
      const maxWidth = Math.min(availableWidth, 720);

      const meta = src ? imageMeta[src] : undefined;
      const aspectRatio =
        meta && meta.width > 0 && meta.height > 0 ? meta.width / meta.height : 16 / 9;

      // Ensure the image always reserves layout space so following content cannot overlap it.
      return (
        <View key={node.key} style={{ marginTop: 8, marginBottom: 8 }}>
          <Image
            source={{ uri: src }}
            resizeMode="contain"
            style={{
              width: maxWidth,
              aspectRatio,
              borderRadius: 8,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.ring,
              alignSelf: "center",
            }}
            onLoad={(e) => {
              const w = e?.nativeEvent?.source?.width;
              const h = e?.nativeEvent?.source?.height;
              if (!src || !w || !h) return;
              setImageMeta((prev) => {
                const existing = prev[src];
                if (existing && existing.width === w && existing.height === h) return prev;
                return { ...prev, [src]: { width: w, height: h } };
              });
            }}
          />
          {alt ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}>
              {alt}
            </Text>
          ) : null}
        </View>
      );
    };

    // Custom renderer for links (handles tel: and mailto: with Linking API)
    const renderLink = (node: any, children: any, parent: any, styles: any) => {
      const href = node.attributes?.href || node.href || '';

      const handlePress = async () => {
        if (!href) return;

        try {
          // Check if we can open the URL
          const canOpen = await Linking.canOpenURL(href);
          if (canOpen) {
            await Linking.openURL(href);
          } else {
            console.warn(`Cannot open URL: ${href}`);
          }
        } catch (error) {
          console.error(`Error opening URL ${href}:`, error);
        }
      };

      // Use RNText with onPress directly instead of Pressable to maintain inline alignment
      return (
        <RNText key={node.key} style={styles.link} onPress={handlePress} selectable={true}>
          {children}
        </RNText>
      );
    };

    // Custom renderer for checkboxes in task lists and code blocks
    const markdownRules = {
      link: (node: any, children: any, parent: any, styles: any) => renderLink(node, children, parent, styles),
      image: (node: any) => renderImage(node),
      // Some markdown parsers use `img` instead of `image`.
      img: (node: any) => renderImage(node),
      fence: (node: any, children: any, parent: any, styles: any) => {
        // Debug: Log node structure to understand what we're working with
        if (__DEV__) {
          console.log('=== FENCE RENDERER CALLED ===');
          console.log('Node keys:', Object.keys(node));
          console.log('Node content:', node.content);
          console.log('Node source:', node.source);
          console.log('Node info:', node.info);
          console.log('Node language:', node.language);
          console.log('Children:', children);
          console.log('Children type:', typeof children);
        }

        // Extract code and language from the fence node
        // react-native-markdown-display uses node.content for code and node.info for language
        // Try multiple possible properties - preserve newlines for code
        const code = node.content || node.source || extractTextFromChildren(children, true) || '';
        // Language is in node.info (the text after the opening fence)
        const language = (node.info || node.language || '').trim();

        if (__DEV__) {
          console.log('Extracted code length:', code.length);
          console.log('Extracted language:', language);
          console.log('Code preview:', code.substring(0, 100));
        }

        // Always use our custom renderer - don't fall back to default
        // This ensures syntax highlighting is always attempted

        if (__DEV__) {
          console.log('Rendering with SyntaxHighlighter');
        }

        return (
          <View
            key={node.key}
            style={[
              styles.fence,
              {
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.ring,
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
                marginBottom: 8,
              },
            ]}
          >
            <SyntaxHighlighter code={code.trim()} language={language} />
          </View>
        );
      },
      code_block: (node: any, children: any, parent: any, styles: any) => {
        // Extract code from code_block (no language specified)
        // react-native-markdown-display uses node.content for code
        // Try multiple possible properties - preserve newlines for code
        const code = node.content || node.source || extractTextFromChildren(children, true) || '';

        // Always use our custom renderer - don't fall back to default

        return (
          <View
            key={node.key}
            style={[
              styles.code_block,
              {
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.ring,
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
                marginBottom: 8,
              },
            ]}
          >
            <SyntaxHighlighter code={code.trim()} />
          </View>
        );
      },
      code_inline: (node: any, children: any, parent: any, styles: any) => {
        // Extract text content from inline code
        const codeText = node.content || extractTextFromChildren(children) || '';

        // Add space characters at start and end to simulate padding
        // since padding doesn't work on Text components in React Native
        // Use RNText directly to ensure style prop (especially color) is properly applied on web
        return (
          <RNText key={node.key} style={styles.code_inline} selectable={true}>
            {' '}{codeText}{' '}
          </RNText>
        );
      },
      // `~~strike~~` (remark AST uses `del` for strikethrough; some configs use `s`)
      del: (node: any, children: any) => renderStrikeThrough(node, children),
      s: (node: any, children: any) => renderStrikeThrough(node, children),
      list_item: (node: any, children: any, parent: any, styles: any) => {
        // Extract text content from children, removing checkbox syntax for matching
        let childrenText = normalizeText(stripLinksForMatching(extractTextFromChildren(children)));
        // Remove all checkbox patterns from extracted text for better matching
        childrenText = childrenText
          .replace(/^\s*\[[\s*xX*]\]\s*/, '')
          .replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '')
          .replace(/^\s*[-*+]\s+\[[\s*xX*]\]\s*/, '')
          .trim();

        // Try to find the best matching checkbox that hasn't been rendered yet
        let bestMatch: {
          lineIndex: number;
          info: { hasCheckbox: boolean; isChecked: boolean; prefix: string; restText: string; fullMatch: string };
          score: number
        } | null = null;

        for (const { lineIndex, info } of checkboxData) {
          if (renderedCheckboxesRef.current.has(lineIndex)) {
            continue; // Skip already rendered checkboxes
          }

          const { restText, isChecked } = info;
          const restTextNormalized = normalizeText(stripLinksForMatching(restText));

          // Calculate match score (higher is better)
          let score = 0;

          // Check if childrenText only contains checkbox-like patterns (should have been removed)
          // This handles cases where restText is empty but markdown parser includes checkbox syntax
          const childrenTextAfterCheckboxRemoval = childrenText
            .replace(/^\s*\[[\s*xX*]\]\s*/, '')
            .replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '')
            .replace(/^\s*[-*+]\s+\[[\s*xX*]\]\s*/, '')
            .trim();

          if (restTextNormalized === '' && (childrenText === '' || childrenTextAfterCheckboxRemoval === '')) {
            score = 100; // Perfect match for empty text (even if checkbox syntax remains in childrenText)
          } else if (restTextNormalized !== '' && childrenText !== '') {
            // Compare with cleaned childrenText (after checkbox removal)
            const cleanedChildrenText = childrenTextAfterCheckboxRemoval || childrenText;

            if (cleanedChildrenText === restTextNormalized) {
              score = 100; // Exact match
            } else if (cleanedChildrenText.includes(restTextNormalized) || restTextNormalized.includes(cleanedChildrenText)) {
              // Partial match - calculate similarity
              const longer = restTextNormalized.length > cleanedChildrenText.length ? restTextNormalized : cleanedChildrenText;
              const shorter = restTextNormalized.length > cleanedChildrenText.length ? cleanedChildrenText : restTextNormalized;
              score = (shorter.length / longer.length) * 80; // Similarity score
            } else {
              // Check word-level similarity
              const restWords = restTextNormalized.split(/\s+/).filter(w => w.length > 0);
              const childrenWords = cleanedChildrenText.split(/\s+/).filter(w => w.length > 0);
              const commonWords = restWords.filter(w => childrenWords.includes(w));
              if (commonWords.length > 0) {
                score = (commonWords.length / Math.max(restWords.length, childrenWords.length)) * 60;
              }
            }
          } else if (restTextNormalized === '' && childrenTextAfterCheckboxRemoval !== '') {
            // restText is empty but childrenText has content after removing checkbox patterns
            // This shouldn't match, score remains 0
          }

          // Prefer matches with higher scores, and if scores are equal, prefer earlier lines
          // Lower the threshold to 30 to catch more matches
          if (score > 30 && (!bestMatch || score > bestMatch.score || (score === bestMatch.score && lineIndex < bestMatch.lineIndex))) {
            bestMatch = { lineIndex, info, score };
          }
        }

        // Also check if children contain checkbox-like patterns even if matching failed
        // This helps catch cases where the markdown parser includes the checkbox syntax
        const childrenRawText = extractTextFromChildren(children);
        const hasCheckboxPattern = /\[[\s*xX*]\]/.test(childrenRawText) || /[-*+]\s*\[[\s*xX*]\]/.test(childrenRawText);

        if (bestMatch || hasCheckboxPattern) {
          // If we have a best match, use it; otherwise find the first unmatched checkbox
          let checkboxToRender = bestMatch;

          if (!checkboxToRender && hasCheckboxPattern) {
            // Find the first unmatched checkbox line
            // Try to find one that matches the checkbox state in the children
            const checkboxStateMatch = childrenRawText.match(/\[([\s*xX*])\]/);
            const detectedState = checkboxStateMatch ? checkboxStateMatch[1] : null;
            const detectedIsChecked = detectedState === 'x' || detectedState === 'X' || detectedState === '*';

            // First, try to find a checkbox that matches both state and hasn't been rendered
            for (const { lineIndex, info } of checkboxData) {
              if (!renderedCheckboxesRef.current.has(lineIndex)) {
                // Prefer matching checkbox state if detected
                if (detectedState === null || info.isChecked === detectedIsChecked) {
                  checkboxToRender = { lineIndex, info, score: 50 };
                  break;
                }
              }
            }

            // If still no match found, use the first unmatched checkbox anyway (state doesn't matter)
            if (!checkboxToRender) {
              for (const { lineIndex, info } of checkboxData) {
                if (!renderedCheckboxesRef.current.has(lineIndex)) {
                  checkboxToRender = { lineIndex, info, score: 40 };
                  break;
                }
              }
            }

            // If we still don't have a match but detected checkbox pattern, 
            // create a synthetic checkbox from the detected pattern
            // This handles edge cases where checkboxData might be out of sync
            if (!checkboxToRender && detectedState !== null) {
              // Extract text after checkbox pattern
              const textAfterCheckbox = childrenRawText
                .replace(/^\s*[-*+]\s*\[[\s*xX*]\]\s*/, '')
                .replace(/^\s*\[[\s*xX*]\]\s*/, '')
                .trim();

              // Find any checkbox line that matches the text (even if already rendered)
              // This is a fallback for when ref tracking gets out of sync
              for (const { lineIndex, info } of checkboxData) {
                const restTextNormalized = normalizeText(stripLinksForMatching(info.restText));
                const textAfterNormalized = normalizeText(stripLinksForMatching(textAfterCheckbox));
                if (restTextNormalized === textAfterNormalized ||
                  (restTextNormalized === '' && textAfterNormalized === '') ||
                  (restTextNormalized !== '' && textAfterNormalized.includes(restTextNormalized))) {
                  checkboxToRender = { lineIndex, info, score: 35 };
                  break;
                }
              }
            }
          }

          if (checkboxToRender) {
            const { lineIndex, info } = checkboxToRender;
            const { isChecked, restText } = info;

            // Mark this checkbox as rendered
            renderedCheckboxesRef.current.add(lineIndex);

            // Remove checkbox markdown syntax from children before rendering
            let cleanedChildren = removeCheckboxFromChildren(children);

            // Fallback: if cleaning resulted in empty/null, use restText from the checkbox info
            if (!cleanedChildren || (Array.isArray(cleanedChildren) && cleanedChildren.length === 0)) {
              cleanedChildren = restText ? <Text style={styles.body}>{restText}</Text> : null;
            }

            // If cleanedChildren is still problematic, ensure we have valid content
            if (!cleanedChildren && restText) {
              cleanedChildren = <Text style={styles.body}>{restText}</Text>;
            }

            const childrenToRender = cleanedChildren || children;
            const childrenWithKeys = ensureChildrenKeys(childrenToRender);
            // Use View for content area so nested lists (Views) render correctly on native.
            // RNText cannot contain View children—causes jumbled/hidden nested items on mobile.
            return (
              <View key={node.key} style={[styles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
                <Pressable
                  key={`checkbox-${lineIndex}`}
                  onPress={() => {
                    toggleCheckbox(lineIndex);
                  }}
                  style={{ marginRight: 8, marginTop: 4 }}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => {
                      toggleCheckbox(lineIndex);
                    }}
                  />
                </Pressable>
                <View key={`list-item-content-${node.key}`} style={styles.list_item_content}>
                  {childrenWithKeys}
                </View>
              </View>
            );
          }
        }

        // Default list item rendering - ensure proper row layout for regular list items
        const defaultRenderer = renderRules?.list_item;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles);
          // Ensure the rendered component has flexDirection: row
          if (rendered && React.isValidElement(rendered)) {
            const element = rendered as React.ReactElement<{ style?: any; children?: any }>;
            const existingStyle = Array.isArray(element.props.style)
              ? element.props.style
              : element.props.style ? [element.props.style] : [];
            // Ensure children have keys if they're arrays
            const childrenWithKeys = element.props.children ? ensureChildrenKeys(element.props.children) : element.props.children;
            return React.cloneElement(element, {
              style: [
                ...existingStyle,
                { flexDirection: 'row', alignItems: 'flex-start' }
              ],
              children: childrenWithKeys,
            });
          }
          return rendered;
        }
        // Fallback to default rendering with row layout
        // Use View for content so nested lists (Views) render correctly on native.
        const childrenWithKeys = ensureChildrenKeys(children);
        return (
          <View key={node.key} style={[styles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
            <View style={styles.list_item_content}>
              {childrenWithKeys}
            </View>
          </View>
        );
      },
      bullet_list: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.bullet_list}>
            {children}
          </View>
        );
      },
      ordered_list: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.ordered_list}>
            {children}
          </View>
        );
      },
      table: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.table}>
            {children}
          </View>
        );
      },
      thead: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.thead}>
            {children}
          </View>
        );
      },
      tbody: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View key={node.key} style={styles.tbody}>
            {children}
          </View>
        );
      },
      tr: (node: any, children: any, parent: any, styles: any) => {
        // Ensure children is an array for proper rendering
        const rowChildren = Array.isArray(children) ? children : [children];
        return (
          <View
            key={node.key}
            style={[
              styles.tr,
              {
                flexDirection: 'row',
                borderBottomWidth: 1,
                borderBottomColor: colors.ring,
              }
            ]}
          >
            {rowChildren}
          </View>
        );
      },
      th: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View
            key={node.key}
            style={[
              styles.th,
              {
                flex: 1,
                borderWidth: 1,
                borderColor: colors.ring,
                padding: 8,
                backgroundColor: colors.muted,
                minWidth: 0, // Allow flex shrinking
              }
            ]}
          >
            <RNText style={{ fontWeight: 'bold', color: colors.foreground, fontSize: 14 }} selectable={true}>
              {children}
            </RNText>
          </View>
        );
      },
      td: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View
            key={node.key}
            style={[
              styles.td,
              {
                flex: 1,
                borderWidth: 1,
                borderColor: colors.ring,
                padding: 8,
                minWidth: 0, // Allow flex shrinking
              }
            ]}
          >
            <RNText style={{ color: colors.foreground, fontSize: 14 }} selectable={true}>
              {children}
            </RNText>
          </View>
        );
      },
      hr: (node: any, children: any, parent: any, styles: any) => {
        return (
          <View
            key={node.key}
            style={[
              styles.hr,
              {
                backgroundColor: colors.ring,
                height: 1,
                marginTop: 16,
                marginBottom: 16,
                width: "100%",
              },
            ]}
          />
        );
      },
      // Make body selectable - ensure all text children are selectable
      body: (node: any, children: any, parent: any, styles: any) => {
        const defaultRenderer = renderRules?.body;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles);
          if (rendered && React.isValidElement(rendered)) {
            return rendered;
          }
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_body || styles.body}>
            {children}
          </View>
        );
      },
      // Make paragraphs selectable - wrap text content in selectable Text
      paragraph: (node: any, children: any, parent: any, styles: any) => {
        // Helper to check if a child is a text-like component
        const isTextLike = (child: any): boolean => {
          if (child === null || child === undefined || child === false) return false;
          if (typeof child === 'string' || typeof child === 'number') return true;
          if (React.isValidElement(child)) {
            const childType = child.type;
            // Check if it's a Text component (RNText or custom Text)
            if (childType === RNText || (childType as any)?.displayName === 'Text') return true;
            // Check component name
            const typeName = (childType as any)?.name || (childType as any)?.displayName || '';
            if (typeName === 'Text' || typeName === 'RNText') return true;
            // Check if props indicate it's text-like
            const childProps = (child.props || {}) as { children?: any };
            if (childProps.children && (typeof childProps.children === 'string' || typeof childProps.children === 'number')) {
              return true;
            }
          }
          return false;
        };

        // Check if children contain only text (no Views, Images, etc.)
        const childrenArray = React.Children.toArray(children);
        const hasOnlyText = childrenArray.length > 0 && childrenArray.every(isTextLike);

        // If paragraph contains only text, wrap in a single selectable Text
        // This allows selecting the entire paragraph as one unit
        if (hasOnlyText) {
          return (
            <RNText key={node.key} style={styles._VIEW_SAFE_paragraph || styles.paragraph} selectable={true}>
              {children}
            </RNText>
          );
        }

        // Otherwise, render as View but ensure text children are selectable
        // Make sure all text children have selectable prop
        const makeChildrenSelectable = (children: any): any => {
          if (typeof children === 'string' || typeof children === 'number') {
            return <RNText selectable={true}>{children}</RNText>;
          }
          if (Array.isArray(children)) {
            return React.Children.map(children, (child, index) => {
              if (typeof child === 'string' || typeof child === 'number') {
                return <RNText key={index} selectable={true}>{child}</RNText>;
              }
              if (React.isValidElement(child)) {
                const childType = child.type;
                if (childType === RNText || (childType as any)?.displayName === 'Text') {
                  return React.cloneElement(child as React.ReactElement<any>, {
                    selectable: true,
                    key: child.key || index
                  });
                }
                // Recursively process children
                const childProps = (child.props || {}) as { children?: any };
                if (childProps.children !== undefined) {
                  return React.cloneElement(child as React.ReactElement<any>, {
                    key: child.key || index,
                    children: makeChildrenSelectable(childProps.children),
                  });
                }
              }
              return child;
            });
          }
          if (React.isValidElement(children)) {
            const childType = children.type;
            if (childType === RNText || (childType as any)?.displayName === 'Text') {
              return React.cloneElement(children as React.ReactElement<any>, { selectable: true });
            }
            const childrenProps = (children.props || {}) as { children?: any };
            if (childrenProps.children !== undefined) {
              return React.cloneElement(children as React.ReactElement<any>, {
                children: makeChildrenSelectable(childrenProps.children),
              });
            }
          }
          return children;
        };

        const defaultRenderer = renderRules?.paragraph;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles);
          if (rendered && React.isValidElement(rendered)) {
            const element = rendered as React.ReactElement<{ children?: any }>;
            return React.cloneElement(element, {
              children: makeChildrenSelectable(element.props.children || children),
            });
          }
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_paragraph || styles.paragraph}>
            {makeChildrenSelectable(children)}
          </View>
        );
      },
      // Make headings selectable
      heading1: (node: any, children: any, parent: any, styles: any) => {
        const hasOnlyText = React.Children.toArray(children).every((child: any) => {
          if (typeof child === 'string' || typeof child === 'number') return true;
          if (React.isValidElement(child)) {
            const childType = (child.type as any)?.displayName || (child.type as any)?.name || '';
            return childType === 'Text' || childType === 'RNText';
          }
          return false;
        });
        if (hasOnlyText && React.Children.count(children) > 0) {
          return (
            <RNText key={node.key} style={styles._VIEW_SAFE_heading1 || styles.heading1} selectable={true}>
              {children}
            </RNText>
          );
        }
        const defaultRenderer = renderRules?.heading1;
        if (defaultRenderer) {
          return defaultRenderer(node, children, parent, styles);
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_heading1 || styles.heading1}>
            {children}
          </View>
        );
      },
      heading2: (node: any, children: any, parent: any, styles: any) => {
        const hasOnlyText = React.Children.toArray(children).every((child: any) => {
          if (typeof child === 'string' || typeof child === 'number') return true;
          if (React.isValidElement(child)) {
            const childType = (child.type as any)?.displayName || (child.type as any)?.name || '';
            return childType === 'Text' || childType === 'RNText';
          }
          return false;
        });
        if (hasOnlyText && React.Children.count(children) > 0) {
          return (
            <RNText key={node.key} style={styles._VIEW_SAFE_heading2 || styles.heading2} selectable={true}>
              {children}
            </RNText>
          );
        }
        const defaultRenderer = renderRules?.heading2;
        if (defaultRenderer) {
          return defaultRenderer(node, children, parent, styles);
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_heading2 || styles.heading2}>
            {children}
          </View>
        );
      },
      heading3: (node: any, children: any, parent: any, styles: any) => {
        const hasOnlyText = React.Children.toArray(children).every((child: any) => {
          if (typeof child === 'string' || typeof child === 'number') return true;
          if (React.isValidElement(child)) {
            const childType = (child.type as any)?.displayName || (child.type as any)?.name || '';
            return childType === 'Text' || childType === 'RNText';
          }
          return false;
        });
        if (hasOnlyText && React.Children.count(children) > 0) {
          return (
            <RNText key={node.key} style={styles._VIEW_SAFE_heading3 || styles.heading3} selectable={true}>
              {children}
            </RNText>
          );
        }
        const defaultRenderer = renderRules?.heading3;
        if (defaultRenderer) {
          return defaultRenderer(node, children, parent, styles);
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_heading3 || styles.heading3}>
            {children}
          </View>
        );
      },
      heading4: (node: any, children: any, parent: any, styles: any) => {
        const hasOnlyText = React.Children.toArray(children).every((child: any) => {
          if (typeof child === 'string' || typeof child === 'number') return true;
          if (React.isValidElement(child)) {
            const childType = (child.type as any)?.displayName || (child.type as any)?.name || '';
            return childType === 'Text' || childType === 'RNText';
          }
          return false;
        });
        if (hasOnlyText && React.Children.count(children) > 0) {
          return (
            <RNText key={node.key} style={styles._VIEW_SAFE_heading4 || styles.heading4} selectable={true}>
              {children}
            </RNText>
          );
        }
        const defaultRenderer = renderRules?.heading4;
        if (defaultRenderer) {
          return defaultRenderer(node, children, parent, styles);
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_heading4 || styles.heading4}>
            {children}
          </View>
        );
      },
      heading5: (node: any, children: any, parent: any, styles: any) => {
        const hasOnlyText = React.Children.toArray(children).every((child: any) => {
          if (typeof child === 'string' || typeof child === 'number') return true;
          if (React.isValidElement(child)) {
            const childType = (child.type as any)?.displayName || (child.type as any)?.name || '';
            return childType === 'Text' || childType === 'RNText';
          }
          return false;
        });
        if (hasOnlyText && React.Children.count(children) > 0) {
          return (
            <RNText key={node.key} style={styles._VIEW_SAFE_heading5 || styles.heading5} selectable={true}>
              {children}
            </RNText>
          );
        }
        const defaultRenderer = renderRules?.heading5;
        if (defaultRenderer) {
          return defaultRenderer(node, children, parent, styles);
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_heading5 || styles.heading5}>
            {children}
          </View>
        );
      },
      heading6: (node: any, children: any, parent: any, styles: any) => {
        const hasOnlyText = React.Children.toArray(children).every((child: any) => {
          if (typeof child === 'string' || typeof child === 'number') return true;
          if (React.isValidElement(child)) {
            const childType = (child.type as any)?.displayName || (child.type as any)?.name || '';
            return childType === 'Text' || childType === 'RNText';
          }
          return false;
        });
        if (hasOnlyText && React.Children.count(children) > 0) {
          return (
            <RNText key={node.key} style={styles._VIEW_SAFE_heading6 || styles.heading6} selectable={true}>
              {children}
            </RNText>
          );
        }
        const defaultRenderer = renderRules?.heading6;
        if (defaultRenderer) {
          return defaultRenderer(node, children, parent, styles);
        }
        return (
          <View key={node.key} style={styles._VIEW_SAFE_heading6 || styles.heading6}>
            {children}
          </View>
        );
      },
      // Make text selectable on mobile
      text: (node: any, children: any, parent: any, styles: any, inheritedStyles: any = {}) => {
        const defaultRenderer = renderRules?.text;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles, inheritedStyles);
          if (rendered && React.isValidElement(rendered)) {
            return React.cloneElement(rendered as React.ReactElement<any>, { selectable: true });
          }
        }
        return (
          <RNText key={node.key} style={[inheritedStyles, styles.text]} selectable={true}>
            {node.content}
          </RNText>
        );
      },
      textgroup: (node: any, children: any, parent: any, styles: any) => {
        const defaultRenderer = renderRules?.textgroup;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles);
          if (rendered && React.isValidElement(rendered)) {
            return React.cloneElement(rendered as React.ReactElement<any>, { selectable: true });
          }
        }
        return (
          <RNText key={node.key} style={styles.textgroup} selectable={true}>
            {children}
          </RNText>
        );
      },
      strong: (node: any, children: any, parent: any, styles: any) => {
        const defaultRenderer = renderRules?.strong;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles);
          if (rendered && React.isValidElement(rendered)) {
            return React.cloneElement(rendered as React.ReactElement<any>, { selectable: true });
          }
        }
        return (
          <RNText key={node.key} style={styles.strong} selectable={true}>
            {children}
          </RNText>
        );
      },
      em: (node: any, children: any, parent: any, styles: any) => {
        const defaultRenderer = renderRules?.em;
        if (defaultRenderer) {
          const rendered = defaultRenderer(node, children, parent, styles);
          if (rendered && React.isValidElement(rendered)) {
            return React.cloneElement(rendered as React.ReactElement<any>, { selectable: true });
          }
        }
        return (
          <RNText key={node.key} style={styles.em} selectable={true}>
            {children}
          </RNText>
        );
      },
    };

    const handleWebKeyDown = (e: any) => {
      // On web, `Tab` defaults to moving focus. Instead, insert spaces (same as toolbar "Tab").
      handleTabKey(e);
    };

    const previewValue = useMemo(() => {
      if (!isPreview) return value;
      return linkifyMarkdown(value);
    }, [value, isPreview]);

    return (
      <View className={cn("flex-1", className)}>
        {/* Editor or Preview */}
        {isPreview ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 32,
              paddingTop: 20,
              paddingBottom: 80,
            }}
            removeClippedSubviews={false}
            nestedScrollEnabled={true}
          >
            {value ? (
              <Markdown
                key={markdownKey}
                style={markdownStyles}
                rules={markdownRules}
                mergeStyle={false}
              >
                {previewValue}
              </Markdown>
            ) : (
              <Text className="text-muted-foreground italic">{placeholder}</Text>
            )}
          </ScrollView>
        ) : (
          <Input
            ref={inputRef}
            className="flex-1 border-0 shadow-none bg-transparent text-base leading-6 font-mono px-8"
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            value={value}
            onChangeText={handleTextChange}
            selection={selection}
            {...(Platform.OS === "web" ? ({ onKeyDown: handleWebKeyDown } as any) : {})}
            onSelectionChange={(e) => {
              const next = e.nativeEvent.selection;
              const pending = pendingSelectionRef.current;

              // During programmatic updates, ignore transient selection events (often {0,0} on Android)
              if (isProcessingListRef.current || suppressSelectionUpdatesRef.current > 0) {
                if (!pending || pending.start !== next.start || pending.end !== next.end) {
                  return;
                }
              }

              const sel = { start: next.start, end: next.end };
              setSelectionBoth(sel);
              onSelectionChange?.(sel);
            }}
            multiline
            blurOnSubmit={false}
            textAlignVertical="top"
            style={{
              paddingHorizontal: 32,
              paddingTop: 30,
              paddingBottom: 65,
              fontFamily: Platform.select({
                web: "Iosevka, monospace",
                default: "Iosevka",
              }),
              flex: 1,
            }}
          />
        )}
      </View>
    );
  }
);
