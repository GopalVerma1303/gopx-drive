/**
 * Backend AI Provider Implementation
 *
 * Uses the custom backend API instead of hitting Groq directly.
 * Backend API is running on http://localhost:3001
 */

import type { AIGenerateOptions, AIProvider } from "./types";
import { buildContextAwarePrompt } from "./prompt-builder";
import { cleanResponse } from "./response-cleaner";
import { getModeConfig } from "./mode-config";

const BACKEND_API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface BackendResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

export class BackendProvider implements AIProvider {
  private defaultModel: string;

  constructor(defaultModel: string = "llama-3.1-8b-instant") {
    this.defaultModel = defaultModel;
  }

  getName(): "backend" {
    return "backend";
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async generate(options: AIGenerateOptions): Promise<string> {
    if (!BACKEND_API_BASE_URL?.trim()) {
      throw new Error(
        "Backend API URL not found. Please set EXPO_PUBLIC_BACKEND_URL environment variable."
      );
    }

    // Determine model: use mode-specific model if mode is provided, otherwise use provided model or default
    let model: string;
    if (options.mode) {
      const modeConfig = getModeConfig(options.mode);
      model = options.model || modeConfig.model;
    } else {
      model = options.model || this.defaultModel;
    }

    // Build context-aware prompt with system message and mode
    const { systemMessage, userMessage } = buildContextAwarePrompt(
      options.prompt,
      options.selectedText,
      options.mode
    );

    const url = `${BACKEND_API_BASE_URL.replace(/\/$/, "")}/api/chat`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
        let errorMessage = `Backend API error (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, use the status-based message
        }
        throw new Error(errorMessage);
      }

      let data: BackendResponse;
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response from backend API (non-JSON)");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.content) {
        throw new Error("Empty response from backend API");
      }

      // Clean up the response and ensure code blocks use ```<lang> format
      return cleanResponse(data.content);
    } catch (error: unknown) {
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error(
        `Failed to generate content: ${error != null ? String(error) : "Unknown error"}`
      );
    }
  }
}
