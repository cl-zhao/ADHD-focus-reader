import { ExtractResult } from '../../../shared/types';

export async function extractWeixin(): Promise<ExtractResult> {
  try {
    const contentElement = document.querySelector('#js_content');

    if (!contentElement) {
      return { success: false, fallback: document.body.innerText };
    }

    // 提取标题
    const titleElement = document.querySelector('#activity-name');
    const title = titleElement?.textContent?.trim() || document.title;

    // 提取正文HTML
    const content = contentElement.innerHTML;

    return {
      success: true,
      content,
      title,
    };
  } catch (error) {
    console.error('Weixin extraction failed:', error);
    return { success: false, fallback: document.body.innerText };
  }
}
