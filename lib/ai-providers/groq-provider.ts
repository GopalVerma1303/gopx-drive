/**
 * Groq AI Provider Implementation
 *
 * Groq API is compatible with OpenAI's format and provides fast inference.
 * Get your API key from: https://console.groq.com/
 */

import type { AIGenerateOptions, AIProvider } from "./types";
import { buildContextAwarePrompt } from "./prompt-builder";

const GROQ_API_BASE_URL = "https://api.groq.com/openai/v1";

export interface GroqResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  error?: {
    message: string;
    type: string;
  };
}

export class GroqProvider implements AIProvider {
  private defaultModel: string;

  constructor(defaultModel: string = "llama-3.1-8b-instant") {
    this.defaultModel = defaultModel;
  }

  getName(): "groq" {
    return "groq";
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async generate(options: AIGenerateOptions): Promise<string> {
    const apiKey = options.apiKey || process.env.EXPO_PUBLIC_GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Groq API key not found. Please set EXPO_PUBLIC_GROQ_API_KEY environment variable or pass apiKey parameter."
      );
    }

    const model = options.model || this.defaultModel;

    // Build context-aware prompt with system message
    const { systemMessage, userMessage } = buildContextAwarePrompt(
      options.prompt,
      options.selectedText
    );

    const url = `${GROQ_API_BASE_URL}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          temperature: options.temperature ?? 0.5, // Lower temperature for more consistent, agent-like behavior
          max_tokens: options.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        const errorData: GroqResponse = await response.json();
        throw new Error(
          errorData.error?.message ||
            `API request failed with status ${response.status}`
        );
      }

      const data: GroqResponse = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from Groq API");
      }

      const generatedText = data.choices[0]?.message?.content || "";

      if (!generatedText) {
        throw new Error("Empty response from Groq API");
      }

      // Clean up the response - remove any common AI prefixes/suffixes
      return this.cleanResponse(generatedText);
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        `Failed to generate content: ${error.message || "Unknown error"}`
      );
    }
  }

  private cleanResponse(text: string): string {
    let cleanedText = text.trim();

    // Remove common AI response patterns and meta-commentary
    const patternsToRemove = [
      // Introductory phrases
      /^Here's.*?:\s*/i,
      /^Here is.*?:\s*/i,
      /^I'll.*?:\s*/i,
      /^I can.*?:\s*/i,
      /^Sure.*?:\s*/i,
      /^Of course.*?:\s*/i,
      /^Certainly.*?:\s*/i,
      /^Let me.*?:\s*/i,
      /^I'll help.*?:\s*/i,
      /^I can help.*?:\s*/i,
      /^Here.*?:\s*/i,

      // Trailing phrases
      /\s*Let me know.*$/i,
      /\s*Is there anything else.*$/i,
      /\s*I hope this helps.*$/i,
      /\s*Hope this helps.*$/i,
      /\s*Does this help\?.*$/i,
      /\s*Let me know if.*$/i,

      // Markdown headers that shouldn't be there (for simple replacements)
      /^#+\s+(.+)$/m, // Remove standalone markdown headers at start

      // Code blocks wrapping simple text
      /^```[\w]*\n(.+)\n```$/s,

      // Quotes wrapping content
      /^["'](.+)["']$/,

      // Parenthetical explanations
      /\s*\([^)]*here[^)]*\)/i,
      /\s*\([^)]*note[^)]*\)/i,
    ];

    for (const pattern of patternsToRemove) {
      cleanedText = cleanedText.replace(pattern, "$1").trim();
    }

    // Remove leading markdown headers if they're standalone (not part of formatted content)
    // Only remove if the entire response is just a header
    const headerOnlyPattern = /^(#+\s+)(.+)$/;
    const headerMatch = cleanedText.match(headerOnlyPattern);
    if (headerMatch && cleanedText.split("\n").length === 1) {
      // If it's a single-line header, extract just the text
      cleanedText = headerMatch[2].trim();
    }

    // Remove any remaining markdown header prefixes from single-word responses
    // This handles cases like "# delicious" -> "delicious"
    if (cleanedText.match(/^#+\s+\w+$/)) {
      cleanedText = cleanedText.replace(/^#+\s+/, "").trim();
    }

    // Remove code fence markers if they wrap simple text
    if (cleanedText.startsWith("```") && cleanedText.endsWith("```")) {
      const lines = cleanedText.split("\n");
      if (lines.length <= 3) {
        // Simple code block, extract content
        cleanedText = lines.slice(1, -1).join("\n").trim();
      }
    }

    return cleanedText.trim();
  }
}
