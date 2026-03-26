import { create } from 'zustand';
import { SyncSettings, ExtractResult, LocalData } from '../types';
import { DEFAULT_SETTINGS } from '../utils/messaging';

// 阅读历史项类型
interface ReadingHistoryItem {
  url: string;
  title: string;
  progress: number;
  lastRead: number;
}

interface ReaderState {
  isOpen: boolean;
  content: ExtractResult | null;
  settings: SyncSettings;
  // 进度追踪
  currentProgress: number;
  totalSegments: number;

  // Actions
  openReader: () => void;
  closeReader: () => void;
  setContent: (content: ExtractResult) => void;
  updateSettings: (settings: Partial<SyncSettings>) => void;
  // 进度管理
  updateProgress: (current: number, total: number) => void;
  saveReadingHistory: () => Promise<void>;
  loadReadingProgress: (url: string) => Promise<number>;
}

// 防抖保存定时器
let saveHistoryTimer: ReturnType<typeof setTimeout> | null = null;

export const useReaderStore = create<ReaderState>((set, get) => ({
  isOpen: false,
  content: null,
  settings: DEFAULT_SETTINGS,
  currentProgress: 0,
  totalSegments: 0,

  openReader: () => set({ isOpen: true }),
  closeReader: () => set({ isOpen: false, currentProgress: 0, totalSegments: 0 }),
  setContent: (content) => set({ content }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  // 更新进度
  updateProgress: (current, total) => {
    set({ currentProgress: current, totalSegments: total });
    // 防抖保存历史（500ms后保存）
    if (saveHistoryTimer) {
      clearTimeout(saveHistoryTimer);
    }
    saveHistoryTimer = setTimeout(() => {
      get().saveReadingHistory();
    }, 500);
  },

  // 保存阅读历史到chrome.storage.local
  saveReadingHistory: async () => {
    const state = get();
    if (!state.content) return;

    const url = window.location.href;
    const title = state.content.title || document.title;
    const progress = state.totalSegments > 0
      ? (state.currentProgress / state.totalSegments) * 100
      : 0;

    const historyItem: ReadingHistoryItem = {
      url,
      title,
      progress,
      lastRead: Date.now(),
    };

    try {
      const data = await chrome.storage.local.get('readingHistory');
      const history: ReadingHistoryItem[] = data.readingHistory || [];

      // 更新或添加
      const existingIndex = history.findIndex((h) => h.url === url);
      if (existingIndex >= 0) {
        history[existingIndex] = historyItem;
      } else {
        history.unshift(historyItem);
        // 最多保存100条
        if (history.length > 100) {
          history.pop();
        }
      }

      await chrome.storage.local.set({ readingHistory: history });
    } catch (error) {
      console.error('Failed to save reading history:', error);
    }
  },

  // 从chrome.storage.local加载阅读进度
  loadReadingProgress: async (url: string): Promise<number> => {
    try {
      const data = await chrome.storage.local.get('readingHistory');
      const history: ReadingHistoryItem[] = data.readingHistory || [];
      const item = history.find((h) => h.url === url);
      return item ? item.progress : 0;
    } catch (error) {
      console.error('Failed to load reading progress:', error);
      return 0;
    }
  },
}));
