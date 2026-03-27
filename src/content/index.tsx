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
  reading: { bionicReading: false, lineFocus: false, focusMask: false, ruler: false, beeline: false },
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

  .br { font-weight: 700; }

  .kw-highlight {
    background: var(--color-accent);
    color: var(--color-bg-primary);
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 500;
  }

  .adhd-content.beeline {
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .adhd-content.beeline * {
    -webkit-text-fill-color: transparent !important;
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
  .settings-section h3 { margin-bottom: 12px; color: 'var(--color-text-primary)'; font-size: 16px; }
  .s-label { display: block; margin-bottom: 6px; color: 'var(--color-text-secondary); font-size: 13px; }
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
  .toggle-label { color: 'var(--color-text-primary)'; font-size: 14px; }
  .toggle-desc { color: 'var(--color-text-secondary)'; font-size: 11px; margin-top: 2px; }
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

// ===== Bionic Reading =====
function applyBionicReading(html: string): string {
  const skipTags = new Set(['script', 'style', 'code', 'pre', 'textarea']);
  const result: string[] = [];
  let i = 0;
  let inTag = false;
  let skipDepth = 0;
  let tagBuf = '';

  while (i < html.length) {
    const ch = html[i];
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
    if (skipDepth > 0) { result.push(ch); i++; continue; }
    const textStart = i;
    while (i < html.length && html[i] !== '<') i++;
    result.push(bionicProcessText(html.slice(textStart, i)));
  }
  return result.join('');
}

function bionicProcessText(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '&') {
      const semi = text.indexOf(';', i);
      if (semi !== -1 && semi - i < 10) { out += text.slice(i, semi + 1); i = semi + 1; continue; }
    }
    if (/\s/.test(ch)) { out += ch; i++; continue; }
    if (/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(ch)) {
      const start = i;
      while (i < text.length && /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(text[i])) i++;
      const cjk = text.slice(start, i);
      for (let j = 0; j < cjk.length; j += 2) {
        if (j + 1 < cjk.length) out += `<b class="br">${cjk[j]}</b>${cjk[j + 1]}`;
        else out += cjk[j];
      }
      continue;
    }
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
    const textStart = i;
    while (i < html.length && html[i] !== '<') i++;
    result.push(html.slice(textStart, i).replace(re, '<span class="kw-highlight">$1</span>'));
  }
  return result.join('');
}

// ===== 子组件 =====

/**
 * FocusOverlay — 在非滚动父容器中放置固定定位的遮罩层。
 * 使用半透明深色覆盖上下区域，中央保留透明窗口让内容可见。
 * 遮罩不在滚动容器内，始终覆盖视口中央。
 */
function FocusOverlay({ mode }: { mode: 'lineFocus' | 'focusMask' }) {
  const gradient =
    mode === 'lineFocus'
      ? 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.70) 36%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.35) 44%, rgba(0,0,0,0.15) 47%, transparent 50%, rgba(0,0,0,0.15) 53%, rgba(0,0,0,0.35) 56%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.70) 64%, rgba(0,0,0,0.72) 100%)'
      : 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.58) 18%, rgba(0,0,0,0.45) 24%, rgba(0,0,0,0.28) 30%, rgba(0,0,0,0.1) 35%, transparent 40%, transparent 60%, rgba(0,0,0,0.1) 65%, rgba(0,0,0,0.28) 70%, rgba(0,0,0,0.45) 76%, rgba(0,0,0,0.58) 82%, rgba(0,0,0,0.6) 100%)';

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 2,
        background: gradient,
      }}
    />
  );
}

/**
 * ReadingRuler — 参考 Helperbird Reading Ruler
 * 一条半透明彩色横条固定在视口中央，随滚动高亮当前阅读行。
 */
function ReadingRuler({ lineHeightPx }: { lineHeightPx: number }) {
  const h = Math.round(lineHeightPx * 2.2);
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      height: h,
      marginTop: -h / 2,
      pointerEvents: 'none',
      zIndex: 2,
      background: `linear-gradient(to bottom,
        transparent 0%,
        rgba(255, 210, 0, 0.15) 12%,
        rgba(255, 210, 0, 0.22) 50%,
        rgba(255, 210, 0, 0.15) 88%,
        transparent 100%
      )`,
      borderTop: '1px solid rgba(255, 210, 0, 0.35)',
      borderBottom: '1px solid rgba(255, 210, 0, 0.35)',
    }} />
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
              <div className="toggle-label">行聚焦 (Line Focus)</div>
              <div className="toggle-desc">只高亮当前 3 行内容，其余暗化，保留完整排版</div>
            </div>
            <div
              className={`toggle-switch ${local.reading.lineFocus ? 'on' : ''}`}
              onClick={() => set('reading.lineFocus', !local.reading.lineFocus)}
            />
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">阅读遮罩 (Focus Mask)</div>
              <div className="toggle-desc">宽幅聚焦区域，暗化上下边缘，减少视觉干扰</div>
            </div>
            <div
              className={`toggle-switch ${local.reading.focusMask ? 'on' : ''}`}
              onClick={() => set('reading.focusMask', !local.reading.focusMask)}
            />
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">阅读标尺 (Reading Ruler)</div>
              <div className="toggle-desc">彩色横条高亮当前行，帮助追踪阅读位置</div>
            </div>
            <div
              className={`toggle-switch ${local.reading.ruler ? 'on' : ''}`}
              onClick={() => set('reading.ruler', !local.reading.ruler)}
            />
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">BeeLine 彩读</div>
              <div className="toggle-desc">每行文字颜色渐变，引导视线自然过渡到下一行</div>
            </div>
            <div
              className={`toggle-switch ${local.reading.beeline ? 'on' : ''}`}
              onClick={() => set('reading.beeline', !local.reading.beeline)}
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
  const [summary, setSummary] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);

  // Derived from settings
  const bionicOn = settings.reading.bionicReading;
  const lineFocusOn = settings.reading.lineFocus;
  const focusMaskOn = settings.reading.focusMask;
  const rulerOn = settings.reading.ruler;
  const beelineOn = settings.reading.beeline;

  // Load settings
  useEffect(() => {
    loadAllSettings().then((s) => {
      setSettings(s);
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
    saveAllSettings(newSettings);
    setShowSettings(false);
  };

  // Toggle helpers
  const toggleSetting = useCallback((key: string) => {
    setSettings((prev) => {
      const updated = { ...prev, reading: { ...prev.reading, [key]: !(prev.reading as any)[key] } };
      saveAllSettings(updated);
      return updated;
    });
  }, []);

  const toggleBionic = useCallback(() => toggleSetting('bionicReading'), [toggleSetting]);
  const toggleLineFocus = useCallback(() => toggleSetting('lineFocus'), [toggleSetting]);
  const toggleFocusMask = useCallback(() => toggleSetting('focusMask'), [toggleSetting]);
  const toggleRuler = useCallback(() => toggleSetting('ruler'), [toggleSetting]);
  const toggleBeeline = useCallback(() => toggleSetting('beeline'), [toggleSetting]);

  // Line height in pixels (for ruler & beeline)
  const lineHeightPx = settings.appearance.fontSize * settings.appearance.lineHeight;

  // BeeLine gradient colors per theme
  const beelineGradient = useMemo(() => {
    const colors = settings.appearance.theme === 'dark'
      ? ['#7fb3d8', '#a8e6cf', '#ffd3b6', '#dcedc1']
      : ['#1a5276', '#117a65', '#7d6608', '#935116'];
    const stops = colors.flatMap((c, i) => {
      const s = (i / colors.length * 100).toFixed(1);
      const e = ((i + 1) / colors.length * 100).toFixed(1);
      return [`${c} ${s}%`, `${c} ${e}%`];
    });
    return `repeating-linear-gradient(to bottom, ${stops.join(', ')})`;
  }, [settings.appearance.theme]);
  const beelineBgSize = `${lineHeightPx * 4}px`;

  // Process content: bionic + keyword highlighting
  const processedHtml = useMemo(() => {
    let result = htmlContent;
    if (bionicOn) result = applyBionicReading(result);
    if (keywords.length > 0) {
      const validKws = keywords.filter((k) => !k.startsWith('错误') && k.length > 0);
      if (validKws.length > 0) result = highlightKeywords(result, validKws);
    }
    return result;
  }, [htmlContent, bionicOn, keywords]);

  // Determine which overlay to show (mutually exclusive)
  const overlayMode = rulerOn
    ? 'ruler' as const
    : lineFocusOn
      ? 'lineFocus' as const
      : focusMaskOn
        ? 'focusMask' as const
        : null;

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
        <button className={`adhd-btn ${bionicOn ? 'active' : ''}`} onClick={toggleBionic} title="加粗单词前半部分，创建视觉锚点">
          Bionic
        </button>
        <button className={`adhd-btn ${beelineOn ? 'active' : ''}`} onClick={toggleBeeline} title="每行文字颜色渐变，引导视线自然过渡">
          彩读
        </button>
        <button className={`adhd-btn ${lineFocusOn ? 'active' : ''}`} onClick={toggleLineFocus} title="只高亮当前3行，其余暗化">
          聚焦
        </button>
        <button className={`adhd-btn ${focusMaskOn ? 'active' : ''}`} onClick={toggleFocusMask} title="宽幅聚焦区域，暗化上下边缘">
          遮罩
        </button>
        <button className={`adhd-btn ${rulerOn ? 'active' : ''}`} onClick={toggleRuler} title="彩色标尺高亮当前阅读行">
          标尺
        </button>
        <button className="adhd-btn" disabled={!!aiLoading} onClick={requestSummary} title="AI 摘要">
          {aiLoading === 'summary' ? '...' : '摘要'}
        </button>
        <button className="adhd-btn" disabled={!!aiLoading} onClick={requestKeywords} title="AI 关键词">
          {aiLoading === 'keywords' ? '...' : '关键词'}
        </button>
        <button className="adhd-btn" onClick={() => setShowSettings(true)} title="设置">⚙</button>
      </div>

      {/* 内容区 — 遮罩层在非滚动父容器中，始终覆盖视口中央 */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div ref={contentRef} style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
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
            className={`adhd-content${beelineOn ? ' beeline' : ''}`}
            style={{
              maxWidth: 'var(--panel-max-width)', margin: '0 auto',
              fontSize: 'var(--font-size)', lineHeight: 'var(--line-height)',
              letterSpacing: 'var(--letter-spacing)', color: 'var(--color-text-primary)',
              ...(beelineOn ? { backgroundImage: beelineGradient, backgroundSize: `100% ${beelineBgSize}` } : {}),
            }}
            dangerouslySetInnerHTML={{ __html: processedHtml }}
          />
        </div>
        {/* 覆盖层 — 在滚动容器外面，固定覆盖视口 */}
        {overlayMode === 'ruler' && <ReadingRuler lineHeightPx={lineHeightPx} />}
        {overlayMode === 'lineFocus' && <FocusOverlay mode="lineFocus" />}
        {overlayMode === 'focusMask' && <FocusOverlay mode="focusMask" />}
      </div>

      {/* 底栏 */}
      <div style={{ height: 36, borderTop: '1px solid var(--color-bg-secondary)', display: 'flex', alignItems: 'center', padding: '0 20px', color: 'var(--color-text-secondary)', fontSize: 12, flexShrink: 0, gap: 12 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--color-bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${scrollPct}%`, background: 'var(--color-accent)', transition: 'width 0.2s' }} />
        </div>
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
