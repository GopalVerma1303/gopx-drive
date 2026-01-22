import { detectCheckboxInLine, toggleCheckboxInMarkdown } from "@/components/markdown-toolbar";
import { SyntaxHighlighter } from "@/components/syntax-highlighter";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import Markdown, { renderRules } from "react-native-markdown-display";

interface MarkdownEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  isPreview?: boolean;
}

export interface MarkdownEditorRef {
  insertText: (text: string, cursorOffset?: number) => void;
  wrapSelection: (before: string, after: string, cursorOffset?: number) => void;
  focus: () => void;
  getSelection: () => { start: number; end: number };
}

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChangeText,
      placeholder = "Start writing in markdown...",
      className,
      isPreview = false,
    },
    ref
  ) {
    const { colors } = useThemeColors();
    const inputRef = useRef<TextInput>(null);
    const [selection, setSelection] = useState({ start: 0, end: 0 });

    useImperativeHandle(ref, () => ({
      insertText: (text: string, cursorOffset?: number) => {
        if (isPreview || !inputRef.current) return;

        const start = selection.start;
        const end = selection.end;
        const beforeText = value.substring(0, start);
        const afterText = value.substring(end);
        const newText = beforeText + text + afterText;
        const newCursorPosition = start + (cursorOffset ?? text.length);

        // Update state immediately - the controlled selection prop will handle cursor positioning
        setSelection({ start: newCursorPosition, end: newCursorPosition });

        onChangeText(newText);

        // Ensure input maintains focus
        inputRef.current?.focus();

        // Set cursor position - use different methods for web vs native
        // Use requestAnimationFrame + timeout to ensure text has been updated
        const setCursorPosition = () => {
          if (Platform.OS === "web") {
            // For web, use DOM API directly
            const input = inputRef.current as any;
            if (input && input.setSelectionRange) {
              input.setSelectionRange(newCursorPosition, newCursorPosition);
            } else if (input && input.selectionStart !== undefined) {
              input.selectionStart = newCursorPosition;
              input.selectionEnd = newCursorPosition;
            }
            setSelection({ start: newCursorPosition, end: newCursorPosition });
          } else {
            // For native, use setNativeProps as fallback (controlled selection prop is primary)
            const input = inputRef.current as any;
            if (input && typeof input.setNativeProps === "function") {
              input.setNativeProps({
                selection: { start: newCursorPosition, end: newCursorPosition },
              });
            }
            // State already updated above, but ensure it's set again after text update
            setSelection({ start: newCursorPosition, end: newCursorPosition });
            inputRef.current?.focus();
          }
        };

        // Use requestAnimationFrame + timeout to ensure text has been updated
        requestAnimationFrame(() => {
          setTimeout(setCursorPosition, Platform.OS === "web" ? 0 : 100);
        });
      },
      wrapSelection: (before: string, after: string, cursorOffset?: number) => {
        if (isPreview || !inputRef.current) return;

        const start = selection.start;
        const end = selection.end;
        const selectedText = value.substring(start, end);

        // If there's selected text, wrap it; otherwise insert the formatting markers
        let newText: string;
        let newCursorPosition: number;

        if (selectedText.length > 0) {
          // Wrap selected text - place cursor at the end of the wrapped text
          newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
          newCursorPosition = start + before.length + selectedText.length + after.length;
        } else {
          // No selection, insert formatting markers with cursor positioned according to cursorOffset
          newText = value.substring(0, start) + before + after + value.substring(end);
          // cursorOffset should position cursor between before and after markers
          // e.g., for "**" + "**" with offset 2, cursor should be at start + 2 (after first "**")
          newCursorPosition = start + (cursorOffset ?? before.length);
        }

        // Update state immediately - the controlled selection prop will handle cursor positioning
        setSelection({ start: newCursorPosition, end: newCursorPosition });

        onChangeText(newText);

        // Ensure input maintains focus
        inputRef.current?.focus();

        // Set cursor position - use different methods for web vs native
        // Use requestAnimationFrame + timeout to ensure text has been updated
        const setCursorPosition = () => {
          if (Platform.OS === "web") {
            // For web, use DOM API directly
            const input = inputRef.current as any;
            if (input && input.setSelectionRange) {
              input.setSelectionRange(newCursorPosition, newCursorPosition);
            } else if (input && input.selectionStart !== undefined) {
              input.selectionStart = newCursorPosition;
              input.selectionEnd = newCursorPosition;
            }
            setSelection({ start: newCursorPosition, end: newCursorPosition });
          } else {
            // For native, use setNativeProps as fallback (controlled selection prop is primary)
            const input = inputRef.current as any;
            if (input && typeof input.setNativeProps === "function") {
              input.setNativeProps({
                selection: { start: newCursorPosition, end: newCursorPosition },
              });
            }
            // State already updated above, but ensure it's set again after text update
            setSelection({ start: newCursorPosition, end: newCursorPosition });
            inputRef.current?.focus();
          }
        };

        // Use requestAnimationFrame + timeout to ensure text has been updated
        requestAnimationFrame(() => {
          setTimeout(setCursorPosition, Platform.OS === "web" ? 0 : 100);
        });
      },
      focus: () => {
        inputRef.current?.focus();
      },
      getSelection: () => selection,
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
        backgroundColor: colors.foreground + "20",
        color: colors.foreground,
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
      link: {
        color: colors.primary,
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
        // Try all patterns
        for (const pattern of checkboxPatterns) {
          cleaned = cleaned.replace(pattern, '').trim();
        }
        return cleaned.length > 0 ? cleaned : null;
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

    // Custom renderer for checkboxes in task lists and code blocks
    const markdownRules = {
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
        return (
          <Text key={node.key} style={styles.code_inline}>
            {' '}{codeText}{' '}
          </Text>
        );
      },
      list_item: (node: any, children: any, parent: any, styles: any) => {
        // Extract text content from children, removing checkbox syntax for matching
        let childrenText = normalizeText(extractTextFromChildren(children));
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
          const restTextNormalized = normalizeText(restText);

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
                const restTextNormalized = normalizeText(info.restText);
                const textAfterNormalized = normalizeText(textAfterCheckbox);
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
            return (
              <View key={node.key} style={[styles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
                <Pressable
                  onPress={() => {
                    toggleCheckbox(lineIndex);
                  }}
                  style={{ marginRight: 8, marginTop: 4.5 }}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => {
                      toggleCheckbox(lineIndex);
                    }}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
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
        const childrenWithKeys = ensureChildrenKeys(children);
        return (
          <View key={node.key} style={[styles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
            {childrenWithKeys}
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
            <Text style={{ fontWeight: 'bold', color: colors.foreground, fontSize: 14 }}>
              {children}
            </Text>
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
            <Text style={{ color: colors.foreground, fontSize: 14 }}>
              {children}
            </Text>
          </View>
        );
      },
    };

    return (
      <View className={cn("flex-1", className)}>
        {/* Editor or Preview */}
        {isPreview ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingTop: 20,
              paddingBottom: 80,
            }}
          >
            {value ? (
              <Markdown
                key={markdownKey}
                style={markdownStyles}
                rules={markdownRules}
                mergeStyle={false}
              >
                {value}
              </Markdown>
            ) : (
              <Text className="text-muted-foreground italic">{placeholder}</Text>
            )}
          </ScrollView>
        ) : (
          <Input
            ref={inputRef}
            className="flex-1 border-0 shadow-none bg-transparent text-base leading-6 text-foreground font-mono"
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            value={value}
            onChangeText={onChangeText}
            selection={selection}
            onSelectionChange={(e) => {
              setSelection({
                start: e.nativeEvent.selection.start,
                end: e.nativeEvent.selection.end,
              });
            }}
            multiline
            blurOnSubmit={false}
            textAlignVertical="top"
            style={{
              paddingHorizontal: 12,
              paddingTop: 30,
              paddingBottom: 65,
              fontFamily: "monospace",
              flex: 1,
            }}
          />
        )}
      </View>
    );
  }
);
