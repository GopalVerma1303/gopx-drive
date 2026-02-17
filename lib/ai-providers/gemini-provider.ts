/**
 * Google Gemini AI Provider Implementation
 * 
 * Get your API key from: https://ai.google.dev/
 */

import type { AIProvider, AIGenerateOptions } from "./types";
import { buildContextAwarePrompt } from "./prompt-builder";
import { cleanResponse } from "./response-cleaner";

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

      // Clean up the response and ensure code blocks use ```<lang> format
      return cleanResponse(generatedText);
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error(`Failed to generate content: ${error.message || "Unknown error"}`);
    }
  }
}
