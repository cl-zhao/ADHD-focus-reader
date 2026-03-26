import { Platform } from '../../../shared/types';

// 平台检测
export function detectPlatform(): Platform {
  const hostname = window.location.hostname;

  if (hostname.includes('mp.weixin.qq.com')) {
    return 'weixin';
  }

  if (hostname.includes('zhihu.com')) {
    return 'zhihu';
  }

  if (hostname.includes('toutiao.com')) {
    return 'toutiao';
  }

  if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) {
    return 'xiaohongshu';
  }

  return 'generic';
}
