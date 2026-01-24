declare module "react-native-syntax-highlighter" {
  import { Component } from "react";

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
  export const atomOneDark: any;
  export const atomOneLight: any;
  export const docco: any;
  export const monokai: any;
  export const vs2015: any;
  export const solarizedDark: any;
  export const xcode: any;
  const styles: Record<string, any>;
  export default styles;
}

declare module "react-syntax-highlighter/dist/esm/styles/hljs" {
  export const atomOneDark: any;
  export const atomOneLight: any;
  export const docco: any;
  export const monokai: any;
  export const vs2015: any;
  export const solarizedDark: any;
  export const xcode: any;
  const styles: Record<string, any>;
  export default styles;
}

declare module "react-syntax-highlighter/dist/cjs/styles/hljs" {
  export const atomOneDark: any;
  export const atomOneLight: any;
  export const docco: any;
  export const monokai: any;
  export const vs2015: any;
  export const solarizedDark: any;
  export const xcode: any;
  const styles: Record<string, any>;
  export default styles;
}
