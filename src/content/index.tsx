// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Readability } from '@mozilla/readability';

// ===== 全局状态 =====
let readerOpen = false;
let shadowRoot: ShadowRoot | null = null;
let rootContainer: HTMLDivElement | null = null;
let reactRoot: ReturnType<typeof createRoot> | null = null;

// ===== 消息监听 =====
function setupMessageListener() {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'TOGGLE_READER') {
        toggleReader()
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      }
      return true;
    });
  } catch (e) {
    console.error('[ADHD Reader] Failed to setup message listener:', e);
  }
}
setupMessageListener();

// ===== 内容提取 =====
function detectPlatform() {
  const h = window.location.hostname;
  if (h.includes('mp.weixin.qq.com')) return 'weixin';
  if (h.includes('zhihu.com')) return 'zhihu';
  return 'generic';
}

function extractContent() {
  const platform = detectPlatform();
  if (platform === 'weixin') {
    const el = document.querySelector('#js_content');
    if (el) {
      const titleEl = document.querySelector('#activity-name');
      return {
        success: true,
        content: el.innerHTML,
        title: titleEl?.textContent?.trim() || document.title,
      };
    }
  }
  try {
    const doc = document.cloneNode(true);
    const reader = new Readability(doc, { charThreshold: 500 });
    const article = reader.parse();
    if (article && article.content) {
      return { success: true, content: article.content, title: article.title };
    }
  } catch (e) {
    console.error('[ADHD Reader] Readability failed:', e);
  }
  return { success: false, fallback: document.body.innerText, title: document.title };
}

// ===== 常量 =====
const DEFAULT_SETTINGS = {
  reading: { mode: 'continuous', segmentSize: 150, bionicReading: false, focusMode: 'none' },
  appearance: { fontSize: 20, lineHeight: 2.0, letterSpacing: 0.05, theme: 'warm' },
  ai: { enableSummary: true, enableKeywords: true },
};

const MODEL_SUGGESTIONS = [
  'anthropic/claude-3-haiku',
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash',
  'deepseek/deepseek-chat-v3-0324',
  'anthropic/claude-sonnet-4',
];

const THEMES: Record<string, Record<string, string>> = {
  warm: {
    '--color-bg-primary': '#FDF8F3',
    '--color-bg-secondary': '#F5F0EB',
    '--color-text-primary': '#3D3632',
    '--color-text-secondary': '#6B635B',
    '--color-accent': '#E8A87C',
    '--color-interactive': '#C49A6C',
  },
  sepia: {
    '--color-bg-primary': '#F0EAD6',
    '--color-bg-secondary': '#E5DFC8',
    '--color-text-primary': '#3D3632',
    '--color-text-secondary': '#6B635B',
    '--color-accent': '#C49A6C',
    '--color-interactive': '#8B7355',
  },
  dark: {
    '--color-bg-primary': '#2D2A26',
    '--color-bg-secondary': '#3D3832',
    '--color-text-primary': '#E8E4DF',
    '--color-text-secondary': '#A09890',
    '--color-accent': '#D4A574',
    '--color-interactive': '#E8A87C',
  },
};

// ===== CSS =====
const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition-duration: 0s !important; }
  }
  button { font-family: inherit; cursor: pointer; }
  input, select { font-family: inherit; }

  .adhd-btn {
    background: none;
    border: 1px solid var(--color-bg-secondary);
    color: var(--color-text-secondary);
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .adhd-btn:hover { background: var(--color-bg-secondary); color: var(--color-text-primary); }
  .adhd-btn.active { background: var(--color-interactive); color: #fff; border-color: var(--color-interactive); }
  .adhd-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .adhd-content p { margin-bottom: 1em; }
  .adhd-content img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 4px; }
  .adhd-content h1, .adhd-content h2, .adhd-content h3 { margin: 1.2em 0 0.6em; font-weight: 600; }
  .adhd-content blockquote {
    border-left: 3px solid var(--color-accent);
    padding-left: 1em; margin: 1em 0;
    color: var(--color-text-secondary);
  }
  .adhd-content a { color: var(--color-interactive); text-decoration: underline; }
  .adhd-content ul, .adhd-content ol { padding-left: 2em; margin-bottom: 1em; }
  .adhd-content li { margin-bottom: 0.5em; }
  .adhd-content code { background: var(--color-bg-secondary); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  .adhd-content pre { background: var(--color-bg-secondary); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 1em 0; }
  .adhd-content pre code { background: none; padding: 0; }

  /* Bionic Reading - 加粗单词前半部分 */
  .br { font-weight: 700; }

  /* Focus Dim - 边缘暗角效果 */
  .focus-dim::before,
  .focus-dim::after {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 25%;
    pointer-events: none;
    z-index: 2;
    transition: opacity 0.3s;
  }
  .focus-dim::before {
    top: 0;
    background: linear-gradient(to bottom, var(--color-bg-primary) 0%, transparent 100%);
    opacity: 0.6;
  }
  .focus-dim::after {
    bottom: 0;
    background: linear-gradient(to top, var(--color-bg-primary) 0%, transparent 100%);
    opacity: 0.6;
  }

  .kw-highlight {
    background: var(--color-accent);
    color: var(--color-bg-primary);
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 500;
  }

  .summary-box {
    background: var(--color-bg-secondary);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 20px;
    font-size: 15px;
    line-height: 1.8;
    color: var(--color-text-secondary);
    border-left: 3px solid var(--color-accent);
  }
  .summary-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--color-text-primary);
    font-size: 14px;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .keyword-tag {
    display: inline-block;
    background: var(--color-bg-secondary);
    color: var(--color-interactive);
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 13px;
    margin: 0 6px 6px 0;
  }

  .settings-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 10;
  }
  .settings-box {
    background: var(--color-bg-primary);
    border-radius: 12px;
    padding: 28px;
    width: 520px;
    max-height: 80vh;
    overflow: auto;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  .settings-section { margin-bottom: 24px; }
  .settings-section h3 { margin-bottom: 12px; color: var(--color-text-primary); font-size: 16px; }
  .s-label { display: block; margin-bottom: 6px; color: var(--color-text-secondary); font-size: 13px; }
  .s-input {
    width: 100%; padding: 8px 12px;
    border: 1px solid var(--color-bg-secondary);
    border-radius: 6px; font-size: 14px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    outline: none;
  }
  .s-input:focus { border-color: var(--color-interactive); }
  .s-hint { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
  .s-row { margin-bottom: 14px; }
  .theme-btn {
    flex: 1; padding: 10px;
    border: 2px solid var(--color-bg-secondary);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    text-align: center;
    transition: border-color 0.15s;
  }
  .theme-btn.active { border-color: var(--color-interactive); }
  .model-chip {
    display: inline-block;
    padding: 3px 10px;
    border: 1px solid var(--color-bg-secondary);
    border-radius: 4px;
    font-size: 11px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    margin: 3px 4px 3px 0;
  }
  .model-chip:hover { border-color: var(--color-interactive); color: var(--color-interactive); }
  .toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-bg-secondary);
  }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { color: var(--color-text-primary); font-size: 14px; }
  .toggle-desc { color: var(--color-text-secondary); font-size: 11px; margin-top: 2px; }
  .toggle-switch {
    position: relative;
    width: 40px; height: 22px;
    background: var(--color-bg-secondary);
    border-radius: 11px;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle-switch.on { background: var(--color-interactive); }
  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px; left: 2px;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }
  .toggle-switch.on::after { transform: translateX(18px); }
`;

// ===== 设置工具 =====
async function loadAllSettings() {
  const [syncData, localData] = await Promise.all([
    new Promise((r) => chrome.storage.sync.get(DEFAULT_SETTINGS, r)),
    new Promise((r) => chrome.storage.local.get('ai', r)),
  ]);
  return {
    ...DEFAULT_SETTINGS,
    ...syncData,
    ai: { ...DEFAULT_SETTINGS.ai, ...localData.ai },
  };
}

function saveAllSettings(settings: any) {
  const syncSettings = {
    reading: settings.reading,
    appearance: settings.appearance,
    ai: { enableSummary: settings.ai?.enableSummary, enableKeywords: settings.ai?.enableKeywords },
  };
  const localSettings = { ai: { openrouterKey: settings.ai?.openrouterKey, defaultModel: settings.ai?.defaultModel } };
  chrome.storage.sync.set(syncSettings);
  chrome.storage.local.set(localSettings);
}

// ===== 工具函数 =====
function htmlToText(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

function segmentText(text: string, targetSize = 150): string[] {
  const maxSize = 300;
  const segments: string[] = [];
  const paragraphs = text
    .replace(/<br\s*\/?>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  for (const para of paragraphs) {
    const clean = htmlToText(para).trim();
    if (!clean) continue;
    if (clean.length <= maxSize) { segments.push(clean); continue; }
    const sentences = clean.split(/(?<=[。！？!?.])/);
    let buf = '';
    for (const s of sentences) {
      const t = s.trim();
      if (!t) continue;
      if (buf.length + t.length <= maxSize) { buf += t; }
      else { if (buf) segments.push(buf.trim()); buf = t.length > maxSize ? t.slice(0, maxSize) : t; }
    }
    if (buf.trim()) segments.push(buf.trim());
  }
  return segments.filter((s) => s.length > 0);
}

// ===== Bionic Reading =====
// 对 HTML 内容应用 Bionic Reading：加粗每个单词的前半部分
// 参考: bionic-reading.com — 加粗单词的前 50% 字符，创建视觉锚点
function applyBionicReading(html: string): string {
  const skipTags = new Set(['script', 'style', 'code', 'pre', 'textarea']);
  const result: string[] = [];
  let i = 0;
  let inTag = false;
  let skipDepth = 0;
  let tagBuf = '';

  while (i < html.length) {
    const ch = html[i];

    // 始终检测标签（即使 skipDepth > 0，也需要跟踪关闭标签）
    if (ch === '<') {
      result.push(ch);
      if (inTag) { i++; continue; }
      inTag = true;
      tagBuf = '<';
      i++;
      continue;
    }
    if (inTag) {
      tagBuf += ch;
      result.push(ch);
      if (ch === '>') {
        inTag = false;
        const clean = tagBuf.replace(/[<\/>]/g, '').trim().split(/\s/)[0].toLowerCase();
        if (clean.startsWith('/')) {
          const name = clean.slice(1);
          if (skipTags.has(name)) skipDepth = Math.max(0, skipDepth - 1);
        } else {
          const name = clean.replace(/\/$/, '');
          if (skipTags.has(name)) skipDepth++;
        }
        tagBuf = '';
      }
      i++;
      continue;
    }
    // 跳过 code/pre 内的文本内容
    if (skipDepth > 0) { result.push(ch); i++; continue; }

    // 收集文本直到下一个标签
    const textStart = i;
    while (i < html.length && html[i] !== '<') i++;
    const text = html.slice(textStart, i);
    result.push(bionicProcessText(text));
  }
  return result.join('');
}

function bionicProcessText(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // HTML 实体
    if (ch === '&') {
      const semi = text.indexOf(';', i);
      if (semi !== -1 && semi - i < 10) { out += text.slice(i, semi + 1); i = semi + 1; continue; }
    }

    // 空白
    if (/\s/.test(ch)) { out += ch; i++; continue; }

    // CJK 字符：按2字分组，加粗第一个字
    if (/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(ch)) {
      const start = i;
      while (i < text.length && /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(text[i])) i++;
      const cjk = text.slice(start, i);
      // 按2字分组
      for (let j = 0; j < cjk.length; j += 2) {
        if (j + 1 < cjk.length) {
          out += `<b class="br">${cjk[j]}</b>${cjk[j + 1]}`;
        } else {
          out += cjk[j];
        }
      }
      continue;
    }

    // 拉丁/数字单词：加粗前 50%
    const wStart = i;
    while (i < text.length && !/[\s<&\u4e00-\u9fff\u3400-\u4dbf]/.test(text[i])) i++;
    const word = text.slice(wStart, i);
    const boldLen = Math.ceil(word.length * 0.5);
    if (boldLen > 0 && word.length > 1) {
      out += `<b class="br">${word.slice(0, boldLen)}</b>${word.slice(boldLen)}`;
    } else {
      out += word;
    }
  }
  return out;
}

// ===== 关键词高亮（HTML 安全）=====
function highlightKeywords(html: string, keywords: string[]): string {
  if (keywords.length === 0) return html;
  // 构建单个正则，匹配所有关键词
  const escaped = keywords.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');

  const skipTags = new Set(['script', 'style', 'code', 'pre', 'textarea']);
  const result: string[] = [];
  let i = 0;
  let inTag = false;
  let skipDepth = 0;
  let tagBuf = '';

  while (i < html.length) {
    const ch = html[i];

    if (ch === '<') {
      // 先 flush 当前累积的文本（可能含关键词）
      // 不需要，因为文本是逐字符累积的
      result.push(ch);
      if (inTag) { i++; continue; }
      inTag = true;
      tagBuf = '<';
      i++;
      continue;
    }
    if (inTag) {
      tagBuf += ch;
      result.push(ch);
      if (ch === '>') {
        inTag = false;
        const clean = tagBuf.replace(/[<\/>]/g, '').trim().split(/\s/)[0].toLowerCase();
        if (clean.startsWith('/')) {
          const name = clean.slice(1);
          if (skipTags.has(name)) skipDepth = Math.max(0, skipDepth - 1);
        } else {
          const name = clean.replace(/\/$/, '');
          if (skipTags.has(name)) skipDepth++;
        }
        tagBuf = '';
      }
      i++;
      continue;
    }
    if (skipDepth > 0) { result.push(ch); i++; continue; }

    // 收集文本直到下一个标签
    const textStart = i;
    while (i < html.length && html[i] !== '<') i++;
    const text = html.slice(textStart, i);
    // 只对文本部分做关键词替换
    result.push(text.replace(re, '<span class="kw-highlight">$1</span>'));
  }
  return result.join('');
}

// ===== 子组件 =====

function SegmentedView({ html, segmentSize }: { html: string; segmentSize: number }) {
  const text = htmlToText(html);
  const segments = useMemo(() => segmentText(text, segmentSize), [text, segmentSize]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => Math.min(segments.length - 1, i + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [segments.length]);

  if (segments.length === 0)
    return <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 40 }}>暂无内容</div>;

  const pct = ((idx + 1) / segments.length) * 100;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 3, background: 'var(--color-bg-secondary)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-accent)', transition: 'width 0.3s' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 680, width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--font-size, 20px)', lineHeight: 'var(--line-height, 2)', letterSpacing: 'var(--letter-spacing, 0.05em)', textIndent: '2em' }}>
            {segments[idx]}
          </p>
        </div>
      </div>
      <div style={{ height: 56, borderTop: '1px solid var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <button className="adhd-btn" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>◀ 上一段</button>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13, minWidth: 80 }}>{idx + 1} / {segments.length}</span>
        <button className="adhd-btn" disabled={idx === segments.length - 1} onClick={() => setIdx((i) => i + 1)}>下一段 ▶</button>
      </div>
    </div>
  );
}

function SettingsModal({ settings, onClose, onSave }: { settings: any; onClose: () => void; onSave: (s: any) => void }) {
  const [local, setLocal] = useState({ ...settings });
  const [aiConfig, setAiConfig] = useState({ openrouterKey: '', defaultModel: '' });

  useEffect(() => {
    chrome.storage.local.get('ai', (d) => {
      if (d.ai) setAiConfig(d.ai);
    });
  }, []);

  const handleSave = () => {
    const merged = { ...local, ai: { ...local.ai, ...aiConfig } };
    onSave(merged);
  };

  const set = (path: string, val: any) => {
    const parts = path.split('.');
    setLocal((prev) => {
      const next: any = { ...prev };
      let obj: any = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] = { ...obj[parts[i]] };
      obj[parts[parts.length - 1]] = val;
      return next;
    });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-box" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 20, color: 'var(--color-text-primary)', fontSize: 18 }}>设置</h2>

        {/* AI */}
        <div className="settings-section">
          <h3>AI 助手</h3>
          <div className="s-row">
            <label className="s-label">OpenRouter API Key</label>
            <input
              className="s-input" type="password"
              value={aiConfig.openrouterKey}
              onChange={(e) => setAiConfig({ ...aiConfig, openrouterKey: e.target.value })}
              placeholder="sk-or-v1-..."
            />
            <div className="s-hint">在 openrouter.ai 注册获取密钥</div>
          </div>
          <div className="s-row">
            <label className="s-label">模型 ID（支持自定义）</label>
            <input
              className="s-input"
              value={aiConfig.defaultModel}
              onChange={(e) => setAiConfig({ ...aiConfig, defaultModel: e.target.value })}
              placeholder="例如: anthropic/claude-3-haiku"
            />
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap' }}>
              {MODEL_SUGGESTIONS.filter((m) => m !== aiConfig.defaultModel).map((m) => (
                <span key={m} className="model-chip" onClick={() => setAiConfig({ ...aiConfig, defaultModel: m })}>
                  {m.split('/').pop()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 阅读辅助 */}
        <div className="settings-section">
          <h3>阅读辅助</h3>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Bionic Reading</div>
              <div className="toggle-desc">加粗单词前半部分，创建视觉锚点，帮助快速阅读</div>
            </div>
            <div
              className={`toggle-switch ${local.reading.bionicReading ? 'on' : ''}`}
              onClick={() => set('reading.bionicReading', !local.reading.bionicReading)}
            />
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">专注暗角</div>
              <div className="toggle-desc">暗化页面边缘，聚焦视线到当前阅读区域</div>
            </div>
            <div
              className={`toggle-switch ${local.reading.focusMode === 'dim' ? 'on' : ''}`}
              onClick={() => set('reading.focusMode', local.reading.focusMode === 'dim' ? 'none' : 'dim')}
            />
          </div>
        </div>

        {/* 排版 */}
        <div className="settings-section">
          <h3>排版</h3>
          <div className="s-row">
            <label className="s-label">字体大小: {local.appearance.fontSize}px</label>
            <input type="range" min="16" max="28" value={local.appearance.fontSize} style={{ width: '100%' }}
              onChange={(e) => set('appearance.fontSize', Number(e.target.value))} />
          </div>
          <div className="s-row">
            <label className="s-label">行间距: {local.appearance.lineHeight}</label>
            <input type="range" min="1.6" max="2.4" step="0.1" value={local.appearance.lineHeight} style={{ width: '100%' }}
              onChange={(e) => set('appearance.lineHeight', Number(e.target.value))} />
          </div>
        </div>

        {/* 主题 */}
        <div className="settings-section">
          <h3>主题</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['warm', 'sepia', 'dark'] as const).map((t) => (
              <button key={t} className={`theme-btn ${local.appearance.theme === t ? 'active' : ''}`}
                onClick={() => set('appearance.theme', t)}
                style={{ background: t === 'warm' ? '#FDF8F3' : t === 'sepia' ? '#F0EAD6' : '#2D2A26', color: t === 'dark' ? '#E8E4DF' : '#3D3632' }}>
                {t === 'warm' ? '温暖' : t === 'sepia' ? '护眼' : '深色'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="adhd-btn" onClick={onClose}>取消</button>
          <button className="adhd-btn active" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ===== 主面板 =====
function ReaderPanel({ data, onClose }: { data: any; onClose: () => void }) {
  const title = data.title || document.title || '未命名文章';
  const htmlContent = data.content || data.fallback || '<p>无法提取内容</p>';
  const plainText = htmlToText(htmlContent);

  // State
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'continuous' | 'segmented'>('continuous');
  const [bionicOn, setBionicOn] = useState(false);
  const [focusDimOn, setFocusDimOn] = useState(false);
  const [summary, setSummary] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);

  // Load settings
  useEffect(() => {
    loadAllSettings().then((s) => {
      setSettings(s);
      setMode(s.reading.mode);
      setBionicOn(s.reading.bionicReading);
      setFocusDimOn(s.reading.focusMode === 'dim');
    });
  }, []);

  // Track scroll progress
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      const pct = maxScroll > 0 ? (el.scrollTop / maxScroll) * 100 : 0;
      setScrollPct(Math.min(100, Math.max(0, pct)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Theme vars
  const themeVars = THEMES[settings.appearance.theme] || THEMES.warm;
  const fontStyle: Record<string, string> = {
    '--font-size': `${settings.appearance.fontSize}px`,
    '--line-height': `${settings.appearance.lineHeight}`,
    '--letter-spacing': `${settings.appearance.letterSpacing}em`,
    '--panel-max-width': '720px',
  };

  // AI: Summary
  const requestSummary = async () => {
    if (!plainText) return;
    setAiLoading('summary');
    setShowSummary(true);
    setSummary('');
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'AI_SUMMARIZE', payload: { content: plainText } });
      if (resp?.payload?.summary) setSummary(resp.payload.summary);
      else if (resp?.payload?.error) setSummary('错误: ' + resp.payload.error);
      else setSummary('生成失败，请检查API密钥配置');
    } catch (e: any) {
      setSummary('请求失败: ' + (e.message || '未知错误'));
    }
    setAiLoading('');
  };

  // AI: Keywords
  const requestKeywords = async () => {
    if (!plainText) return;
    setAiLoading('keywords');
    setKeywords([]);
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'AI_EXTRACT_KEYWORDS', payload: { content: plainText } });
      if (resp?.payload?.keywords) setKeywords(resp.payload.keywords);
      else if (resp?.payload?.error) setKeywords(['错误: ' + resp.payload.error]);
    } catch (e: any) {
      setKeywords(['请求失败']);
    }
    setAiLoading('');
  };

  // Save settings
  const handleSaveSettings = (newSettings: any) => {
    setSettings(newSettings);
    setMode(newSettings.reading.mode);
    setBionicOn(newSettings.reading.bionicReading);
    setFocusDimOn(newSettings.reading.focusMode === 'dim');
    saveAllSettings(newSettings);
    setShowSettings(false);
  };

  // Toggle bionic (also persist)
  const toggleBionic = useCallback(() => {
    setBionicOn((prev) => {
      const next = !prev;
      const updated = { ...settings, reading: { ...settings.reading, bionicReading: next } };
      setSettings(updated);
      saveAllSettings(updated);
      return next;
    });
  }, [settings]);

  // Toggle focus dim (also persist)
  const toggleFocusDim = useCallback(() => {
    setFocusDimOn((prev) => {
      const next = !prev;
      const updated = { ...settings, reading: { ...settings.reading, focusMode: next ? 'dim' : 'none' } };
      setSettings(updated);
      saveAllSettings(updated);
      return next;
    });
  }, [settings]);

  // Process content: bionic + keyword highlighting
  const processedHtml = useMemo(() => {
    let result = htmlContent;
    // Apply bionic reading first
    if (bionicOn) result = applyBionicReading(result);
    // Then highlight keywords (HTML-aware)
    if (keywords.length > 0) {
      const validKws = keywords.filter((k) => !k.startsWith('错误') && k.length > 0);
      if (validKws.length > 0) {
        result = highlightKeywords(result, validKws);
      }
    }
    return result;
  }, [htmlContent, bionicOn, keywords]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483647,
        display: 'flex', flexDirection: 'column',
        fontFamily: '"LXGW WenKai", "Noto Serif SC", system-ui, serif',
        backgroundColor: 'var(--color-bg-primary)',
        ...themeVars,
        ...fontStyle,
      }}
    >
      {/* 顶栏 */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--color-bg-secondary)', flexShrink: 0, gap: 6 }}>
        <button className="adhd-btn" onClick={onClose}>← 返回</button>
        <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 8px' }}>
          {title}
        </h1>
        <button className={`adhd-btn ${bionicOn ? 'active' : ''}`} onClick={toggleBionic} title="Bionic Reading: 加粗单词前半部分">
          Bionic
        </button>
        <button className={`adhd-btn ${focusDimOn ? 'active' : ''}`} onClick={toggleFocusDim} title="专注暗角: 暗化边缘聚焦视线">
          专注
        </button>
        <button className={`adhd-btn ${mode === 'segmented' ? 'active' : ''}`}
          onClick={() => setMode((m) => (m === 'continuous' ? 'segmented' : 'continuous'))} title="分段阅读">
          {mode === 'continuous' ? '分段' : '连续'}
        </button>
        <button className="adhd-btn" disabled={!!aiLoading} onClick={requestSummary} title="AI 摘要">
          {aiLoading === 'summary' ? '...' : '摘要'}
        </button>
        <button className="adhd-btn" disabled={!!aiLoading} onClick={requestKeywords} title="AI 关键词">
          {aiLoading === 'keywords' ? '...' : '关键词'}
        </button>
        <button className="adhd-btn" onClick={() => setShowSettings(true)} title="设置">⚙</button>
      </div>

      {/* 内容区 */}
      {mode === 'continuous' ? (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div
            ref={contentRef}
            className={focusDimOn ? 'focus-dim' : ''}
            style={{ height: '100%', overflow: 'auto', padding: '32px 40px', position: 'relative' }}
          >
            {showSummary && (
              <div className="summary-box">
                <div className="summary-title" onClick={() => setShowSummary(false)}>
                  <span>AI 摘要</span>
                  <span style={{ fontSize: 12 }}>{summary ? '收起' : ''}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {aiLoading === 'summary' ? '正在生成...' : summary || '点击上方"摘要"按钮'}
                </div>
                {summary && (
                  <button
                    onClick={() => navigator.clipboard.writeText(summary)}
                    style={{ marginTop: 8, background: 'none', border: '1px solid var(--color-bg-secondary)', borderRadius: 4, padding: '3px 10px', fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                  >
                    复制摘要
                  </button>
                )}
              </div>
            )}
            {keywords.length > 0 && (
              <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {keywords.filter((k) => !k.startsWith('错误')).map((kw, i) => (
                  <span key={i} className="keyword-tag">{kw}</span>
                ))}
              </div>
            )}
            <div
              className="adhd-content"
              style={{
                maxWidth: 'var(--panel-max-width)', margin: '0 auto',
                fontSize: 'var(--font-size)', lineHeight: 'var(--line-height)',
                letterSpacing: 'var(--letter-spacing)', color: 'var(--color-text-primary)',
              }}
              dangerouslySetInnerHTML={{ __html: processedHtml }}
            />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SegmentedView html={htmlContent} segmentSize={settings.reading.segmentSize} />
        </div>
      )}

      {/* 底栏 */}
      <div style={{ height: 36, borderTop: '1px solid var(--color-bg-secondary)', display: 'flex', alignItems: 'center', padding: '0 20px', color: 'var(--color-text-secondary)', fontSize: 12, flexShrink: 0, gap: 12 }}>
        {mode === 'continuous' && (
          <div style={{ flex: 1, height: 3, background: 'var(--color-bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${scrollPct}%`, background: 'var(--color-accent)', transition: 'width 0.2s' }} />
          </div>
        )}
        <span style={{ whiteSpace: 'nowrap' }}>
          {plainText.length > 0 && (
            <span style={{ marginRight: 8 }}>
              {Math.max(1, Math.ceil(plainText.length / 500))} 分钟阅读
            </span>
          )}
          Esc 关闭 · Alt+R 切换
        </span>
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
      )}
    </div>
  );
}

// ===== Overlay 管理 =====
function createOverlay(data: any) {
  if (shadowRoot) {
    if (reactRoot) reactRoot.render(<ReaderPanel data={data} onClose={removeOverlay} />);
    return;
  }
  rootContainer = document.createElement('div');
  rootContainer.id = 'adhd-reader-root';
  document.body.appendChild(rootContainer);
  shadowRoot = rootContainer.attachShadow({ mode: 'closed' });
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  shadowRoot.appendChild(styleEl);
  const appEl = document.createElement('div');
  shadowRoot.appendChild(appEl);
  reactRoot = createRoot(appEl);
  reactRoot.render(<ReaderPanel data={data} onClose={removeOverlay} />);
}

function removeOverlay() {
  if (reactRoot) { reactRoot.unmount(); reactRoot = null; }
  if (rootContainer) { rootContainer.remove(); rootContainer = null; }
  shadowRoot = null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && readerOpen) { readerOpen = false; removeOverlay(); }
});

async function toggleReader() {
  if (readerOpen) { readerOpen = false; removeOverlay(); return; }
  const result = extractContent();
  readerOpen = true;
  createOverlay(result);
}

console.log('[ADHD Reader] Content script loaded');
