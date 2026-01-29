/**
 * List detection and processing utilities for markdown editor
 */

import type { ListInfo, MarkerType } from "../types";
import {
  alphabetToNumber,
  incrementAlphabet,
  isValidRoman,
  numberToRoman,
  romanToNumber,
} from "./list-markers";

/**
 * Detect marker type from previous list items (context-aware detection)
 * Production-grade approach: look at the most recent list item with same indentation to determine marker type
 * This solves the ambiguity: "xcix. gopal" followed by "c. mango" - "c" should be roman (100), not alphabet
 *
 * AMBIGUOUS CASES DOCUMENTATION:
 *
 * Single character lowercase letters that are valid Roman numerals:
 * - i (1), v (5), x (10), l (50), c (100), d (500), m (1000)
 *
 * Single character uppercase letters that are valid Roman numerals:
 * - I (1), V (5), X (10), L (50), C (100), D (500), M (1000)
 *
 * Multi-character sequences that could be either alphabet or Roman:
 * - "cd" (alphabet: c->d, Roman: 400)
 * - "cm" (alphabet: c->m, Roman: 900)
 * - "xl" (alphabet: x->l, Roman: 40)
 * - "xc" (alphabet: x->c, Roman: 90)
 * - "iv" (alphabet: i->v, Roman: 4)
 * - "ix" (alphabet: i->x, Roman: 9)
 * - "di" (alphabet: d->i, Roman: 501)
 * - "dc" (alphabet: d->c, Roman: 600)
 * - "dm" (alphabet: d->m, Roman: 500)
 * - "li" (alphabet: l->i, Roman: 51)
 * - "lx" (alphabet: l->x, Roman: 60)
 * - "ci" (alphabet: c->i, Roman: 101)
 * - "cv" (alphabet: c->v, Roman: 105)
 *
 * PRIORITY ORDER: numerical > roman > alphabetical
 *
 * RULES:
 * 1. When there is confusion between characters that are valid Roman (i, c, x, v, l, d, m),
 *    treat them as Roman (Roman has higher priority than alphabetical).
 * 2. When context is available (back-to-back items), observe the list and act accordingly:
 *    - Previous items "a.", "b.", "c." -> continue alphabet
 *    - Previous items "i.", "ii.", "iii." or "xcix.", "c." -> continue Roman
 * 3. Single characters that are valid Roman, with no context -> Roman
 * 4. Multi-character ambiguous (cd, cm, etc.) with no context -> Roman (roman > alphabetical)
 */
export const detectMarkerTypeFromContext = (
  lines: string[],
  currentLineIndex: number,
  currentIndent: string,
): MarkerType | null => {
  let foundAlphabetSequence = false;
  let foundRomanSequence = false;
  let alphabetCount = 0;
  let romanCount = 0;

  // Look backwards at previous lines with the same indentation level
  // Collect evidence from multiple lines to make a stronger determination
  for (let i = currentLineIndex - 1; i >= 0; i--) {
    const line = lines[i] || "";

    // Skip blank lines (they don't break list context)
    if (line.trim() === "") continue;

    // Check if this line has the same indentation (same list level)
    const lineIndentMatch = line.match(/^(\s*)/);
    const lineIndent = lineIndentMatch ? lineIndentMatch[1] : "";

    // If indentation is less, we've left the list
    if (lineIndent.length < currentIndent.length) break;

    // If indentation is more, it's nested - skip it
    if (lineIndent.length > currentIndent.length) continue;

    // Same indentation - check for ordered list markers
    // Collect evidence from multiple lines for stronger detection

    // Check for numeric: 1., 2., 3., etc.
    const numericMatch = line.match(/^(\s*)(\d+)\.\s+/);
    if (numericMatch && numericMatch[1] === currentIndent) {
      return "numeric";
    }

    // Check for uppercase alphabet: A., B., C., etc.
    const upperAlphaMatch = line.match(/^(\s*)([A-Z]+)\.\s+/);
    if (
      upperAlphaMatch &&
      upperAlphaMatch[1] === currentIndent &&
      /^[A-Z]+$/.test(upperAlphaMatch[2])
    ) {
      // If it's NOT a valid roman numeral, it's definitely alphabet
      if (!isValidRoman(upperAlphaMatch[2])) {
        return "uppercase-alpha";
      }
      // If it IS a valid roman numeral (like "I", "V", "X", "C", "D", "M"), check further
      // But uppercase single letters are more likely to be Roman numerals
      if (upperAlphaMatch[2].length === 1) {
        foundRomanSequence = true;
        romanCount++;
      } else {
        // Multi-character uppercase - check if it's a valid alphabet sequence
        // If it's "AA", "AB", "AC" pattern, it's alphabet
        // If it's "II", "III", "IV", "IX", etc., it's Roman
        const marker = upperAlphaMatch[2];
        if (isValidRoman(marker)) {
          foundRomanSequence = true;
          romanCount++;
        } else {
          return "uppercase-alpha";
        }
      }
      continue;
    }

    // Check for uppercase roman: I., II., III., etc.
    const upperRomanMatch = line.match(/^(\s*)([IVXLCDM]+)\.\s+/);
    if (
      upperRomanMatch &&
      upperRomanMatch[1] === currentIndent &&
      isValidRoman(upperRomanMatch[2])
    ) {
      // Multi-character Roman numerals are definitely Roman
      if (upperRomanMatch[2].length > 1) {
        return "uppercase-roman";
      }
      // Single character uppercase - could be alphabet or Roman
      // Check for pattern in previous lines
      foundRomanSequence = true;
      romanCount++;
      continue;
    }

    // Check for lowercase alphabet: a., b., c., etc.
    const lowerAlphaMatch = line.match(/^(\s*)([a-z]+)\.\s+/);
    if (lowerAlphaMatch && lowerAlphaMatch[1] === currentIndent) {
      const marker = lowerAlphaMatch[2];
      // If it's NOT a valid roman numeral, it's definitely alphabet
      if (/^[a-z]+$/.test(marker) && !isValidRoman(marker)) {
        foundAlphabetSequence = true;
        alphabetCount++;
        // If we've seen multiple alphabet markers, return alphabet
        if (alphabetCount >= 2) {
          return "lowercase-alpha";
        }
        continue;
      }
      // If it IS a valid roman numeral, check if it's part of an alphabet sequence
      // Look for patterns like "a.", "b.", "c." which would indicate alphabet
      if (marker.length === 1) {
        // Single character - check if previous items form an alphabet sequence
        const prevMarkerNum = alphabetToNumber(marker);
        if (prevMarkerNum > 0 && prevMarkerNum <= 26) {
          // Check if previous line was the previous alphabet letter
          if (i > 0) {
            const prevLine = lines[i - 1] || "";
            const prevLineIndentMatch = prevLine.match(/^(\s*)/);
            const prevLineIndent = prevLineIndentMatch
              ? prevLineIndentMatch[1]
              : "";
            if (prevLineIndent === currentIndent) {
              const prevLowerAlphaMatch = prevLine.match(/^(\s*)([a-z]+)\.\s+/);
              if (
                prevLowerAlphaMatch &&
                prevLowerAlphaMatch[1] === currentIndent
              ) {
                const prevMarker = prevLowerAlphaMatch[2];
                const prevMarkerNum2 = alphabetToNumber(prevMarker);
                // If previous marker is exactly one less, it's an alphabet sequence
                if (
                  prevMarkerNum2 === prevMarkerNum - 1 &&
                  !isValidRoman(prevMarker)
                ) {
                  foundAlphabetSequence = true;
                  alphabetCount++;
                  if (alphabetCount >= 2) {
                    return "lowercase-alpha";
                  }
                  continue;
                }
              }
            }
          }
        }
        // Could be Roman - check further back for Roman patterns
        foundRomanSequence = true;
        romanCount++;
        continue;
      } else {
        // Multi-character - check if it's a valid alphabet sequence (aa, ab, ac, etc.)
        // or a Roman numeral (ii, iii, iv, ix, xl, xc, cd, cm, etc.)
        if (isValidRoman(marker)) {
          // Multi-character Roman numerals are strong evidence
          return "lowercase-roman";
        } else {
          // Multi-character non-Roman = alphabet (aa, ab, ac, etc.)
          foundAlphabetSequence = true;
          alphabetCount++;
          if (alphabetCount >= 1) {
            return "lowercase-alpha";
          }
        }
      }
    }

    // Check for lowercase roman: i., ii., iii., xcix., etc.
    const lowerRomanMatch = line.match(/^(\s*)([ivxlcdm]+)\.\s+/);
    if (
      lowerRomanMatch &&
      lowerRomanMatch[1] === currentIndent &&
      isValidRoman(lowerRomanMatch[2])
    ) {
      // Multi-character roman numerals are definitely roman
      if (lowerRomanMatch[2].length > 1) {
        return "lowercase-roman";
      }
      // Single character - check if there are more roman numerals further back
      // Look for patterns like "i.", "ii.", "iii." which would indicate Roman
      foundRomanSequence = true;
      romanCount++;
      // Check if previous items form a Roman sequence
      if (i > 0 && romanCount === 1) {
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prevLine = lines[j] || "";
          if (prevLine.trim() === "") continue;
          const prevIndentMatch = prevLine.match(/^(\s*)/);
          const prevIndent = prevIndentMatch ? prevIndentMatch[1] : "";
          if (prevIndent.length !== currentIndent.length) break;
          const prevRomanMatch = prevLine.match(/^(\s*)([ivxlcdm]+)\.\s+/);
          if (
            prevRomanMatch &&
            prevRomanMatch[1] === currentIndent &&
            isValidRoman(prevRomanMatch[2])
          ) {
            if (prevRomanMatch[2].length > 1) {
              return "lowercase-roman";
            }
            // Check if it forms a sequence (i -> ii -> iii, or v -> vi -> vii, etc.)
            const currentNum = romanToNumber(lowerRomanMatch[2]);
            const prevNum = romanToNumber(prevRomanMatch[2]);
            if (prevNum > 0 && currentNum === prevNum + 1) {
              return "lowercase-roman";
            }
          }
        }
      }
      // If we've seen multiple Roman markers, return Roman
      if (romanCount >= 2) {
        return "lowercase-roman";
      }
    }
  }

  // After collecting evidence, make a determination
  // Strong alphabet evidence takes precedence
  if (foundAlphabetSequence && alphabetCount >= 2) {
    return "lowercase-alpha";
  }

  // Strong Roman evidence (multi-character or sequence)
  if (foundRomanSequence && romanCount >= 2) {
    return "lowercase-roman";
  }

  // Default to null (ambiguous) - will default to alphabet in main detection logic
  return null;
};

/**
 * Detect list patterns and get next list marker
 */
export const getListInfo = (
  text: string,
  cursorPosition: number,
): ListInfo | null => {
  const lines = text.split("\n");
  const beforeCursor = text.substring(0, cursorPosition);
  const lineIndex = beforeCursor.split("\n").length - 1;
  const currentLine = lines[lineIndex] || "";

  // Match checkbox list FIRST (before unordered) since they share the same prefix: "- [ ] ", "* [ ] ", "+ [ ] " (with optional indentation)
  const checkboxMatch = currentLine.match(
    /^(\s*)([-*+])\s+\[([\s*xX*])\]\s*(.*)$/,
  );
  if (checkboxMatch) {
    const [, indent, marker, checkboxState, content] = checkboxMatch;
    return {
      isList: true,
      indent,
      marker: `${marker} [${checkboxState}] `,
      markerType: "checkbox",
      nextMarker: `${marker} [ ] `,
      currentLine,
      lineIndex,
    };
  }

  // Match ordered list with various marker types
  // IMPORTANT: Check alphabets BEFORE roman numerals to avoid false matches
  // Single letters like "c" are alphabets, not roman numerals (c=100 in roman)

  // Uppercase alphabet: A., B., C., etc.
  // Handle ambiguous cases: I, V, X, L, C, D, M could be alphabet or Roman
  const uppercaseAlphaMatch = currentLine.match(/^(\s*)([A-Z]+)\.\s+(.*)$/);
  if (uppercaseAlphaMatch) {
    const [, indent, alpha, content] = uppercaseAlphaMatch;
    // Verify it's a valid alphabet sequence (not mixed with numbers or other chars)
    if (/^[A-Z]+$/.test(alpha)) {
      // Check context to determine if it's alphabet or Roman
      const contextType = detectMarkerTypeFromContext(lines, lineIndex, indent);

      // If it's NOT a valid roman numeral, it's definitely alphabet
      if (!isValidRoman(alpha)) {
        const nextAlpha = incrementAlphabet(alpha);
        return {
          isList: true,
          indent,
          marker: `${alpha}. `,
          markerType: "ordered",
          markerSubtype: "uppercase-alpha",
          nextMarker: `${nextAlpha}. `,
          currentLine,
          lineIndex,
        };
      }

      // It IS a valid roman numeral - check context
      if (contextType === "uppercase-roman") {
        // Strong Roman context - treat as Roman
        const num = romanToNumber(alpha);
        const nextRoman = numberToRoman(num + 1, true);
        return {
          isList: true,
          indent,
          marker: `${alpha}. `,
          markerType: "ordered",
          markerSubtype: "uppercase-roman",
          nextMarker: `${nextRoman}. `,
          currentLine,
          lineIndex,
        };
      } else if (contextType === "uppercase-alpha") {
        // Alphabet context - treat as alphabet
        const nextAlpha = incrementAlphabet(alpha);
        return {
          isList: true,
          indent,
          marker: `${alpha}. `,
          markerType: "ordered",
          markerSubtype: "uppercase-alpha",
          nextMarker: `${nextAlpha}. `,
          currentLine,
          lineIndex,
        };
      } else {
        // No context - Roman has priority over alphabetical: treat single Roman letters as Roman
        if (alpha.length === 1) {
          // Single character (I, V, X, L, C, D, M) - default to Roman
          const num = romanToNumber(alpha);
          const nextRoman = numberToRoman(num + 1, true);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: "ordered",
            markerSubtype: "uppercase-roman",
            nextMarker: `${nextRoman}. `,
            currentLine,
            lineIndex,
          };
        } else {
          // Multi-character uppercase Roman (II, III, IV, IX, XL, XC, CD, CM, etc.)
          // Default to Roman for multi-character
          const num = romanToNumber(alpha);
          const nextRoman = numberToRoman(num + 1, true);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: "ordered",
            markerSubtype: "uppercase-roman",
            nextMarker: `${nextRoman}. `,
            currentLine,
            lineIndex,
          };
        }
      }
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
      if (
        contextType === "lowercase-roman" &&
        alpha.length === 1 &&
        isValidRoman(alpha)
      ) {
        // Single character "c" in roman context (after "xcix") should be roman numeral 100
        const num = romanToNumber(alpha);
        const nextRoman = numberToRoman(num + 1, false);
        return {
          isList: true,
          indent,
          marker: `${alpha}. `,
          markerType: "ordered",
          markerSubtype: "lowercase-roman",
          nextMarker: `${nextRoman}. `,
          currentLine,
          lineIndex,
        };
      }

      // For single characters: check if it's a valid roman numeral first
      // Priority: numerical > roman > alphabetical. When confused (i, c, x, etc.) -> Roman unless context says alphabet
      if (alpha.length === 1 && isValidRoman(alpha)) {
        // Context from back-to-back items: if previous items are clearly alphabet, use alphabet
        if (contextType === "lowercase-alpha") {
          const nextAlpha = incrementAlphabet(alpha);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: "ordered",
            markerSubtype: "lowercase-alpha",
            nextMarker: `${nextAlpha}. `,
            currentLine,
            lineIndex,
          };
        } else if (contextType === "lowercase-roman") {
          const num = romanToNumber(alpha);
          const nextRoman = numberToRoman(num + 1, false);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: "ordered",
            markerSubtype: "lowercase-roman",
            nextMarker: `${nextRoman}. `,
            currentLine,
            lineIndex,
          };
        } else {
          // No context - Roman has priority: treat i, c, x, v, l, d, m as Roman
          const num = romanToNumber(alpha);
          const nextRoman = numberToRoman(num + 1, false);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: "ordered",
            markerSubtype: "lowercase-roman",
            nextMarker: `${nextRoman}. `,
            currentLine,
            lineIndex,
          };
        }
      }

      // Handle multi-character sequences
      if (alpha.length > 1) {
        // Multi-character: check if it's a valid roman numeral pattern
        if (isValidRoman(alpha)) {
          // It's a valid Roman numeral (like "ii", "iii", "iv", "ix", "xl", "xc", "cd", "cm")
          // Check context to determine if it's part of a Roman sequence or alphabet sequence
          if (contextType === "lowercase-roman") {
            // Strong Roman context - treat as Roman
            const num = romanToNumber(alpha);
            const nextRoman = numberToRoman(num + 1, false);
            return {
              isList: true,
              indent,
              marker: `${alpha}. `,
              markerType: "ordered",
              markerSubtype: "lowercase-roman",
              nextMarker: `${nextRoman}. `,
              currentLine,
              lineIndex,
            };
          } else if (contextType === "lowercase-alpha") {
            // Alphabet context - treat as alphabet (e.g., "cd" as alphabet sequence c->d)
            const nextAlpha = incrementAlphabet(alpha);
            return {
              isList: true,
              indent,
              marker: `${alpha}. `,
              markerType: "ordered",
              markerSubtype: "lowercase-alpha",
              nextMarker: `${nextAlpha}. `,
              currentLine,
              lineIndex,
            };
          } else {
            // No context - Roman has priority over alphabetical: treat as Roman
            const num = romanToNumber(alpha);
            const nextRoman = numberToRoman(num + 1, false);
            return {
              isList: true,
              indent,
              marker: `${alpha}. `,
              markerType: "ordered",
              markerSubtype: "lowercase-roman",
              nextMarker: `${nextRoman}. `,
              currentLine,
              lineIndex,
            };
          }
        } else {
          // NOT a valid roman numeral - definitely alphabet (e.g., "aa", "ab", "ac")
          const nextAlpha = incrementAlphabet(alpha);
          return {
            isList: true,
            indent,
            marker: `${alpha}. `,
            markerType: "ordered",
            markerSubtype: "lowercase-alpha",
            nextMarker: `${nextAlpha}. `,
            currentLine,
            lineIndex,
          };
        }
      }

      // Single character that's NOT a valid roman numeral - definitely alphabet
      if (alpha.length === 1 && !isValidRoman(alpha)) {
        const nextAlpha = incrementAlphabet(alpha);
        return {
          isList: true,
          indent,
          marker: `${alpha}. `,
          markerType: "ordered",
          markerSubtype: "lowercase-alpha",
          nextMarker: `${nextAlpha}. `,
          currentLine,
          lineIndex,
        };
      }
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
    if (
      isValidRoman(roman) &&
      (roman.length > 1 || roman === "I" || roman === "V" || roman === "X")
    ) {
      const num = romanToNumber(roman);
      const nextRoman = numberToRoman(num + 1, true);
      return {
        isList: true,
        indent,
        marker: `${roman}. `,
        markerType: "ordered",
        markerSubtype: "uppercase-roman",
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
      if (contextType === "lowercase-roman") {
        const num = romanToNumber(roman);
        const nextRoman = numberToRoman(num + 1, false);
        return {
          isList: true,
          indent,
          marker: `${roman}. `,
          markerType: "ordered",
          markerSubtype: "lowercase-roman",
          nextMarker: `${nextRoman}. `,
          currentLine,
          lineIndex,
        };
      }

      // If no context or alphabet context, only treat multi-character as roman
      // Single characters without roman context are handled by alphabet handler above
      if (
        roman.length > 1 &&
        (contextType === null || contextType === "lowercase-alpha")
      ) {
        const num = romanToNumber(roman);
        const nextRoman = numberToRoman(num + 1, false);
        return {
          isList: true,
          indent,
          marker: `${roman}. `,
          markerType: "ordered",
          markerSubtype: "lowercase-roman",
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
      markerType: "ordered",
      markerSubtype: "numeric",
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
      markerType: "unordered",
      nextMarker: `${marker} `,
      currentLine,
      lineIndex,
    };
  }

  return null;
};
