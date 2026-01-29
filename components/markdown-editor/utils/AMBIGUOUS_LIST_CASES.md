# Ambiguous List Marker Cases: Roman Numerals vs Alphabetical

This document lists all cases where list markers can be ambiguous between Roman numerals and alphabetical sequences, and how they are handled.

## Problem Statement

When users type ordered list markers like "d.", the system needs to determine whether:

- It's an alphabetical list: `d.` → next should be `e.`
- It's a Roman numeral list: `d.` (500) → next should be `di.` (501)

## Ambiguous Cases

### Single Character Lowercase Letters (Valid Roman Numerals)

These single characters are valid Roman numerals but are also alphabetical letters:

| Character | Roman Value | Alphabet Position | Default Behavior                                                                                  |
| --------- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `i`       | 1           | 9th letter        | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `v`       | 5           | 22nd letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `x`       | 10          | 24th letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `l`       | 50          | 12th letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `c`       | 100         | 3rd letter        | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `d`       | 500         | 4th letter        | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `m`       | 1000        | 13th letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |

### Single Character Uppercase Letters (Valid Roman Numerals)

| Character | Roman Value | Alphabet Position | Default Behavior                                                                                  |
| --------- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `I`       | 1           | 9th letter        | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `V`       | 5           | 22nd letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `X`       | 10          | 24th letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `L`       | 50          | 12th letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `C`       | 100         | 3rd letter        | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `D`       | 500         | 4th letter        | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `M`       | 1000        | 13th letter       | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |

### Multi-Character Sequences (Could Be Either)

These sequences are valid Roman numerals but could also be alphabetical sequences:

| Sequence | Roman Value | Alphabet Meaning          | Default Behavior                                                                                  |
| -------- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `cd`     | 400         | c → d (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `cm`     | 900         | c → m (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `xl`     | 40          | x → l (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `xc`     | 90          | x → c (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `iv`     | 4           | i → v (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `ix`     | 9           | i → x (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `di`     | 501         | d → i (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `dc`     | 600         | d → c (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `dm`     | 500         | d → m (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `li`     | 51          | l → i (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `lx`     | 60          | l → x (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `ci`     | 101         | c → i (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |
| `cv`     | 105         | c → v (alphabet sequence) | **Roman** (priority: roman > alphabetical; use alphabet only when context shows a., b., c., etc.) |

**Note:** Priority is **numerical > roman > alphabetical**. When there is no context, ambiguous markers (single letters i, c, x, etc., and multi-char like cd, xc) are treated as **Roman**.

## Detection Rules

**Priority order: numerical > roman > alphabetical**

### 1. Context-Aware Detection (back-to-back items)

When context is available, the system looks at previous list items with the same indentation:

- **Alphabet context**: If previous items are clearly alphabetical (e.g., `a.`, `b.`, `c.`), continue with alphabet
- **Roman context**: If previous items are clearly Roman (e.g., `ii.`, `iii.`, `xcix.`), continue with Roman

### 2. When there is confusion (ambiguous characters)

Characters that are valid Roman numerals (i, c, x, v, l, d, m) are **identified as Roman** when there is no context, because Roman has higher priority than alphabetical.

### 3. Pattern Recognition

The system recognizes patterns:

- **Alphabet Sequence**: `a.` → `b.` → `c.` → `d.` → `e.`
- **Roman Sequence**: `i.` → `ii.` → `iii.` → `iv.` → `v.`
- **Roman Sequence**: `xcix.` (99) → `c.` (100) → `ci.` (101)

### 4. Default (no context)

- **Single character** that is valid Roman (i, c, x, v, l, d, m) → **Roman**
- **Multi-character** that is valid Roman (cd, xc, etc.) → **Roman**
- Otherwise observe back-to-back items and act accordingly

## Examples

### Example 1: Alphabetical List (context: back-to-back a., b., c.)

```
a. First item
b. Second item
c. Third item
d. Fourth item    ← User types "d."
e. Fifth item     ← System generates "e." (alphabet, because context is a., b., c.)
```

### Example 2: Roman List (Strong Context)

```
xcix. Ninety-ninth item
c. One hundredth item    ← User types "c."
ci. One hundred first    ← System generates "ci." (Roman, because of "xcix" before)
```

### Example 3: Ambiguous Single Character (No Context) – Roman has priority

```
d. First item      ← User types "d." with no previous context
di. Second item    ← System generates "di." (defaults to Roman: d=500 → di=501)
```

### Example 4: Ambiguous Multi-Character (No Context) – Roman has priority

```
cd. First item     ← User types "cd." with no previous context
cdi. Second item   ← System generates "cdi." (Roman: 400 → 401)
```

### Example 5: Common Roman Pattern (No Context)

```
ii. First item     ← User types "ii." with no previous context
iii. Second item  ← System generates "iii." (common Roman pattern)
```

## Implementation Details

The detection logic is implemented in:

- `detectMarkerTypeFromContext()`: Analyzes previous list items to determine context
- `getListInfo()`: Main detection function that applies the rules

## References

This implementation follows best practices from major rich text editors:

- **CKEditor 5**: Uses explicit list type selection to avoid ambiguity
- **Tiptap**: Requires explicit list type specification
- **Common Markdown**: Defaults to numeric lists, but supports type specification

Our approach:

1. **Priority**: numerical > roman > alphabetical
2. When confused (i, c, x, etc.), identify as Roman; otherwise observe back-to-back items and act accordingly
3. Context from previous list items determines alphabet vs Roman when available
