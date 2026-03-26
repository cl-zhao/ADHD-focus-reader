import { MessageType, SyncSettings, LocalData } from '../types';

// 消息发送包装函数
export async function sendMessage<T>(message: MessageType): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

// 存储工具
export const storage = {
  async getLocal<K extends keyof LocalData>(keys: K[]): Promise<Pick<LocalData, K>> {
    const result = await chrome.storage.local.get(keys);
    return result as Pick<LocalData, K>;
  },

  async setLocal(data: Partial<LocalData>): Promise<void> {
    await chrome.storage.local.set(data);
  },

  async getSync<K extends keyof SyncSettings>(keys: K[]): Promise<Pick<SyncSettings, K>> {
    const result = await chrome.storage.sync.get(keys);
    return result as Pick<SyncSettings, K>;
  },

  async setSync(data: Partial<SyncSettings>): Promise<void> {
    await chrome.storage.sync.set(data);
  },
};

// 默认设置
export const DEFAULT_SETTINGS: SyncSettings = {
  reading: {
    mode: 'continuous',
    segmentSize: 150,
    autoPlaySpeed: 5,
    guideLineType: 'highlight',
  },
  appearance: {
    fontSize: 20,
    lineHeight: 2.0,
    letterSpacing: 0.05,
    theme: 'warm',
  },
  ai: {
    enableSummary: true,
    enableKeywords: true,
  },
};
