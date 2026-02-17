/**
 * Groq AI Provider Implementation
 *
 * Groq API is compatible with OpenAI's format and provides fast inference.
 * Get your API key from: https://console.groq.com/
 */

import type { AIGenerateOptions, AIProvider } from "./types";
import { buildContextAwarePrompt } from "./prompt-builder";
import { cleanResponse } from "./response-cleaner";

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

      // Clean up the response and ensure code blocks use ```<lang> format
      return cleanResponse(generatedText);
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error(
        `Failed to generate content: ${error.message || "Unknown error"}`
      );
    }
  }
}
