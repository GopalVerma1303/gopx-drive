declare module "react-native-syntax-highlighter" {
  import type * as React from "react";

  export interface SyntaxHighlighterProps {
    language?: string;
    style?: any;
    customStyle?: any;
    highlighter?: "hljs" | "prism" | "highlightjs";
    fontFamily?: string;
    fontSize?: number;
    children?: string | React.ReactNode;
    PreTag?: React.ComponentType<any>;
    CodeTag?: React.ComponentType<any>;
  }

  const SyntaxHighlighter: React.ComponentType<SyntaxHighlighterProps>;
  export default SyntaxHighlighter;
}

declare module "react-syntax-highlighter/styles/hljs" {
  const styles: Record<string, any>;
  export default styles;
  export const atomOneDark: any;
  export const atomOneLight: any;
  export const docco: any;
  export const monokai: any;
  export const vs2015: any;
  export const solarizedDark: any;
  export const xcode: any;
}

declare module "react-syntax-highlighter/dist/esm/styles/hljs" {
  const styles: Record<string, any>;
  export default styles;
  export const atomOneDark: any;
  export const atomOneLight: any;
  export const docco: any;
  export const monokai: any;
  export const vs2015: any;
  export const solarizedDark: any;
  export const xcode: any;
}

declare module "react-syntax-highlighter/dist/cjs/styles/hljs" {
  const styles: Record<string, any>;
  export default styles;
  export const atomOneDark: any;
  export const atomOneLight: any;
  export const docco: any;
  export const monokai: any;
  export const vs2015: any;
  export const solarizedDark: any;
  export const xcode: any;
}
