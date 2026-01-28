/**
 * Utility functions for converting between different list marker types
 * (numeric, roman numerals, alphabetic)
 */

export type MarkerType = 'numeric' | 'lowercase-alpha' | 'uppercase-alpha' | 'lowercase-roman' | 'uppercase-roman';

/**
 * Convert a number to a Roman numeral string
 */
export const numberToRoman = (num: number, uppercase: boolean = true): string => {
  if (num < 1 || num > 3999) return num.toString();
  const lookup: [string, number][] = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
    ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
  ];
  let roman = '';
  for (const [symbol, value] of lookup) {
    while (num >= value) {
      roman += symbol;
      num -= value;
    }
  }
  return uppercase ? roman : roman.toLowerCase();
};

/**
 * Convert a Roman numeral string to a number
 */
export const romanToNumber = (roman: string): number => {
  const upperRoman = roman.toUpperCase();
  const lookup: Record<string, number> = {
    'M': 1000, 'CM': 900, 'D': 500, 'CD': 400,
    'C': 100, 'XC': 90, 'L': 50, 'XL': 40,
    'X': 10, 'IX': 9, 'V': 5, 'IV': 4, 'I': 1
  };
  let num = 0;
  let i = 0;
  while (i < upperRoman.length) {
    if (i + 1 < upperRoman.length && lookup[upperRoman.substring(i, i + 2)]) {
      num += lookup[upperRoman.substring(i, i + 2)];
      i += 2;
    } else if (lookup[upperRoman[i]]) {
      num += lookup[upperRoman[i]];
      i += 1;
    } else {
      return 0; // Invalid roman numeral
    }
  }
  return num;
};

/**
 * Check if a string is a valid Roman numeral
 */
export const isValidRoman = (str: string): boolean => {
  const upperStr = str.toUpperCase();
  const romanRegex = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  return romanRegex.test(upperStr) && upperStr.length > 0;
};

/**
 * Increment an alphabetic string (a -> b, z -> aa, etc.)
 */
export const incrementAlphabet = (str: string): string => {
  if (!str || str.length === 0) return 'a';
  const isUppercase = str === str.toUpperCase();
  const base = isUppercase ? 'A' : 'a';
  const baseCode = base.charCodeAt(0);

  // Convert string to number (a=1, b=2, ..., z=26, aa=27, etc.)
  let num = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i].toLowerCase();
    const charCode = char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
    num = num * 26 + charCode;
  }

  // Increment
  num += 1;

  // Convert back to alphabet string
  let result = '';
  while (num > 0) {
    num -= 1;
    result = String.fromCharCode(baseCode + (num % 26)) + result;
    num = Math.floor(num / 26);
  }

  return result;
};

/**
 * Convert an alphabetic string to a number
 */
export const alphabetToNumber = (str: string): number => {
  if (!str || str.length === 0) return 0;
  let num = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i].toLowerCase();
    const charCode = char.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
    num = num * 26 + charCode;
  }
  return num;
};

/**
 * Convert a number to an alphabetic string
 */
export const numberToAlphabet = (num: number, uppercase: boolean = false): string => {
  if (num < 1) return uppercase ? 'A' : 'a';
  const base = uppercase ? 'A' : 'a';
  const baseCode = base.charCodeAt(0);
  let result = '';
  let n = num - 1;
  while (n >= 0) {
    result = String.fromCharCode(baseCode + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
};

/**
 * Get the next marker type in cycle: numeric → roman → alphabetical → numeric
 */
export const getNextMarkerType = (
  currentType: MarkerType
): 'numeric' | 'lowercase-roman' | 'lowercase-alpha' => {
  if (currentType === 'numeric') return 'lowercase-roman';
  if (currentType === 'lowercase-roman' || currentType === 'uppercase-roman') return 'lowercase-alpha';
  return 'numeric'; // lowercase-alpha or uppercase-alpha -> numeric
};

/**
 * Get the previous marker type in cycle (for outdent)
 */
export const getPreviousMarkerType = (
  currentType: MarkerType
): 'numeric' | 'lowercase-roman' | 'lowercase-alpha' => {
  if (currentType === 'numeric') return 'lowercase-alpha';
  if (currentType === 'lowercase-alpha' || currentType === 'uppercase-alpha') return 'lowercase-roman';
  return 'numeric'; // lowercase-roman or uppercase-roman -> numeric
};

/**
 * Convert marker type and value to marker string
 */
export const getMarkerString = (
  markerType: 'numeric' | 'lowercase-roman' | 'lowercase-alpha',
  value: number
): string => {
  if (markerType === 'numeric') {
    return `${value}. `;
  } else if (markerType === 'lowercase-roman') {
    return `${numberToRoman(value, false)}. `;
  } else { // lowercase-alpha
    return `${numberToAlphabet(value, false)}. `;
  }
};
