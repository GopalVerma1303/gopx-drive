/**
 * List processing utilities for handling list continuations and renumbering
 */

import { Platform } from 'react-native';
import type { MarkerType } from '../types';
import {
  isValidRoman,
  romanToNumber,
  numberToRoman,
  alphabetToNumber,
  numberToAlphabet,
} from './list-markers';
import { getListInfo } from './list-detection';

const TAB_SPACES = "   ";

/**
 * Renumber ordered list items after a deletion
 */
export const renumberOrderedList = (
  lines: string[],
  startIndex: number,
  indent: string,
  markerSubtype: MarkerType
): string[] => {
  const updatedLines = [...lines];

  // Find the previous list item at the same indentation level to determine starting value
  let currentValue = 1;
  if (startIndex > 0) {
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

    // Look backwards for the previous item at the same indentation
    for (let i = startIndex - 1; i >= 0; i--) {
      const line = updatedLines[i] ?? '';
      if (line.trim() === '') continue;

      const orderedMatch = line.match(orderedRegex);
      if (orderedMatch) {
        const lineIndent = orderedMatch[1] ?? '';
        const lineMarker = orderedMatch[2] ?? '';

        // Validate marker type matches
        let isValidMarker = true;
        if (markerSubtype === 'lowercase-roman' || markerSubtype === 'uppercase-roman') {
          isValidMarker = isValidRoman(lineMarker);
        } else if (markerSubtype === 'lowercase-alpha' || markerSubtype === 'uppercase-alpha') {
          isValidMarker = markerSubtype === 'lowercase-alpha'
            ? /^[a-z]+$/.test(lineMarker)
            : /^[A-Z]+$/.test(lineMarker);
        }

        if (isValidMarker && lineIndent === indent) {
          // Extract the value from the previous marker
          if (markerSubtype === 'numeric') {
            currentValue = parseInt(lineMarker, 10) + 1;
          } else if (markerSubtype === 'lowercase-alpha' || markerSubtype === 'uppercase-alpha') {
            currentValue = alphabetToNumber(lineMarker) + 1;
          } else if (markerSubtype === 'lowercase-roman' || markerSubtype === 'uppercase-roman') {
            currentValue = romanToNumber(lineMarker) + 1;
          }
          break;
        }

        // If indentation is less, we've left this list level
        if (lineIndent.length < indent.length) {
          break;
        }
      } else {
        // If indentation is less, we've left this list level
        const lineIndent = (line.match(/^(\s*)/)?.[1]) ?? '';
        if (lineIndent.length < indent.length) {
          break;
        }
      }
    }
  }

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

  for (let i = startIndex; i < updatedLines.length; i++) {
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

    // Validate marker type matches
    let isValidMarker = true;
    if (markerSubtype === 'lowercase-roman' || markerSubtype === 'uppercase-roman') {
      isValidMarker = isValidRoman(lineMarker);
    } else if (markerSubtype === 'lowercase-alpha' || markerSubtype === 'uppercase-alpha') {
      isValidMarker = markerSubtype === 'lowercase-alpha'
        ? /^[a-z]+$/.test(lineMarker)
        : /^[A-Z]+$/.test(lineMarker);
    }

    if (!isValidMarker) {
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
        nextMarkerStr = `${currentValue}. `;
      } else if (markerSubtype === 'lowercase-alpha') {
        nextMarkerStr = `${numberToAlphabet(currentValue, false)}. `;
      } else if (markerSubtype === 'uppercase-alpha') {
        nextMarkerStr = `${numberToAlphabet(currentValue, true)}. `;
      } else if (markerSubtype === 'lowercase-roman') {
        nextMarkerStr = `${numberToRoman(currentValue, false)}. `;
      } else { // uppercase-roman
        nextMarkerStr = `${numberToRoman(currentValue, true)}. `;
      }

      updatedLines[i] = `${indent}${nextMarkerStr}${lineContent}`;
      currentValue += 1;
      continue;
    }

    // Nested ordered list (more-indented) - don't renumber at this level
    if (lineIndent.length > indent.length) {
      continue;
    }

    // Less indentation indicates we've left this list level.
    break;
  }

  return updatedLines;
};

export { TAB_SPACES };
