/**
 * Universal AI Provider Types
 * 
 * This module defines the interface for AI providers, allowing easy
 * switching between different AI services (Groq, Gemini, OpenAI, etc.)
 */

export type AIProviderType = "groq" | "gemini" | "openai";

export interface AIGenerateOptions {
  prompt: string;
  selectedText?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  /**
   * Generate content based on the provided options
   */
  generate(options: AIGenerateOptions): Promise<string>;

  /**
   * Get the default model for this provider
   */
  getDefaultModel(): string;

  /**
   * Get the provider name
   */
  getName(): AIProviderType;
}

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;
  model?: string;
}
