// 消息类型定义
export type MessageType =
  | { type: 'EXTRACT_CONTENT'; payload: { url: string } }
  | { type: 'CONTENT_EXTRACTED'; payload: { content: string; title: string } }
  | { type: 'AI_SUMMARIZE'; payload: { content: string } }
  | { type: 'AI_SUMMARY_RESULT'; payload: { summary: string } }
  | { type: 'AI_EXTRACT_KEYWORDS'; payload: { content: string } }
  | { type: 'AI_KEYWORDS_RESULT'; payload: { keywords: string[] } }
  | { type: 'AI_ERROR'; payload: { error: string } }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: Partial<SyncSettings> };

// 设置类型
export interface SyncSettings {
  reading: {
    mode: 'continuous' | 'segmented';
    segmentSize: number;
    autoPlaySpeed: number;
    guideLineType: 'highlight' | 'underline' | 'dynamic';
  };
  appearance: {
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    theme: 'warm' | 'sepia' | 'dark';
  };
  ai: {
    enableSummary: boolean;
    enableKeywords: boolean;
  };
}

export interface LocalData {
  ai: {
    openrouterKey: string;
    defaultModel: string;
  };
  readingHistory: Array<{
    url: string;
    title: string;
    progress: number;
    lastRead: number;
  }>;
  cache: Record<string, {
    content: string;
    summary: string;
    keywords: string[];
    extractedAt: number;
  }>;
}

// 提取结果类型
export interface ExtractResult {
  success: boolean;
  content?: string;
  title?: string;
  fallback?: string;
}

// 平台类型
export type Platform = 'weixin' | 'zhihu' | 'toutiao' | 'xiaohongshu' | 'generic';
