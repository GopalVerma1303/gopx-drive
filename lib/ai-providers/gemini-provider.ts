/**
 * Google Gemini AI Provider Implementation
 * 
 * Get your API key from: https://ai.google.dev/
 */

import type { AIProvider, AIGenerateOptions } from "./types";
import { buildContextAwarePrompt } from "./prompt-builder";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
    status: string;
  };
}

export class GeminiProvider implements AIProvider {
  private defaultModel: string;

  constructor(defaultModel: string = "gemini-pro") {
    this.defaultModel = defaultModel;
  }

  getName(): "gemini" {
    return "gemini";
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async generate(options: AIGenerateOptions): Promise<string> {
    const apiKey = options.apiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        "Gemini API key not found. Please set EXPO_PUBLIC_GEMINI_API_KEY environment variable or pass apiKey parameter."
      );
    }

    const model = options.model || this.defaultModel;
    
    // Build context-aware prompt with system message
    const { systemMessage, userMessage } = buildContextAwarePrompt(
      options.prompt,
      options.selectedText
    );

    // Gemini uses a different format - combine system and user messages
    // Gemini doesn't have a separate system role, so we prepend system message
    const fullPrompt = `${systemMessage}\n\n${userMessage}`;

    const url = `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.5, // Lower temperature for more consistent, agent-like behavior
            topK: 40,
            topP: 0.95,
            maxOutputTokens: options.maxTokens ?? 2048,
          },
        }),
      });

      if (!response.ok) {
        const errorData: GeminiResponse = await response.json();
        throw new Error(
          errorData.error?.message || `API request failed with status ${response.status}`
        );
      }

      const data: GeminiResponse = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response from Gemini API");
      }

      const generatedText = data.candidates[0]?.content?.parts?.[0]?.text || "";

      if (!generatedText) {
        throw new Error("Empty response from Gemini API");
      }

      // Clean up the response - remove any common AI prefixes/suffixes
      return this.cleanResponse(generatedText);
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error(`Failed to generate content: ${error.message || "Unknown error"}`);
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
    if (headerMatch && cleanedText.split('\n').length === 1) {
      // If it's a single-line header, extract just the text
      cleanedText = headerMatch[2].trim();
    }

    // Remove any remaining markdown header prefixes from single-word responses
    // This handles cases like "# delicious" -> "delicious"
    if (cleanedText.match(/^#+\s+\w+$/)) {
      cleanedText = cleanedText.replace(/^#+\s+/, '').trim();
    }

    // Remove code fence markers if they wrap simple text
    if (cleanedText.startsWith('```') && cleanedText.endsWith('```')) {
      const lines = cleanedText.split('\n');
      if (lines.length <= 3) {
        // Simple code block, extract content
        cleanedText = lines.slice(1, -1).join('\n').trim();
      }
    }

    return cleanedText.trim();
  }
}
