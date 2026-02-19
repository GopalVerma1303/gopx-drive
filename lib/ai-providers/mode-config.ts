/**
 * AI Mode Configuration
 * 
 * Maps different AI modes to their corresponding Groq models and system prompts.
 * Each mode is optimized for a specific use case.
 */

export type AIMode =
  | "friendly"
  | "professional"
  | "concise"
  | "summary"
  | "key-points"
  | "list"
  | "table"
  | "code"
  | "proofread"
  | "rewrite";

export interface ModeConfig {
  label: string;
  model: string;
  description: string;
  systemPromptEnhancement: string;
  temperature?: number; // Mode-specific temperature for optimal output
  maxTokens?: number; // Mode-specific max tokens if needed
}

/**
 * Mode-to-model mapping based on Groq's free tier models
 * Optimized for each use case
 */
export const MODE_CONFIGS: Record<AIMode, ModeConfig> = {
  friendly: {
    label: "Friendly",
    model: "llama-3.1-8b-instant", // Fast, friendly responses
    description: "Warm and conversational tone",
    systemPromptEnhancement:
      "Use a warm, friendly, and conversational tone. Be approachable and engaging. Write as if talking to a friend.",
    temperature: 0.7, // Slightly higher for more natural, friendly responses
  },
  professional: {
    label: "Professional",
    model: "llama-3.3-70b-versatile", // Best for professional writing
    description: "Formal and polished writing",
    systemPromptEnhancement:
      "Use a formal, professional, and polished tone. Maintain clarity, precision, and business-appropriate language. Avoid casual expressions.",
    temperature: 0.5, // Balanced for consistent professional tone
  },
  concise: {
    label: "Concise",
    model: "llama-3.1-8b-instant", // Fast, production-ready model optimized for brevity
    description: "Brief and to the point",
    systemPromptEnhancement:
      "Be extremely concise and direct. Use the minimum words necessary to convey the meaning. Eliminate all unnecessary words, filler phrases, and redundancy. Get straight to the point.",
    temperature: 0.3, // Lower temperature for more focused, precise output
  },
  summary: {
    label: "Summary",
    model: "llama-3.1-8b-instant", // 128K context, production model for comprehensive summaries
    description: "Comprehensive summaries",
    systemPromptEnhancement:
      "Provide a comprehensive summary that captures all key information and main points. Maintain the essential structure and hierarchy of the original content. Be thorough yet concise. Leverage the full context window to ensure nothing important is missed.",
    temperature: 0.4, // Lower for factual accuracy in summaries
    maxTokens: 4096, // Higher token limit for comprehensive summaries
  },
  "key-points": {
    label: "Key Points",
    model: "llama-3.3-70b-versatile", // Groq-recommended replacement for mixtral; strong extraction
    description: "Extract main points",
    systemPromptEnhancement:
      "Extract and present only the key points. Use bullet points or numbered lists. Be precise, focused, and comprehensive. Each point should be distinct and meaningful. Leverage the large context window to analyze the entire content thoroughly.",
    temperature: 0.3, // Lower for precise extraction
    maxTokens: 2048, // Sufficient for key points
  },
  list: {
    label: "List",
    model: "llama-3.3-70b-versatile", // Groq replacement for 3.1; best for structured output
    description: "Structured list format",
    systemPromptEnhancement:
      "Format the output as a clear, well-structured list. Use appropriate list formatting (bullets or numbers). Ensure items are parallel in structure and consistent in style. Make the list easy to scan and understand.",
    temperature: 0.5, // Balanced for structured output
  },
  table: {
    label: "Table",
    model: "llama-3.3-70b-versatile", // Groq replacement for tool-use models; superior tool use capabilities
    description: "Tabular data format",
    systemPromptEnhancement:
      "Format the output as a markdown table with appropriate headers and columns. Ensure data is well-organized, consistent, and properly aligned. Use clear column headers that accurately describe the data. Ensure all rows follow the same format. The table must be valid markdown table syntax with proper alignment.",
    temperature: 0.2, // Very low for precise table formatting
    maxTokens: 3072, // Higher limit for complex tables
  },
  code: {
    label: "Code",
    model: "openai/gpt-oss-120b", // Groq replacement for deepseek-r1; has reasoning & code execution
    description: "Code generation and explanation",
    systemPromptEnhancement:
      "Focus on code quality, best practices, and clear implementation. Provide well-commented, production-ready code when appropriate. Follow language-specific conventions and patterns. Ensure code is efficient, readable, and maintainable. Think step-by-step and reason through the solution before providing code.",
    temperature: 0.2, // Very low for precise, deterministic code
    maxTokens: 4096, // Higher limit for complex code
  },
  proofread: {
    label: "Proofread",
    model: "llama-3.3-70b-versatile", // Best for quality editing
    description: "Fix grammar, spelling, and clarity",
    systemPromptEnhancement:
      "Proofread and correct the text. Fix grammar, spelling, punctuation, and improve clarity while preserving the original meaning and style. Output only the corrected text without explanations.",
  },
  rewrite: {
    label: "Rewrite",
    model: "llama-3.3-70b-versatile", // Best for rewriting tasks
    description: "Rewrite content in a new way",
    systemPromptEnhancement:
      "Rewrite the content in a fresh, engaging way while maintaining the core message and meaning. Improve flow, clarity, and readability. Output only the rewritten text.",
  },
};

/**
 * Get the default mode
 */
export const DEFAULT_MODE: AIMode = "friendly";

/**
 * Get mode configuration
 */
export function getModeConfig(mode: AIMode): ModeConfig {
  return MODE_CONFIGS[mode] || MODE_CONFIGS[DEFAULT_MODE];
}

/**
 * Get all available modes
 */
export function getAllModes(): AIMode[] {
  return Object.keys(MODE_CONFIGS) as AIMode[];
}
