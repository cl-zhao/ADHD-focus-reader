import { ExtractResult, Platform } from '../../shared/types';
import { detectPlatform } from './platforms';
import { extractWeixin } from './platforms/weixin';
import { extractWithReadability } from './readability';

// 平台提取器映射
const platformExtractors: Partial<Record<Platform, () => Promise<ExtractResult>>> = {
  weixin: extractWeixin,
  // TODO: 添加更多平台
  zhihu: extractWithReadability,
  toutiao: extractWithReadability,
  xiaohongshu: extractWithReadability,
};

export async function extractContent(): Promise<ExtractResult> {
  try {
    const platform = detectPlatform();
    console.log('Detected platform:', platform);

    // 尝试平台特定提取
    const extractor = platformExtractors[platform];
    if (platform !== 'generic' && extractor) {
      const result = await extractor();
      if (result.success) {
        return result;
      }
    }

    // 降级到Readability
    console.log('Falling back to Readability');
    const result = await extractWithReadability();
    if (result.success) {
      return result;
    }

    // 最终降级：显示原文
    console.log('All extraction methods failed, using fallback');
    return { success: false, fallback: document.body.innerText };
  } catch (error) {
    console.error('Content extraction failed:', error);
    return { success: false, fallback: document.body.innerText };
  }
}
