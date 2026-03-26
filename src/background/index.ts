// Background Service Worker
import { summarizeContent, extractKeywords } from './ai';

console.log('ADHD Reader: Background service worker started');

// 监听扩展安装
chrome.runtime.onInstalled.addListener(() => {
  console.log('ADHD Reader: Extension installed');
});

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message);

  if (message.type === 'AI_SUMMARIZE') {
    handleAISummarize(message.payload)
      .then(sendResponse)
      .catch(error => sendResponse({ type: 'AI_ERROR', payload: { error: error.message } }));
    return true;
  }

  if (message.type === 'AI_EXTRACT_KEYWORDS') {
    handleAIExtractKeywords(message.payload)
      .then(sendResponse)
      .catch(error => sendResponse({ type: 'AI_ERROR', payload: { error: error.message } }));
    return true;
  }

  return true; // 保持消息通道开放
});

async function handleAISummarize(payload: { content: string }) {
  // 获取API密钥
  const data = await chrome.storage.local.get('ai');
  if (!data.ai?.openrouterKey) {
    throw new Error('未配置OpenRouter API密钥');
  }

  const apiKey = data.ai.openrouterKey;
  const model = data.ai.defaultModel || 'anthropic/claude-3-haiku';

  const summary = await summarizeContent(payload.content, apiKey, model);

  return { type: 'AI_SUMMARY_RESULT', payload: { summary } };
}

async function handleAIExtractKeywords(payload: { content: string }) {
  const data = await chrome.storage.local.get('ai');
  if (!data.ai?.openrouterKey) {
    throw new Error('未配置OpenRouter API密钥');
  }

  const apiKey = data.ai.openrouterKey;
  const model = data.ai.defaultModel || 'anthropic/claude-3-haiku';

  const keywords = await extractKeywords(payload.content, apiKey, model);

  return { type: 'AI_KEYWORDS_RESULT', payload: { keywords } };
}
