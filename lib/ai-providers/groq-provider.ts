/**
 * Groq AI Provider Implementation
 *
 * Groq API is compatible with OpenAI's format and provides fast inference.
 * Get your API key from: https://console.groq.com/
 */

import type { AIGenerateOptions, AIProvider } from "./types";

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
        "Groq API key not found. Please set EXPO_PUBLIC_GROQ_API_KEY environment variable or pass apiKey parameter.",
      );
    }

    const model = options.model || this.defaultModel;

    // Build the full prompt
    let fullPrompt = options.prompt;
    if (options.selectedText && options.selectedText.trim()) {
      fullPrompt = `Context: "${options.selectedText.trim()}"\n\nUser request: ${options.prompt}\n\nPlease provide only the markdown content without any explanations, introductions, or helping statements. Respond with pure markdown output only.`;
    } else {
      fullPrompt = `${options.prompt}\n\nPlease provide only the markdown content without any explanations, introductions, or helping statements. Respond with pure markdown output only.`;
    }

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
              role: "user",
              content: fullPrompt,
            },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        const errorData: GroqResponse = await response.json();
        throw new Error(
          errorData.error?.message ||
            `API request failed with status ${response.status}`,
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
        `Failed to generate content: ${error.message || "Unknown error"}`,
      );
    }
  }

  private cleanResponse(text: string): string {
    let cleanedText = text.trim();

    // Remove common AI response patterns
    const patternsToRemove = [
      /^Here's.*?:\s*/i,
      /^Here is.*?:\s*/i,
      /^I'll.*?:\s*/i,
      /^I can.*?:\s*/i,
      /^Sure.*?:\s*/i,
      /^Of course.*?:\s*/i,
      /^Certainly.*?:\s*/i,
      /\s*Let me know.*$/i,
      /\s*Is there anything else.*$/i,
      /\s*I hope this helps.*$/i,
    ];

    for (const pattern of patternsToRemove) {
      cleanedText = cleanedText.replace(pattern, "");
    }

    return cleanedText.trim();
  }
}
