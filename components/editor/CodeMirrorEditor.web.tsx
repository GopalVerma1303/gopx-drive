import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, ScrollView, Text, Pressable } from 'react-native';
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  HighlightStyle,
} from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import ReactMarkdown from 'react-markdown';
import { useThemeColors } from '@/lib/use-theme-colors';
import { detectCheckboxInLine, toggleCheckboxInMarkdown } from '@/components/markdown-toolbar';
import { Checkbox } from '@/components/ui/checkbox';
import { SyntaxHighlighter } from '@/components/syntax-highlighter';

export interface CodeMirrorEditorRef {
  insertText: (text: string, cursorOffset?: number) => void;
  wrapSelection: (before: string, after: string, cursorOffset?: number) => void;
  indent: () => void;
  outdent: () => void;
  undo: () => void;
  redo: () => void;
  focus: () => void;
  getSelection: () => Promise<{ start: number; end: number }>;
}

interface CodeMirrorEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  isPreview?: boolean;
}

export const CodeMirrorEditor = React.forwardRef<
  CodeMirrorEditorRef,
  CodeMirrorEditorProps
>(function CodeMirrorEditor(
  { value, onChangeText, placeholder = 'Start writing in markdown...', className, isPreview = false },
  ref
) {
  const { colors, isDark } = useThemeColors();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const settingsCompartmentRef = useRef<Compartment | null>(null);
  const lastValueRef = useRef<string>(value);
  const renderedCheckboxesRef = useRef<Set<number>>(new Set());

  // Create custom syntax highlighting theme that adapts to light/dark mode
  const customHighlightStyle = useMemo(() => {
    return HighlightStyle.define([
      { tag: tags.heading, color: colors.foreground, fontWeight: 'bold' },
      { tag: tags.strong, color: colors.foreground, fontWeight: 'bold' },
      { tag: tags.emphasis, color: colors.foreground, fontStyle: 'italic' },
      { tag: tags.link, color: colors.primary },
      { tag: tags.quote, color: colors.mutedForeground, fontStyle: 'italic' },
      { tag: tags.monospace, color: isDark ? '#ff69b4' : '#d73a49', backgroundColor: colors.muted },
      { tag: tags.keyword, color: isDark ? '#c792ea' : '#d73a49' },
      { tag: tags.string, color: isDark ? '#c3e88d' : '#032f62' },
      { tag: tags.number, color: isDark ? '#f78c6c' : '#005cc5' },
      { tag: tags.comment, color: isDark ? '#546e7a' : '#6a737d', fontStyle: 'italic' },
      { tag: tags.meta, color: isDark ? '#82aaff' : '#005cc5' },
      { tag: tags.tagName, color: isDark ? '#f07178' : '#22863a' },
      { tag: tags.attributeName, color: isDark ? '#c792ea' : '#6f42c1' },
      { tag: tags.className, color: isDark ? '#ffcb6b' : '#6f42c1' },
      { tag: tags.function(tags.variableName), color: isDark ? '#82aaff' : '#6f42c1' },
    ]);
  }, [isDark, colors.foreground, colors.muted, colors.mutedForeground, colors.primary]);

  // Create theme extension
  const createThemeExtension = useCallback((readOnly: boolean) => {
    const extensions: any[] = [];

    // Use custom highlight style instead of oneDark for better theme responsiveness
    extensions.push(syntaxHighlighting(customHighlightStyle));

    extensions.push(
      EditorView.theme({
        '&': {
          fontSize: '16px',
          fontFamily: 'monospace',
          lineHeight: '1.5',
          backgroundColor: colors.muted,
          color: colors.foreground,
          height: '100%',
        },
        '.cm-content': {
          padding: '16px',
          paddingBottom: '80px', // Add bottom padding for toolbar
          minHeight: '100%',
          outline: 'none',
          backgroundColor: colors.muted,
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
          backgroundColor: colors.muted,
        },
        '.cm-scroller': {
          height: '100%',
          overflow: 'auto',
          backgroundColor: colors.muted,
        },
        '.cm-lineNumbers': {
          minWidth: '40px',
          backgroundColor: colors.muted,
          color: colors.mutedForeground,
        },
        '.cm-gutters': {
          backgroundColor: colors.muted,
          border: 'none',
        },
        '.cm-activeLine': {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        },
        '.cm-selectionMatch': {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        // Selection background styling - CodeMirror uses .cm-selectionBackground
        '.cm-selectionBackground': {
          backgroundColor: isDark ? 'rgba(66, 153, 225, 0.5)' : 'rgba(59, 130, 246, 0.5)',
        },
        '.cm-selection': {
          backgroundColor: isDark ? 'rgba(66, 153, 225, 0.5)' : 'rgba(59, 130, 246, 0.5)',
        },
        '.cm-editor.cm-focused .cm-selectionBackground': {
          backgroundColor: isDark ? 'rgba(66, 153, 225, 0.6)' : 'rgba(59, 130, 246, 0.6)',
        },
        '.cm-editor.cm-focused .cm-selection': {
          backgroundColor: isDark ? 'rgba(66, 153, 225, 0.6)' : 'rgba(59, 130, 246, 0.6)',
        },
      })
    );

    if (readOnly) {
      extensions.push(EditorView.editable.of(false));
      extensions.push(EditorState.readOnly.of(true));
    }

    return extensions;
  }, [isDark, colors.foreground, colors.muted, colors.mutedForeground, customHighlightStyle]);

  // Initialize CodeMirror editor
  useEffect(() => {
    if (isPreview || !editorRef.current || viewRef.current) return;

    const settingsCompartment = new Compartment();
    settingsCompartmentRef.current = settingsCompartment;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      highlightSpecialChars(),
      history(),
      markdown(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const text = update.state.doc.toString();
          if (text !== lastValueRef.current) {
            lastValueRef.current = text;
            onChangeText(text);
          }
        }
      }),
      keymap.of([...historyKeymap, ...defaultKeymap, ...searchKeymap]),
      settingsCompartment.of(createThemeExtension(false)),
    ];

    const state = EditorState.create({
      doc: value || '',
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current!,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isPreview, onChangeText, createThemeExtension]);

  // Update editor content when value changes externally
  useEffect(() => {
    if (isPreview || !viewRef.current) return;

    const currentText = viewRef.current.state.doc.toString();
    if (value !== currentText && value !== lastValueRef.current) {
      lastValueRef.current = value;
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value || '',
        },
      });
    }
  }, [value, isPreview]);

  // Update theme when it changes
  useEffect(() => {
    if (isPreview || !viewRef.current || !settingsCompartmentRef.current) return;

    viewRef.current.dispatch({
      effects: settingsCompartmentRef.current.reconfigure(
        createThemeExtension(false)
      ),
    });
  }, [isDark, colors.foreground, isPreview, createThemeExtension]);

  // Markdown preview styles matching markdown-editor.tsx
  const markdownStyles = useMemo(() => ({
    body: {
      color: colors.foreground,
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: colors.foreground,
      fontSize: 32,
      fontWeight: 'bold' as const,
      marginTop: 16,
      marginBottom: 8,
      lineHeight: 32,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 28,
      fontWeight: 'bold' as const,
      marginTop: 14,
      marginBottom: 7,
      lineHeight: 28,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 24,
      fontWeight: '600' as const,
      marginTop: 12,
      marginBottom: 6,
      lineHeight: 24,
    },
    heading4: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '600' as const,
      marginTop: 10,
      marginBottom: 5,
      lineHeight: 20,
    },
    paragraph: {
      color: colors.foreground,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 8,
      marginBottom: 8,
    },
    strong: {
      fontWeight: 'bold' as const,
      color: colors.foreground,
    },
    em: {
      fontStyle: 'italic' as const,
      color: colors.foreground,
    },
    code_inline: {
      color: '#FF69B4',
      fontSize: 14,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: 14,
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 8,
      fontFamily: 'monospace',
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
      fontFamily: 'monospace',
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
      fontStyle: 'italic' as const,
      color: colors.mutedForeground,
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
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
    },
    link: {
      color: '#3b82f6',
      textDecorationLine: 'underline' as const,
    },
    hr: {
      backgroundColor: colors.ring,
      height: 1,
      marginTop: 16,
      marginBottom: 16,
      borderWidth: 0,
    },
  }), [colors]);

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

  // Helper function to toggle checkbox
  const toggleCheckbox = (lineIndex: number) => {
    const newValue = toggleCheckboxInMarkdown(value, lineIndex);
    if (newValue !== value) {
      onChangeText(newValue);
    }
  };

  // Expose editor control API
  useImperativeHandle(
    ref,
    (): CodeMirrorEditorRef => {
      return {
        insertText(text: string, cursorOffset?: number) {
          if (isPreview || !viewRef.current) return;
          const selection = viewRef.current.state.selection.main;
          const from = selection.from;
          const to = selection.to;
          viewRef.current.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length + (cursorOffset || 0) },
          });
        },
        wrapSelection(before: string, after: string, cursorOffset?: number) {
          if (isPreview || !viewRef.current) return;
          const selection = viewRef.current.state.selection.main;
          const from = selection.from;
          const to = selection.to;
          const selectedText = viewRef.current.state.sliceDoc(from, to);
          const newText = before + selectedText + after;
          viewRef.current.dispatch({
            changes: { from, to, insert: newText },
            selection: {
              anchor: from + before.length + selectedText.length + (cursorOffset || 0),
            },
          });
        },
        indent() {
          if (isPreview || !viewRef.current) return;
          const selection = viewRef.current.state.selection.main;
          const from = selection.from;
          const to = selection.to;
          const changes: any[] = [];

          const fromLine = viewRef.current.state.doc.lineAt(from);
          const toLine = viewRef.current.state.doc.lineAt(to);

          for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
            const line = viewRef.current.state.doc.line(lineNum);
            changes.push({ from: line.from, insert: '  ' });
          }

          viewRef.current.dispatch({ changes });
        },
        outdent() {
          if (isPreview || !viewRef.current) return;
          const selection = viewRef.current.state.selection.main;
          const from = selection.from;
          const to = selection.to;
          const changes: any[] = [];

          const fromLine = viewRef.current.state.doc.lineAt(from);
          const toLine = viewRef.current.state.doc.lineAt(to);

          for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
            const line = viewRef.current.state.doc.line(lineNum);
            const lineText = viewRef.current.state.sliceDoc(line.from, line.to);
            if (lineText.startsWith('  ')) {
              changes.push({ from: line.from, to: line.from + 2, insert: '' });
            } else if (lineText.startsWith('\t')) {
              changes.push({ from: line.from, to: line.from + 1, insert: '' });
            }
          }

          viewRef.current.dispatch({ changes });
        },
        undo() {
          if (isPreview || !viewRef.current) return;
          undo(viewRef.current);
        },
        redo() {
          if (isPreview || !viewRef.current) return;
          redo(viewRef.current);
        },
        focus() {
          if (isPreview || !viewRef.current) return;
          viewRef.current.focus();
        },
        async getSelection() {
          if (isPreview || !viewRef.current) {
            return { start: 0, end: 0 };
          }
          const selection = viewRef.current.state.selection.main;
          return { start: selection.from, end: selection.to };
        },
      };
    },
    [isPreview]
  );

  // Preview mode styles
  const previewContainerStyles = useMemo(() => ({
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 80,
    backgroundColor: 'transparent',
  }), []);

  // Helper to extract text from children
  const extractTextFromChildren = (children: any): string => {
    if (typeof children === 'string') return children.trim();
    if (Array.isArray(children)) {
      return children.map((child) => extractTextFromChildren(child)).join(' ').trim();
    }
    if (children && typeof children === 'object' && 'props' in children) {
      const childProps = children.props as any;
      if (childProps.children) {
        return extractTextFromChildren(childProps.children);
      }
    }
    return '';
  };

  // Helper to normalize text for comparison
  const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
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
      if (patternMatched) {
        return cleaned.length > 0 ? cleaned : null;
      }
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
        if (childProps.style) {
          const elementStyle = Array.isArray(childProps.style)
            ? Object.assign({}, ...childProps.style)
            : childProps.style;

          const isCodeInline =
            elementStyle.fontFamily === 'monospace' &&
            elementStyle.backgroundColor !== undefined &&
            (elementStyle.fontSize === 14 || elementStyle.fontSize === undefined);

          if (isCodeInline) {
            return children;
          }
        }

        if (childProps.children) {
          const processedChildren = removeCheckboxFromChildren(childProps.children);
          return React.cloneElement(children, {
            ...childProps,
            children: processedChildren,
          });
        }
      }
    }

    return children;
  };

  // Clear rendered checkboxes when value changes
  useEffect(() => {
    renderedCheckboxesRef.current.clear();
  }, [value, isPreview]);

  if (isPreview) {
    return (
      <ScrollView 
        style={{ flex: 1, height: '100%' }}
        contentContainerStyle={previewContainerStyles}
      >
        {value ? (
          <ReactMarkdown
            components={{
              h1: ({ children }) => <Text style={markdownStyles.heading1}>{children}</Text>,
              h2: ({ children }) => <Text style={markdownStyles.heading2}>{children}</Text>,
              h3: ({ children }) => <Text style={markdownStyles.heading3}>{children}</Text>,
              h4: ({ children }) => <Text style={markdownStyles.heading4}>{children}</Text>,
              h5: ({ children }) => <Text style={[markdownStyles.heading4, { fontSize: 16 }]}>{children}</Text>,
              h6: ({ children }) => <Text style={[markdownStyles.heading4, { fontSize: 14 }]}>{children}</Text>,
              p: ({ children }) => <Text style={markdownStyles.paragraph}>{children}</Text>,
              strong: ({ children }) => <Text style={markdownStyles.strong}>{children}</Text>,
              em: ({ children }) => <Text style={markdownStyles.em}>{children}</Text>,
              ul: ({ children }) => <View style={markdownStyles.bullet_list}>{children}</View>,
              ol: ({ children }) => <View style={markdownStyles.ordered_list}>{children}</View>,
              li: ({ children, node }) => {
                // Generate a key from node position or use a fallback
                const nodeKey = (node as any)?.key || `li-${Math.random()}`;
                
                // Check if this list item contains a checkbox
                const childrenText = normalizeText(extractTextFromChildren(children));
                let bestMatch: typeof checkboxData[0] | null = null;

                for (const { lineIndex, info } of checkboxData) {
                  if (renderedCheckboxesRef.current.has(lineIndex)) continue;
                  
                  const restTextNormalized = normalizeText(info.restText);
                  if (restTextNormalized === '' && childrenText === '') {
                    bestMatch = { lineIndex, info };
                    break;
                  } else if (restTextNormalized !== '' && childrenText.includes(restTextNormalized)) {
                    bestMatch = { lineIndex, info };
                    break;
                  }
                }

                // Also check if children contain checkbox pattern
                const childrenRawText = extractTextFromChildren(children);
                const hasCheckboxPattern = /\[[\s*xX*]\]/.test(childrenRawText);

                if (bestMatch || hasCheckboxPattern) {
                  const checkboxToRender = bestMatch || checkboxData.find(
                    ({ lineIndex }) => !renderedCheckboxesRef.current.has(lineIndex)
                  );

                  if (checkboxToRender) {
                    const { lineIndex, info } = checkboxToRender;
                    renderedCheckboxesRef.current.add(lineIndex);

                    // Remove checkbox markdown from children using comprehensive function
                    let cleanedChildren = removeCheckboxFromChildren(children);

                    // Fallback: if cleaning resulted in empty/null, use restText from the checkbox info
                    if (!cleanedChildren || (Array.isArray(cleanedChildren) && cleanedChildren.length === 0)) {
                      cleanedChildren = info.restText ? <Text style={markdownStyles.paragraph}>{info.restText}</Text> : null;
                    }

                    // If cleanedChildren is still problematic, ensure we have valid content
                    if (!cleanedChildren && info.restText) {
                      cleanedChildren = <Text style={markdownStyles.paragraph}>{info.restText}</Text>;
                    }

                    return (
                      <View key={nodeKey} style={[markdownStyles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
                        <Pressable
                          onPress={() => toggleCheckbox(lineIndex)}
                          style={{ marginRight: 8, marginTop: 4.5 }}
                        >
                          <Checkbox
                            checked={info.isChecked}
                            onCheckedChange={() => toggleCheckbox(lineIndex)}
                          />
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          {cleanedChildren || null}
                        </View>
                      </View>
                    );
                  }
                }

                // Regular list item
                return (
                  <View key={nodeKey} style={[markdownStyles.list_item, { flexDirection: 'row', alignItems: 'flex-start' }]}>
                    <Text>• </Text>
                    <View style={{ flex: 1 }}>{children}</View>
                  </View>
                );
              },
              code: ({ children, className }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <Text style={markdownStyles.code_inline}>
                      {' '}{children}{' '}
                    </Text>
                  );
                }
                // Code block - extract code and language
                const code = typeof children === 'string' ? children : extractTextFromChildren(children);
                const language = className?.replace('language-', '') || '';
                return (
                  <View style={markdownStyles.fence}>
                    <SyntaxHighlighter code={code.trim()} language={language} />
                  </View>
                );
              },
              pre: ({ children }) => {
                const code = extractTextFromChildren(children);
                return (
                  <View style={markdownStyles.code_block}>
                    <SyntaxHighlighter code={code.trim()} />
                  </View>
                );
              },
              blockquote: ({ children }) => (
                <View style={markdownStyles.blockquote}>
                  <Text>{children}</Text>
                </View>
              ),
              a: ({ href, children }) => (
                <Text 
                  style={markdownStyles.link}
                  onPress={() => {
                    if (href && typeof window !== 'undefined') {
                      window.open(href, '_blank');
                    }
                  }}
                >
                  {children}
                </Text>
              ),
              hr: () => <View style={markdownStyles.hr} />,
              img: ({ src, alt }) => (
                <View style={{ marginVertical: 16 }}>
                  <Text style={{ color: colors.mutedForeground }}>[Image: {alt || src}]</Text>
                </View>
              ),
            }}
          >
            {value}
          </ReactMarkdown>
        ) : (
          <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>
            {placeholder}
          </Text>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, height: '100%' }}>
      <div ref={editorRef} style={{ flex: 1, height: '100%' }} />
    </View>
  );
});

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
