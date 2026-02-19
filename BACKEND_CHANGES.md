# Backend Changes Required for AI Mode Support

This document outlines the changes needed in your backend to support the new AI mode feature that allows users to select different modes (Friendly, Professional, Concise, Summary, Key Points, List, Table, Code) with optimized Groq models for each use case.

## Overview

The frontend now sends a `model` parameter in the request body to `/api/chat`. Your backend should:
1. Accept the `model` parameter from the request
2. Use it when making requests to Groq API instead of hardcoding a model name
3. Ensure all supported models are available

## Required Changes

### 1. Update the `/api/chat` Endpoint

Your backend should accept and use the `model` parameter from the request body. Here's what needs to change:

**Current Implementation (likely):**
```javascript
// You probably have something like this:
const model = "llama-3.1-8b-instant"; // Hardcoded
```

**Updated Implementation:**
```javascript
// Accept model from request body
const { model, messages, temperature, max_tokens } = req.body;

// Use the provided model or fallback to default
const selectedModel = model || "llama-3.1-8b-instant";

// Use selectedModel when calling Groq API
const response = await groq.chat.completions.create({
  model: selectedModel,
  messages: messages,
  temperature: temperature || 0.5,
  max_tokens: max_tokens || 2048,
});
```

### 2. Supported Models

The frontend will send these model names based on the selected mode:

| Mode | Model Name |
|------|-----------|
| Friendly | `llama-3.1-8b-instant` |
| Professional | `llama-3.3-70b-versatile` |
| Concise | `llama-3.1-8b-instant` |
| Summary | `llama-3.3-70b-versatile` |
| Key Points | `llama-3.1-8b-instant` |
| List | `llama-3.1-8b-instant` |
| Table | `llama-3.3-70b-versatile` |
| Code | `qwen-2.5-coder-32b` |

**Important:** Ensure your Groq API key has access to all these models. Some models like `qwen-2.5-coder-32b` and `llama-3.3-70b-versatile` may require specific access or may have different availability.

### 3. Model Validation (Recommended)

Add validation to ensure only supported models are used:

```javascript
const SUPPORTED_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "qwen-2.5-coder-32b",
  // Add other models you want to support
];

// Validate model
if (model && !SUPPORTED_MODELS.includes(model)) {
  return res.status(400).json({
    error: `Unsupported model: ${model}. Supported models: ${SUPPORTED_MODELS.join(", ")}`,
  });
}
```

### 4. Error Handling

Handle cases where a model might not be available:

```javascript
try {
  const response = await groq.chat.completions.create({
    model: selectedModel,
    messages: messages,
    temperature: temperature || 0.5,
    max_tokens: max_tokens || 2048,
  });
  // ... handle success
} catch (error) {
  // Handle model-specific errors
  if (error.message?.includes("model")) {
    return res.status(400).json({
      error: `Model ${selectedModel} is not available. Please try a different model.`,
    });
  }
  throw error;
}
```

### 5. Example Request Format

The frontend sends requests in this format:

```json
{
  "model": "llama-3.1-8b-instant",
  "messages": [
    {
      "role": "system",
      "content": "You are an intelligent note-editing agent..."
    },
    {
      "role": "user",
      "content": "User's prompt here..."
    }
  ],
  "temperature": 0.5,
  "max_tokens": 2048
}
```

### 6. Response Format

Your backend should continue returning responses in this format:

```json
{
  "content": "Generated content here...",
  "model": "llama-3.1-8b-instant",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

## Implementation Checklist

- [ ] Update `/api/chat` endpoint to accept `model` from request body
- [ ] Remove hardcoded model name
- [ ] Use `model` parameter when calling Groq API
- [ ] Add model validation (optional but recommended)
- [ ] Add error handling for unavailable models
- [ ] Test with all supported models
- [ ] Verify Groq API key has access to all models

## Testing

Test your backend with different models:

```bash
# Test with Friendly mode (llama-3.1-8b-instant)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# Test with Code mode (qwen-2.5-coder-32b)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-2.5-coder-32b",
    "messages": [
      {"role": "user", "content": "Write a function to sort an array"}
    ]
  }'
```

## Notes

1. **Model Availability**: Some models like `qwen-2.5-coder-32b` and `llama-3.3-70b-versatile` may have limited availability or require specific API access. Check Groq's documentation for current model availability.

2. **Fallback**: If a model is not available, you can fallback to `llama-3.1-8b-instant` which is widely available.

3. **Rate Limits**: Different models may have different rate limits. Consider implementing rate limiting per model if needed.

4. **Cost**: Larger models like `llama-3.3-70b-versatile` may have different pricing. Check Groq's pricing page for details.

## Additional Resources

- [Groq Models Documentation](https://console.groq.com/docs/models)
- [Groq API Reference](https://console.groq.com/docs)
- [Qwen-2.5-Coder Documentation](https://console.groq.com/docs/model/qwen-2.5-coder-32b)
