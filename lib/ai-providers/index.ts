/**
 * Universal AI Provider System
 * 
 * This module provides a unified interface for different AI providers.
 * To switch providers, change the EXPO_PUBLIC_AI_PROVIDER environment variable.
 * 
 * Supported providers:
 * - groq: Groq API (default, fast inference)
 * - gemini: Google Gemini API
 * - backend: Custom backend API (EXPO_PUBLIC_BACKEND_URL)
 * 
 * Environment variables:
 * - EXPO_PUBLIC_AI_PROVIDER: "groq" | "gemini" | "backend" (default: "groq")
 * - EXPO_PUBLIC_GROQ_API_KEY: Your Groq API key
 * - EXPO_PUBLIC_GEMINI_API_KEY: Your Gemini API key
 * - EXPO_PUBLIC_BACKEND_URL: Backend API base URL (for "backend" provider)
 */

import { BackendProvider } from "./backend-provider";
import { GeminiProvider } from "./gemini-provider";
import { GroqProvider } from "./groq-provider";
import type { AIGenerateOptions, AIProvider, AIProviderType } from "./types";

/**
 * Create an AI provider instance based on the configured provider type
 */
export function createAIProvider(providerType?: AIProviderType): AIProvider {
  const provider = providerType || 
    (process.env.EXPO_PUBLIC_AI_PROVIDER as AIProviderType) || 
    "groq";

  switch (provider) {
    case "groq":
      return new GroqProvider();
    case "gemini":
      return new GeminiProvider();
    case "backend":
      return new BackendProvider();
    default:
      console.warn(`Unknown AI provider: ${provider}, falling back to groq`);
      return new GroqProvider();
  }
}

/**
 * Get the default AI provider instance
 */
let defaultProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!defaultProvider) {
    defaultProvider = createAIProvider();
  }
  return defaultProvider;
}

/**
 * Generate content using the configured AI provider
 * 
 * This is the main function to use for AI generation.
 * It automatically uses the provider specified in EXPO_PUBLIC_AI_PROVIDER.
 * 
 * @param options - Generation options
 * @returns Generated markdown text
 */
export async function generateAIContent(options: AIGenerateOptions): Promise<string> {
  const provider = getAIProvider();
  return provider.generate(options);
}

/**
 * Export types for use in other modules
 */
export type { AIGenerateOptions, AIProvider, AIProviderType } from "./types";

