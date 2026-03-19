# AI Capability

## Description
AI text/image generation integration using aihub module. Covers available models (GPT, Gemini, Claude, DeepSeek), frontend SDK client.ai (gentxt/genimg with streaming), backend AIHubService usage, and error handling patterns.

## Guide

### AI Capability (aihub module)

When the requirement involves AI features (text generation, image analysis, auto-reply, chat, etc.):

#### Available Models

| Model | Type | Multimodal | Use Case |
|-------|------|------------|----------|
| gpt-5-chat | gentxt | ✅ | High stability, JSON output |
| gemini-2.5-pro | gentxt | ✅ | Production multimodal, daily image-text tasks |
| gemini-3-pro-preview | gentxt | ✅ | Deep reasoning, long context (1M+) |
| claude-4-5-sonnet | gentxt | ✅ | Complex code, multi-file refactoring |
| deepseek-v3.2 | gentxt | ❌ | Low cost batch processing, text only |
| gemini-2.5-flash-image | genimg | - | Image generation + editing (img2img), marketing assets |
| gemini-3-pro-image-preview | genimg | - | Higher quality image generation + editing (img2img) |

#### Frontend - Use Web SDK `client.ai` (preferred)

**`client.ai.gentxt(params)`**
- Required: `messages`, `model`, `stream`
- `messages[].role`: `system` / `user` / `assistant`
- `messages[].content`:
  - Text: string
  - Multimodal: `[{ type: 'text', text: '...' }, { type: 'image_url', image_url: { url: 'https://...' | 'data:image/png;base64,...' } }]`
- Streaming callbacks (when `stream: true`): `onChunk`, `onComplete`, `onError`
- Default: when calling via SDK `client.ai.gentxt`, use `stream: true` unless explicitly required otherwise
- Avoid custom backend wrapper endpoints for aihub unless necessary; if you must call a custom endpoint via `client.apiCall.invoke`, default to NON-streaming (return full content) to avoid fragile stream parsing

```typescript
// Streaming (recommended)
const result = await client.ai.gentxt({
  messages: [...],
  model: 'deepseek-v3.2',
  stream: true,
  onChunk: (chunk) => {/* chunk.content */},
  onComplete: (finalResult) => {/* finalResult.content */},
  onError: (error) => {/* error.message */},
  timeout: 60_000,
});

// Non-streaming
const response = await client.ai.gentxt({ messages: [...], model: 'deepseek-v3.2', stream: false });
const text = response.data.content;
```

**`client.ai.genimg(params, options?)`**
- Required: `prompt`, `model`
- Optional: `size` (default `"1024x1024"`), `quality` (default `"standard"`, ignored for img2img), `n` (default `1`)
- `image` (img2img): Base64 Data URI string OR list of Base64 Data URI strings (multi-image); HTTP URL NOT allowed
  - Examples: `[subject, background]` (bg replace), `[person, clothing]` (try-on), `[content, style_ref]` (style transfer)
- Timeout: genimg may be slow; set longer timeout (e.g., `600_000` ms)
- Response: `response.data.images[0]` is URL (preferred) or base64 Data URI
- One-step-first: if one `genimg` call can solve it, do NOT split into multiple endpoints/steps; only split when quality/controllability requires it, and show progress

```typescript
const img = await client.ai.genimg(
  { prompt: 'cat', model: 'gemini-2.5-flash-image', size: '1024x1024', quality: 'standard', n: 1 },
  { timeout: 600_000 }
);
const edited = await client.ai.genimg(
  { prompt: '...', model: 'gemini-3-pro-image-preview', image: 'data:image/png;base64,...' },
  { timeout: 600_000 }
);
```

#### Error Handling (Frontend)

```typescript
// IMPORTANT: UI toast requires <Toaster /> mounted in App
const getErrorDetail = (error: any) =>
  error?.data?.detail || error?.response?.data?.detail || error?.message || '请求失败';

// Non-streaming
try { /* await client.ai.gentxt({ ..., stream: false }) */ }
catch (e: any) { /* toast(getErrorDetail(e)) */ }

// Streaming
await client.ai.gentxt({ ..., stream: true, onError: (e) => {/* toast(getErrorDetail(e)) */} });
```

#### Backend - Import AIHubService directly (NOT via httpx/requests)

```python
from services.aihub import AIHubService
from schemas.aihub import GenTxtRequest, ChatMessage

service = AIHubService()
request = GenTxtRequest(
    messages=[
        ChatMessage(role="system", content="You are a summarization expert"),
        ChatMessage(role="user", content=text)
    ],
    model="deepseek-v3.2"
)

# Streaming (DEFAULT / recommended) - gentxt_stream yields plain text chunks directly
async for chunk in service.gentxt_stream(request):
    yield chunk  # chunk is plain text string

# Non-streaming (ONLY when you explicitly need a single complete payload)
response = await service.gentxt(request)
result = response.content  # string
```

