/**
 * Context-Aware Prompt Builder
 *
 * Builds prompts that make the AI behave like an agent rather than an LLM,
 * with proper system instructions and task-aware formatting.
 */

import type { AIMode } from "./mode-config";
import { getModeConfig } from "./mode-config";

export type TaskType =
  | "replacement"
  | "insertion"
  | "transformation"
  | "generation"
  | "unknown";

/**
 * Detects the task type from the user prompt and selected text
 */
export function detectTaskType(
  prompt: string,
  selectedText?: string
): TaskType {
  const lowerPrompt = prompt.toLowerCase().trim();
  const hasSelectedText = selectedText && selectedText.trim().length > 0;

  // Replacement tasks: user wants to replace selected text
  if (hasSelectedText) {
    if (
      lowerPrompt.includes("replace") ||
      lowerPrompt.includes("change") ||
      lowerPrompt.includes("substitute") ||
      lowerPrompt.includes("synonym") ||
      lowerPrompt.includes("rewrite") ||
      lowerPrompt.includes("rephrase") ||
      lowerPrompt.includes("improve") ||
      lowerPrompt.includes("fix") ||
      lowerPrompt.includes("correct")
    ) {
      return "replacement";
    }
    if (
      lowerPrompt.includes("expand") ||
      lowerPrompt.includes("elaborate") ||
      lowerPrompt.includes("add") ||
      lowerPrompt.includes("extend")
    ) {
      return "transformation";
    }
  }

  // Insertion tasks: user wants to add new content
  if (
    !hasSelectedText &&
    (lowerPrompt.includes("write") ||
      lowerPrompt.includes("generate") ||
      lowerPrompt.includes("create") ||
      lowerPrompt.includes("add") ||
      lowerPrompt.includes("insert"))
  ) {
    return "insertion";
  }

  // Transformation tasks: modify existing content
  if (
    lowerPrompt.includes("translate") ||
    lowerPrompt.includes("summarize") ||
    lowerPrompt.includes("format") ||
    lowerPrompt.includes("convert") ||
    lowerPrompt.includes("transform")
  ) {
    return "transformation";
  }

  return hasSelectedText ? "replacement" : "generation";
}

/**
 * Builds a system message that defines the AI's role as a note-editing agent
 */
function buildSystemMessage(taskType: TaskType, mode?: AIMode): string {
  const baseSystemMessage = `You are an intelligent note-editing agent integrated into a markdown note-taking application. Your role is to directly perform text editing operations requested by users.

CRITICAL BEHAVIOR RULES:
1. You are an AGENT that performs actions, not an LLM that explains actions
2. Output ONLY the result of the requested operation - no explanations, no introductions, no markdown headers unless explicitly requested
3. For replacements: output ONLY the replacement text (e.g., if asked for a synonym of "sweet", output "delicious" not "# delicious" or "Here's a synonym: delicious")
4. For insertions: output ONLY the content to insert
5. For transformations: output ONLY the transformed content
6. Never include meta-commentary like "Here's...", "I'll...", "Sure, here is...", etc.
7. Never add markdown headers (#) unless the user explicitly asks for formatted content
8. Preserve the user's intent and context - if they select text and ask for a synonym, replace that word, not the entire selection with a formatted response
9. Match the style and format of the existing content when possible
10. When your output includes code, wrap it in a fenced code block with a language tag: \`\`\`<lang> (e.g. \`\`\`js, \`\`\`ts, \`\`\`python, \`\`\`json)`;

  const taskSpecificInstructions: Record<TaskType, string> = {
    replacement: `TASK TYPE: TEXT REPLACEMENT
- You are replacing selected text with new content
- Output ONLY the replacement text that should take the place of the selected text
- Do NOT include the original text, explanations, or formatting
- Example: If user selects "sweet" and asks for a synonym, output "delicious" (not "# delicious" or "Here's a synonym: delicious")`,

    insertion: `TASK TYPE: CONTENT INSERTION
- You are inserting new content at the cursor position
- Output ONLY the content to insert
- Format appropriately for markdown if needed, but don't add unnecessary headers
- Match the style and context of surrounding content`,

    transformation: `TASK TYPE: CONTENT TRANSFORMATION
- You are transforming existing content
- Output ONLY the transformed result
- Preserve meaning and context while applying the requested transformation
- Don't add explanations or meta-commentary`,

    generation: `TASK TYPE: CONTENT GENERATION
- You are generating new content
- Output ONLY the generated content
- Format as markdown if appropriate, but avoid unnecessary headers
- Be concise and contextually appropriate`,

    unknown: `TASK TYPE: GENERAL EDITING
- Perform the requested operation directly
- Output ONLY the result
- No explanations or meta-commentary`,
  };

  let systemMessage = `${baseSystemMessage}\n\n${taskSpecificInstructions[taskType]}`;

  // Add mode-specific enhancements if mode is provided
  if (mode) {
    const modeConfig = getModeConfig(mode);
    systemMessage += `\n\nMODE-SPECIFIC INSTRUCTIONS:\n${modeConfig.systemPromptEnhancement}`;
  }

  return systemMessage;
}

/**
 * Builds a context-aware prompt with proper system instructions
 */
export function buildContextAwarePrompt(
  prompt: string,
  selectedText?: string,
  mode?: AIMode
): { systemMessage: string; userMessage: string } {
  const taskType = detectTaskType(prompt, selectedText);
  const systemMessage = buildSystemMessage(taskType, mode);

  let userMessage: string;
  let modeSpecificGuidance = "";

  // Add mode-specific user message guidance
  if (mode) {
    switch (mode) {
      case "table":
        modeSpecificGuidance =
          "\n\nIMPORTANT: Format the output as a valid markdown table. Use proper markdown table syntax with pipes (|) and dashes (-). Ensure all columns align properly.";
        break;
      case "code":
        modeSpecificGuidance =
          "\n\nIMPORTANT: Provide clean, working code. Wrap code blocks with proper language tags (```lang). Think through the solution step-by-step before providing code.";
        break;
      case "list":
        modeSpecificGuidance =
          "\n\nIMPORTANT: Format as a clear, structured list using markdown list syntax (- for bullets, 1. for numbered). Ensure consistent formatting throughout.";
        break;
      case "key-points":
        modeSpecificGuidance =
          "\n\nIMPORTANT: Extract only the most important points. Use bullet points or numbered format. Be precise and focused.";
        break;
      case "summary":
        modeSpecificGuidance =
          "\n\nIMPORTANT: Provide a comprehensive summary that captures all essential information. Maintain the logical flow and hierarchy of the original content.";
        break;
      case "concise":
        modeSpecificGuidance =
          "\n\nIMPORTANT: Be extremely brief. Use the absolute minimum words necessary. Eliminate all redundancy.";
        break;
    }
  }

  if (selectedText && selectedText.trim()) {
    // For replacement/transformation tasks
    if (taskType === "replacement") {
      userMessage = `Selected text: "${selectedText.trim()}"\n\nRequest: ${prompt}${modeSpecificGuidance}\n\nOutput ONLY the replacement text that should replace the selected text. Do not include explanations, markdown headers, or meta-commentary.`;
    } else {
      userMessage = `Selected text: "${selectedText.trim()}"\n\nRequest: ${prompt}${modeSpecificGuidance}\n\nOutput ONLY the result of the requested operation. Do not include explanations, introductions, or unnecessary formatting.`;
    }
  } else {
    // For insertion/generation tasks
    userMessage = `Request: ${prompt}${modeSpecificGuidance}\n\nOutput ONLY the requested content. Do not include explanations, introductions, or unnecessary markdown headers.`;
  }

  return { systemMessage, userMessage };
}
