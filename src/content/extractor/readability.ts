import { Readability } from '@mozilla/readability';
import { ExtractResult } from '../../shared/types';

export async function extractWithReadability(): Promise<ExtractResult> {
  try {
    // 克隆DOM以避免修改原始页面
    const documentClone = document.cloneNode(true) as Document;

    // 使用Readability解析
    const reader = new Readability(documentClone, {
      debug: false,
      maxElemsToParse: 0,
      nbTopCandidates: 5,
      charThreshold: 500,
    });

    const article = reader.parse();

    if (!article) {
      return { success: false, fallback: document.body.innerText };
    }

    return {
      success: true,
      content: article.content,
      title: article.title,
    };
  } catch (error) {
    console.error('Readability extraction failed:', error);
    return { success: false, fallback: document.body.innerText };
  }
}
