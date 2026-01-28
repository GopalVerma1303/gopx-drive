/**
 * List detection and processing utilities for markdown editor
 */

import type { ListInfo, MarkerType } from '../types';
import {
  isValidRoman,
  romanToNumber,
  numberToRoman,
  incrementAlphabet,
  alphabetToNumber,
} from './list-markers';

/**
 * Detect marker type from previous list items (context-aware detection)
 * Production-grade approach: look at the most recent list item with same indentation to determine marker type
 * This solves the ambiguity: "xcix. gopal" followed by "c. mango" - "c" should be roman (100), not alphabet
 */
export const detectMarkerTypeFromContext = (
  lines: string[],
  currentLineIndex: number,
  currentIndent: string
): MarkerType | null => {
  // Look backwards at previous lines with the same indentation level
  for (let i = currentLineIndex - 1; i >= 0; i--) {
    const line = lines[i] || '';

    // Skip blank lines (they don't break list context)
    if (line.trim() === '') continue;

    // Check if this line has the same indentation (same list level)
    const lineIndentMatch = line.match(/^(\s*)/);
    const lineIndent = lineIndentMatch ? lineIndentMatch[1] : '';

    // If indentation is less, we've left the list
    if (lineIndent.length < currentIndent.length) break;

    // If indentation is more, it's nested - skip it
    if (lineIndent.length > currentIndent.length) continue;

    // Same indentation - check for ordered list markers
    // Return the FIRST matching marker type found (most recent list item)

    // Check for numeric: 1., 2., 3., etc.
    const numericMatch = line.match(/^(\s*)(\d+)\.\s+/);
    if (numericMatch && numericMatch[1] === currentIndent) {
      return 'numeric';
    }

    // Check for uppercase alphabet: A., B., C., etc.
    const upperAlphaMatch = line.match(/^(\s*)([A-Z]+)\.\s+/);
    if (upperAlphaMatch && upperAlphaMatch[1] === currentIndent && /^[A-Z]+$/.test(upperAlphaMatch[2])) {
      return 'uppercase-alpha';
    }

    // Check for uppercase roman: I., II., III., etc. (check before lowercase to avoid ambiguity)
    const upperRomanMatch = line.match(/^(\s*)([IVXLCDM]+)\.\s+/);
    if (upperRomanMatch && upperRomanMatch[1] === currentIndent && isValidRoman(upperRomanMatch[2])) {
      return 'uppercase-roman';
    }

    // Check for lowercase roman: i., ii., iii., xcix., etc.
    // This is critical: if previous item was "xcix" (roman), then "c" should be roman too
    const lowerRomanMatch = line.match(/^(\s*)([ivxlcdm]+)\.\s+/);
    if (lowerRomanMatch && lowerRomanMatch[1] === currentIndent && isValidRoman(lowerRomanMatch[2])) {
      // Multi-character roman numerals are definitely roman
      if (lowerRomanMatch[2].length > 1) {
        return 'lowercase-roman';
      }
      // Single character "i" - check if there are more roman numerals further back
      // If we find multi-character roman numerals, this is a roman list
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j] || '';
        if (prevLine.trim() === '') continue;
        const prevIndentMatch = prevLine.match(/^(\s*)/);
        const prevIndent = prevIndentMatch ? prevIndentMatch[1] : '';
        if (prevIndent.length !== currentIndent.length) break;
        const prevRomanMatch = prevLine.match(/^(\s*)([ivxlcdm]+)\.\s+/);
        if (prevRomanMatch && prevRomanMatch[1] === currentIndent && isValidRoman(prevRomanMatch[2]) && prevRomanMatch[2].length > 1) {
          return 'lowercase-roman';
        }
      }
      // Single "i" without clear roman context - ambiguous, return null
      return null;
    }

    // Check for lowercase alphabet: a., b., c., etc.
    const lowerAlphaMatch = line.match(/^(\s*)([a-z]+)\.\s+/);
    if (lowerAlphaMatch && lowerAlphaMatch[1] === currentIndent) {
      const marker = lowerAlphaMatch[2];
      // If it's NOT a valid roman numeral, it's alphabet
      if (/^[a-z]+$/.test(marker) && !isValidRoman(marker)) {
        return 'lowercase-alpha';
      }
      // If it IS a valid roman numeral, we need to check further back
      // This handles cases where "c" could be alphabet or roman
      // Continue searching for more context
      continue;
    }
  }

  return null; // No previous context found
};

/**
 * Detect list patterns and get next list marker
 */
export const getListInfo = (text: string, cursorPosition: number): ListInfo | null => {
  const lines = text.split('\n');
  const beforeCursor = text.substring(0, cursorPosition);
  const lineIndex = beforeCursor.split('\n').length - 1;
  const currentLine = lines[lineIndex] || '';

  // Match checkbox list FIRST (before unordered) since they share the same prefix: "- [ ] ", "* [ ] ", "+ [ ] " (with optional indentation)
  const checkboxMatch = currentLine.match(/^(\s*)([-*+])\s+\[([\s*xX*])\]\s*(.*)$/);
  if (checkboxMatch) {
    const [, indent, marker, checkboxState, content] = checkboxMatch;
    return {
      isList: true,
      indent,
      marker: `${marker} [${checkboxState}] `,
      markerType: 'checkbox',
      nextMarker: `${marker} [ ] `,
      currentLine,
      lineIndex,
    };
  }

  // Match ordered list with various marker types
  // IMPORTANT: Check alphabets BEFORE roman numerals to avoid false matches
  // Single letters like "c" are alphabets, not roman numerals (c=100 in roman)

  // Uppercase alphabet: A., B., C., etc.
  const uppercaseAlphaMatch = currentLine.match(/^(\s*)([A-Z]+)\.\s+(.*)$/);
  if (uppercaseAlphaMatch) {
    const [, indent, alpha, content] = uppercaseAlphaMatch;
    // Verify it's a valid alphabet sequence (not mixed with numbers or other chars)
    if (/^[A-Z]+$/.test(alpha)) {
      const nextAlpha = incrementAlphabet(alpha);
      return {
        isList: true,
        indent,
        marker: `${alpha}. `,
        markerType: 'ordered',
        markerSubtype: 'uppercase-alpha',
        nextMarker: `${nextAlpha}. `,
        currentLine,
        lineIndex,
      };
    }
  }

  // Lowercase alphabet: a., b., c., etc.
  // Check this BEFORE lowercase roman to prevent single letters like "c" from being treated as roman
  // Production-grade: Use context-aware detection to determine marker type
  const lowercaseAlphaMatch = currentLine.match(/^(\s*)([a-z]+)\.\s+(.*)$/);
  if (lowercaseAlphaMatch) {
    const [, indent, alpha, content] = lowercaseAlphaMatch;
    // Verify it's a valid alphabet sequence (not mixed with numbers or other chars)
    if (/^[a-z]+$/.test(alpha)) {
      // Production-grade approach: Check context from previous list items first
      const contextType = detectMarkerTypeFromContext(lines, lineIndex, indent);

      // If context indicates roman numerals, treat ambiguous single chars as roman
      if (contextType === 'lowercase-roman' && alpha.length === 1 && isValidRoman(alpha)) {
        // Single character "c" in roman context (after "xcix") should be roman numeral 100
        const num = romanToNumber(alpha);
        const nextRoman = numberToRoman(num + 1, false);
        return {
          isList: true,
          indent,
          marker: `${alpha}. `,
          markerType: 'ordered',
          markerSubtype: 'lowercase-roman',
          nextMarker: `${nextRoman}. `,
          currentLine,
          lineIndex,
        };
      }

      // For single characters: check if it's a valid roman numeral first
      // Common roman numerals: i (1), v (5), x (10), l (50), c (100), d (500), m (1000)
      // If it's a valid roman numeral, treat as roman (especially for nested lists starting with "i.")
      if (alpha.length === 1 && isValidRoman(alpha)) {
        // Check if there's alphabet context - if previous items are clearly alphabet, use alphabet
        // Otherwise, prefer roman for single-character valid roman numerals (especially "i")
        if (contextType === 'lowercase-alpha') {
          // Previous context is alphabet, so continue with alphabet
          const nextAlpha = incrementAlphabet(alpha);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: 'ordered',
            markerSubtype: 'lowercase-alpha',
            nextMarker: `${nextAlpha}. `,
            currentLine,
            lineIndex,
          };
        } else {
          // No context or roman context - treat as roman (especially for "i" which is commonly roman)
          const num = romanToNumber(alpha);
          const nextRoman = numberToRoman(num + 1, false);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: 'ordered',
            markerSubtype: 'lowercase-roman',
            nextMarker: `${nextRoman}. `,
            currentLine,
            lineIndex,
          };
        }
      }

      // If context indicates alphabet, or no context, treat as alphabet (for multi-character or non-roman single chars)
      if (contextType === 'lowercase-alpha' || contextType === null) {
        // Single character: if it's NOT a valid roman numeral, treat as alphabet
        if (alpha.length === 1 && !isValidRoman(alpha)) {
          const nextAlpha = incrementAlphabet(alpha);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: 'ordered',
            markerSubtype: 'lowercase-alpha',
            nextMarker: `${nextAlpha}. `,
            currentLine,
            lineIndex,
          };
        }
        // Multi-character: check if it's a valid roman numeral pattern
        // If it's NOT a valid roman numeral, treat as alphabet (e.g., "aa", "ab", "ac")
        if (alpha.length > 1 && !isValidRoman(alpha)) {
          const nextAlpha = incrementAlphabet(alpha);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: 'ordered',
            markerSubtype: 'lowercase-alpha',
            nextMarker: `${nextAlpha}. `,
            currentLine,
            lineIndex,
          };
        }
      }
      // If it IS a valid roman numeral (multi-character) and no alphabet context, fall through to roman handler
    }
  }

  // Uppercase roman: I., II., III., etc.
  // Check AFTER alphabets to avoid false matches
  const uppercaseRomanMatch = currentLine.match(/^(\s*)([IVXLCDM]+)\.\s+(.*)$/);
  if (uppercaseRomanMatch) {
    const [, indent, roman, content] = uppercaseRomanMatch;
    // Only treat as roman if it's a valid roman numeral AND not a single letter that could be alphabet
    // Single uppercase letters like "I", "V", "X", "C" are ambiguous, but "I" is typically roman
    // For multi-character or known roman patterns, prefer roman interpretation
    if (isValidRoman(roman) && (roman.length > 1 || roman === 'I' || roman === 'V' || roman === 'X')) {
      const num = romanToNumber(roman);
      const nextRoman = numberToRoman(num + 1, true);
      return {
        isList: true,
        indent,
        marker: `${roman}. `,
        markerType: 'ordered',
        markerSubtype: 'uppercase-roman',
        nextMarker: `${nextRoman}. `,
        currentLine,
        lineIndex,
      };
    }
  }

  // Lowercase roman: i., ii., iii., etc.
  // Check AFTER alphabets to avoid false matches with single letters like "c"
  // Production-grade: Use context-aware detection - if previous items are roman, single chars are roman too
  const lowercaseRomanMatch = currentLine.match(/^(\s*)([ivxlcdm]+)\.\s+(.*)$/);
  if (lowercaseRomanMatch) {
    const [, indent, roman, content] = lowercaseRomanMatch;
    if (isValidRoman(roman)) {
      // Check context from previous list items
      const contextType = detectMarkerTypeFromContext(lines, lineIndex, indent);

      // If context indicates roman numerals, treat single characters as roman too
      // This handles cases like: xcix. (99) -> c. (100) -> ci. (101)
      if (contextType === 'lowercase-roman') {
        const num = romanToNumber(roman);
        const nextRoman = numberToRoman(num + 1, false);
        return {
          isList: true,
          indent,
          marker: `${roman}. `,
          markerType: 'ordered',
          markerSubtype: 'lowercase-roman',
          nextMarker: `${nextRoman}. `,
          currentLine,
          lineIndex,
        };
      }

      // If no context or alphabet context, only treat multi-character as roman
      // Single characters without roman context are handled by alphabet handler above
      if (roman.length > 1 && (contextType === null || contextType === 'lowercase-alpha')) {
        const num = romanToNumber(roman);
        const nextRoman = numberToRoman(num + 1, false);
        return {
          isList: true,
          indent,
          marker: `${roman}. `,
          markerType: 'ordered',
          markerSubtype: 'lowercase-roman',
          nextMarker: `${nextRoman}. `,
          currentLine,
          lineIndex,
        };
      }
    }
  }

  // Match numeric ordered list: "1. ", "2. ", etc. (with optional indentation)
  // This comes last to avoid matching single digits that might be part of roman numerals
  const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (orderedMatch) {
    const [, indent, number, content] = orderedMatch;
    const nextNumber = parseInt(number, 10) + 1;
    return {
      isList: true,
      indent,
      marker: `${number}. `,
      markerType: 'ordered',
      markerSubtype: 'numeric',
      nextMarker: `${nextNumber}. `,
      currentLine,
      lineIndex,
    };
  }

  // Match unordered list: "- ", "* ", "+ " (with optional indentation)
  // This must come AFTER checkbox check to avoid false matches
  const unorderedMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
  if (unorderedMatch) {
    const [, indent, marker, content] = unorderedMatch;
    return {
      isList: true,
      indent,
      marker: `${marker} `,
      markerType: 'unordered',
      nextMarker: `${marker} `,
      currentLine,
      lineIndex,
    };
  }

  return null;
};
