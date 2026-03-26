// OpenRouter AI Integration

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const SUPPORTED_MODELS = [
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];

export const PROMPTS = {
  summarize: (content: string) => `请用3-5句话总结以下中文文章的核心内容，要求简洁明了：

${content.substring(0, 3000)}

摘要：`,

  extractKeywords: (content: string) => `请从以下中文文章中提取5-8个关键词，用于高亮显示：

${content.substring(0, 2000)}

关键词（用逗号分隔）：`,
};

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function callOpenRouter(
  prompt: string,
  apiKey: string,
  model: string = 'anthropic/claude-3-haiku'
): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': chrome.runtime.getURL(''),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('OpenRouter API returned no choices');
  }

  return data.choices[0].message.content;
}

export async function summarizeContent(content: string, apiKey: string, model: string): Promise<string> {
  const prompt = PROMPTS.summarize(content);
  return callOpenRouter(prompt, apiKey, model);
}

export async function extractKeywords(content: string, apiKey: string, model: string): Promise<string[]> {
  const prompt = PROMPTS.extractKeywords(content);
  const result = await callOpenRouter(prompt, apiKey, model);

  // 解析关键词（支持中英文逗号、顿号分隔）
  return result
    .split(/[,，、]/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
}
