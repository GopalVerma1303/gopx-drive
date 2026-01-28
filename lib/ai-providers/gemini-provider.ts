/**
 * Google Gemini AI Provider Implementation
 * 
 * Get your API key from: https://ai.google.dev/
 */

import type { AIProvider, AIGenerateOptions } from "./types";

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
    
    // Build the full prompt
    let fullPrompt = options.prompt;
    if (options.selectedText && options.selectedText.trim()) {
      fullPrompt = `Context: "${options.selectedText.trim()}"\n\nUser request: ${options.prompt}\n\nPlease provide only the markdown content without any explanations, introductions, or helping statements. Respond with pure markdown output only.`;
    } else {
      fullPrompt = `${options.prompt}\n\nPlease provide only the markdown content without any explanations, introductions, or helping statements. Respond with pure markdown output only.`;
    }

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
            temperature: options.temperature ?? 0.7,
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
