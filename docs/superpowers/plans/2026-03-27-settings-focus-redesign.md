# ADHD 专注阅读器 - 设置面板 + 功能优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复设置面板样式错乱、修复字体大小 Bug、用色彩渐变引导替代彩度、用段落聚焦替代聚焦/遮罩/标尺，全面提升 ADHD 阅读体验。

**Architecture:** 所有改动集中在 `src/content/index.tsx` 单体文件内（939行）。不重构为模块化，保持现有 Shadow DOM + 内联 React 组件架构。通过修改数据结构、组件渲染和 CSS 实现功能升级。

**Tech Stack:** React 18 + TypeScript, Shadow DOM, CSS background-clip: text, requestAnimationFrame, Chrome Storage API

---

## File Structure

所有修改集中在单一文件：

| 文件 | 职责 |
|------|------|
| `src/content/index.tsx` | 主内容脚本 — 包含所有 UI 组件、设置逻辑、功能实现 |

CSS 字体文件通过在 `createOverlay` 中动态插入 `<link>` 标签加载到 Shadow DOM。

---

## 实施步骤概览

| 步骤 | 内容 | 预估工作量 |
|------|------|-----------|
| 1 | 数据结构变更 + 设置迁移函数 | ~10 min |
| 2 | CSS 修复（引号 bug） | ~5 min |
| 3 | 字体大小 Bug 修复 | ~5 min |
| 4 | 字体选择 + CDN 加载 | ~15 min |
| 5 | 色彩渐变实现（替代 BeeLine） | ~15 min |
| 6 | 段落标记函数 | ~10 min |
| 7 | 段落聚焦组件 + 滚动追踪 | ~20 min |
| 8 | 设置面板 UI 重写 | ~25 min |
| 9 | 顶栏按钮更新 | ~10 min |
| 10 | 清理旧组件代码 | ~10 min |
| 11 | 集成测试 + 构建验证 | ~10 min |

---

### Task 1: 数据结构变更 + 设置迁移

**修改:** `src/content/index.tsx`

- [ ] **Step 1: 更新 DEFAULT_SETTINGS 常量**

```typescript
// 替换行 65-69 的 DEFAULT_SETTINGS
const DEFAULT_SETTINGS = {
  reading: {
    bionicReading: false,
    paragraphFocus: false,
    colorGradient: false,
    gradientScheme: 'blueRed' as 'blueRed' | 'greenPurple' | 'warm',
    gradientIntensity: 70,
  },
  appearance: {
    fontSize: 20,
    lineHeight: 2.0,
    letterSpacing: 0.05,
    theme: 'warm' as string,
    fontFamily: 'system',
  },
  ai: { enableSummary: true, enableKeywords: true },
};
```

- [ ] **Step 2: 添加渐变色系常量**

在 `THEMES` 常量之后添加：

```typescript
const GRADIENT_SCHEMES: Record<string, { light: string[]; dark: string[] }> = {
  blueRed: {
    light: ['#1a5276', '#8e44ad', '#c0392b'],
    dark:  ['#6BB5E8', '#BB8FCE', '#E74C3C'],
  },
  greenPurple: {
    light: ['#117a65', '#6c3483', '#935116'],
    dark:  ['#48C9B0', '#AF7AC5', '#E67E22'],
  },
  warm: {
    light: ['#935116', '#c0392b', '#8e44ad'],
    dark:  ['#E67E22', '#E74C3C', '#BB8FCE'],
  },
};
```

- [ ] **Step 3: 添加字体选项常量**

```typescript
const FONT_OPTIONS = [
  { value: 'system', label: '系统默认', css: 'system-ui, -apple-system, sans-serif' },
  { value: 'serif', label: '思源宋体', css: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif' },
  { value: 'georgia', label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { value: 'dyslexic', label: 'OpenDyslexic', css: '"OpenDyslexic", sans-serif' },
  { value: 'lexend', label: 'Lexend', css: '"Lexend", sans-serif' },
];
```

- [ ] **Step 4: 添加设置迁移函数**

在 `loadAllSettings` 函数之后添加：

```typescript
function migrateSettings(s: any): any {
  const reading = { ...s.reading };
  // 合并旧的三个开关为 paragraphFocus
  if (reading.lineFocus || reading.focusMask || reading.ruler) {
    reading.paragraphFocus = true;
    delete reading.lineFocus;
    delete reading.focusMask;
    delete reading.ruler;
  }
  // beeline → colorGradient
  if (reading.beeline !== undefined) {
    reading.colorGradient = reading.beeline;
    delete reading.beeline;
  }
  if (reading.gradientScheme === undefined) reading.gradientScheme = 'blueRed';
  if (reading.gradientIntensity === undefined) reading.gradientIntensity = 70;
  if (reading.paragraphFocus === undefined) reading.paragraphFocus = false;

  const appearance = { ...s.appearance };
  if (appearance.fontFamily === undefined) appearance.fontFamily = 'system';

  return { ...s, reading, appearance };
}
```

- [ ] **Step 5: 在 loadAllSettings 中调用迁移**

修改 `loadAllSettings` 的返回值：

```typescript
// 修改 loadAllSettings 函数的 return 语句
return migrateSettings({
  ...DEFAULT_SETTINGS,
  ...syncData,
  ai: { ...DEFAULT_SETTINGS.ai, ...localData.ai },
});
```

- [ ] **Step 6: 更新 saveAllSettings 的 AI 字段**

确保 `saveAllSettings` 正确处理新的 AI 字段（`gradientScheme` 和 `gradientIntensity` 不属于 AI，已在 `reading` 中）。

```typescript
function saveAllSettings(settings: any) {
  const syncSettings = {
    reading: settings.reading,
    appearance: settings.appearance,
    ai: { enableSummary: settings.ai?.enableSummary, enableKeywords: settings.ai?.enableKeywords },
  };
  const localSettings = {
    ai: { openrouterKey: settings.ai?.openrouterKey, defaultModel: settings.ai?.defaultModel },
  };
  chrome.storage.sync.set(syncSettings);
  chrome.storage.local.set(localSettings);
}
```

---

### Task 2: CSS 修复

**修改:** `src/content/index.tsx` — STYLES 常量 (行 107-278)

- [ ] **Step 1: 修复 CSS 引号 bug（4 处）**

```css
/* 修复前 (行 215): */
.settings-section h3 { margin-bottom: 12px; color: 'var(--color-text-primary)'; font-size: 16px; }
/* 修复后: */
.settings-section h3 { margin-bottom: 12px; color: var(--color-text-primary); font-size: 16px; }

/* 修复前 (行 216): */
.s-label { display: block; margin-bottom: 6px; color: 'var(--color-text-secondary); font-size: 13px; }
/* 修复后: */
.s-label { display: block; margin-bottom: 6px; color: var(--color-text-secondary); font-size: 13px; }

/* 修复前 (行 256): */
.toggle-label { color: 'var(--color-text-primary)'; font-size: 14px; }
/* 修复后: */
.toggle-label { color: var(--color-text-primary); font-size: 14px; }

/* 修复前 (行 257): */
.toggle-desc { color: 'var(--color-text-secondary)'; font-size: 11px; margin-top: 2px; }
/* 修复后: */
.toggle-desc { color: var(--color-text-secondary); font-size: 11px; margin-top: 2px; }
```

- [ ] **Step 2: 添加新功能所需的 CSS**

在 STYLES 常量末尾（`.toggle-switch.on::after` 之后）添加：

```css
  .section-divider {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 16px 0 8px;
    border-bottom: 1px solid var(--color-bg-secondary);
    margin-bottom: 12px;
  }

  .gradient-scheme-btn {
    display: inline-block;
    padding: 4px 12px;
    border: 1px solid var(--color-bg-secondary);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
  }
  .gradient-scheme-btn.active {
    border-color: var(--color-interactive);
    background: var(--color-interactive);
    color: #fff;
  }

  .font-select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--color-bg-secondary);
    border-radius: 6px;
    font-size: 14px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    outline: none;
    cursor: pointer;
  }
  .font-select:focus { border-color: var(--color-interactive); }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .slider-row label {
    min-width: 60px;
    font-size: 13px;
    color: var(--color-text-secondary);
  }
  .slider-row input[type="range"] { flex: 1; }
  .slider-row .slider-value {
    min-width: 50px;
    text-align: right;
    font-size: 13px;
    color: var(--color-text-primary);
  }
```

---

### Task 3: 字体大小 Bug 修复

**修改:** `src/content/index.tsx` — ReaderPanel 组件

- [ ] **Step 1: 修改 fontStyle（行 696-701）**

```jsx
// 修复前:
const fontStyle: Record<string, string> = {
  '--font-size': `${settings.appearance.fontSize}px`,
  '--line-height': `${settings.appearance.lineHeight}`,
  '--letter-spacing': `${settings.appearance.letterSpacing}em`,
  '--panel-max-width': '720px',
};

// 修复后:
const fontFamily = FONT_OPTIONS.find(f => f.value === settings.appearance.fontFamily)?.css || FONT_OPTIONS[0].css;
const fontStyle: Record<string, string> = {
  '--panel-max-width': '720px',
};
```

- [ ] **Step 2: 修改根容器样式（行 796-803）**

```jsx
// 在根 div 的 style 中添加 fontFamily:
style={{
  position: 'fixed', inset: 0, zIndex: 2147483647,
  display: 'flex', flexDirection: 'column',
  fontFamily: fontFamily,  // 使用动态字体
  backgroundColor: 'var(--color-bg-primary)',
  ...themeVars,
  ...fontStyle,
}}
```

- [ ] **Step 3: 修改内容区样式（行 864-873）**

```jsx
// 修复前:
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

// 修复后:
<div
  className={`adhd-content${settings.reading.colorGradient ? ' color-gradient' : ''}`}
  style={{
    maxWidth: 'var(--panel-max-width)', margin: '0 auto',
    fontSize: settings.appearance.fontSize,           // 直接数值，不用 CSS 变量
    lineHeight: settings.appearance.lineHeight,       // 直接数值
    letterSpacing: `${settings.appearance.letterSpacing}em`,
    color: 'var(--color-text-primary)',
    ...(settings.reading.colorGradient ? {
      backgroundImage: currentGradient,
      backgroundSize: `100% ${lineHeightPx * 4}px`,
      filter: `saturate(${settings.reading.gradientIntensity / 100})`,
    } : {}),
  }}
  dangerouslySetInnerHTML={{ __html: processedHtml }}
/>
```

---

### Task 4: 字体选择 + CDN 加载

**修改:** `src/content/index.tsx`

- [ ] **Step 1: 在 createOverlay 函数中加载字体 CDN**

```typescript
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

  // 加载 Google Fonts (Lexend + OpenDyslexic)
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;700&display=swap';
  shadowRoot.appendChild(linkEl);

  const odLink = document.createElement('link');
  odLink.rel = 'stylesheet';
  odLink.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.css';
  shadowRoot.appendChild(odLink);

  const appEl = document.createElement('div');
  shadowRoot.appendChild(appEl);
  reactRoot = createRoot(appEl);
  reactRoot.render(<ReaderPanel data={data} onClose={removeOverlay} />);
}
```

---

### Task 5: 色彩渐变实现

**修改:** `src/content/index.tsx` — ReaderPanel 组件

- [ ] **Step 1: 替换 beelineGradient 为 currentGradient**

```jsx
// 删除旧的 beelineGradient useMemo (行 761-771)
// 替换为:
const currentGradient = useMemo(() => {
  const scheme = GRADIENT_SCHEMES[settings.reading.gradientScheme] || GRADIENT_SCHEMES.blueRed;
  const isDark = settings.appearance.theme === 'dark';
  const colors = isDark ? scheme.dark : scheme.light;
  const stops = colors.flatMap((c, i) => {
    const s = (i / colors.length * 100).toFixed(1);
    const e = ((i + 1) / colors.length * 100).toFixed(1);
    return [`${c} ${s}%`, `${c} ${e}%`];
  });
  return `repeating-linear-gradient(to bottom, ${stops.join(', ')})`;
}, [settings.reading.gradientScheme, settings.appearance.theme]);

// 删除旧的 beelineBgSize (行 772)
```

- [ ] **Step 2: 更新 CSS 类名**

```css
/* 修改行 159-166，将 .beeline 改为 .color-gradient */
.color-gradient {
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.color-gradient * {
  -webkit-text-fill-color: transparent !important;
}
```

- [ ] **Step 3: 更新 derived state**

```jsx
// 修改行 668-672:
const bionicOn = settings.reading.bionicReading;
const paragraphFocusOn = settings.reading.paragraphFocus;
const colorGradientOn = settings.reading.colorGradient;
```

---

### Task 6: 段落标记函数

**修改:** `src/content/index.tsx`

- [ ] **Step 1: 添加段落标记函数**

在 `highlightKeywords` 函数之后添加：

```typescript
// ===== 段落标记 =====
function addParagraphMarkers(html: string): string {
  let counter = 0;
  return html.replace(/<(p|li|blockquote)([\s>])/gi, (_match, tag: string, after: string) => {
    return `<${tag} data-para="${counter++}"${after}`;
  });
}
```

- [ ] **Step 2: 在 processedHtml 中调用段落标记**

```jsx
// 修改 processedHtml useMemo (行 775-783):
const processedHtml = useMemo(() => {
  let result = htmlContent;
  if (bionicOn) result = applyBionicReading(result);
  if (keywords.length > 0) {
    const validKws = keywords.filter((k) => !k.startsWith('错误') && k.length > 0);
    if (validKws.length > 0) result = highlightKeywords(result, validKws);
  }
  if (paragraphFocusOn) result = addParagraphMarkers(result);
  return result;
}, [htmlContent, bionicOn, keywords, paragraphFocusOn]);
```

---

### Task 7: 段落聚焦组件 + 滚动追踪

**修改:** `src/content/index.tsx` — ReaderPanel 组件

- [ ] **Step 1: 添加段落聚焦 useEffect**

在现有 scroll progress useEffect 之后（行 692 之后）添加：

```jsx
// 段落聚焦
useEffect(() => {
  if (!settings.reading.paragraphFocus || !contentRef.current) return;
  const container = contentRef.current;
  let rafId: number;

  const updateFocus = () => {
    const paras = container.querySelectorAll('[data-para]');
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;

    paras.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elCenter - centerY);
      const height = containerRect.height;

      let opacity: number;
      if (distance < height * 0.15) {
        opacity = 1.0;
      } else if (distance < height * 0.35) {
        opacity = 0.5;
      } else {
        opacity = 0.25;
      }

      (el as HTMLElement).style.opacity = String(opacity);
      (el as HTMLElement).style.transition = 'opacity 0.3s ease';
    });
  };

  const onScroll = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateFocus);
  };

  container.addEventListener('scroll', onScroll, { passive: true });
  updateFocus();

  return () => {
    container.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(rafId);
    // 恢复所有段落 opacity
    container.querySelectorAll('[data-para]').forEach((el) => {
      (el as HTMLElement).style.opacity = '';
      (el as HTMLElement).style.transition = '';
    });
  };
}, [settings.reading.paragraphFocus, processedHtml]);
```

---

### Task 8: 设置面板 UI 重写

**修改:** `src/content/index.tsx` — SettingsModal 组件 (行 495-648)

- [ ] **Step 1: 重写 SettingsModal 组件**

```jsx
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
    setLocal((prev: any) => {
      const next = { ...prev };
      let obj: any = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] = { ...obj[parts[i]] };
      obj[parts[parts.length - 1]] = val;
      return next;
    });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: 'var(--color-text-primary)', fontSize: 18, margin: 0 }}>阅读设置</h2>
          <button className="adhd-btn" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
        </div>

        {/* ── 阅读辅助 ── */}
        <div className="section-divider">阅读辅助</div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Bionic 阅读</div>
            <div className="toggle-desc">加粗单词前半部分，创建视觉锚点</div>
          </div>
          <div
            className={`toggle-switch ${local.reading.bionicReading ? 'on' : ''}`}
            onClick={() => set('reading.bionicReading', !local.reading.bionicReading)}
          />
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">段落聚焦</div>
            <div className="toggle-desc">跟随当前段落高亮，其他段落淡化</div>
          </div>
          <div
            className={`toggle-switch ${local.reading.paragraphFocus ? 'on' : ''}`}
            onClick={() => set('reading.paragraphFocus', !local.reading.paragraphFocus)}
          />
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">色彩渐变</div>
            <div className="toggle-desc">文字颜色渐变引导视线，帮助追踪阅读位置</div>
          </div>
          <div
            className={`toggle-switch ${local.reading.colorGradient ? 'on' : ''}`}
            onClick={() => set('reading.colorGradient', !local.reading.colorGradient)}
          />
        </div>

        {local.reading.colorGradient && (
          <div style={{ padding: '8px 0 12px' }}>
            <div style={{ marginBottom: 10 }}>
              <label className="s-label">渐变色系</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'blueRed', label: '蓝红渐变', colors: ['#1a5276', '#8e44ad', '#c0392b'] },
                  { value: 'greenPurple', label: '绿紫渐变', colors: ['#117a65', '#6c3483', '#935116'] },
                  { value: 'warm', label: '暖色渐变', colors: ['#935116', '#c0392b', '#8e44ad'] },
                ].map((s) => (
                  <span
                    key={s.value}
                    className={`gradient-scheme-btn ${local.reading.gradientScheme === s.value ? 'active' : ''}`}
                    onClick={() => set('reading.gradientScheme', s.value)}
                    style={local.reading.gradientScheme === s.value ? {
                      background: `linear-gradient(135deg, ${s.colors[0]}, ${s.colors[1]}, ${s.colors[2]})`,
                      color: '#fff',
                      border: 'none',
                    } : {}}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="slider-row">
              <label>渐变强度</label>
              <input
                type="range" min="20" max="100"
                value={local.reading.gradientIntensity}
                onChange={(e) => set('reading.gradientIntensity', Number(e.target.value))}
              />
              <span className="slider-value">{local.reading.gradientIntensity}</span>
            </div>
          </div>
        )}

        {/* ── 排版 ── */}
        <div className="section-divider">排版</div>

        <div className="s-row">
          <label className="s-label">字体</label>
          <select
            className="font-select"
            value={local.appearance.fontFamily}
            onChange={(e) => set('appearance.fontFamily', e.target.value)}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="slider-row">
          <label>字号</label>
          <input
            type="range" min="14" max="32"
            value={local.appearance.fontSize}
            onChange={(e) => set('appearance.fontSize', Number(e.target.value))}
          />
          <span className="slider-value">{local.appearance.fontSize}px</span>
        </div>

        <div className="slider-row">
          <label>行高</label>
          <input
            type="range" min="1.4" max="2.6" step="0.1"
            value={local.appearance.lineHeight}
            onChange={(e) => set('appearance.lineHeight', Number(e.target.value))}
          />
          <span className="slider-value">{local.appearance.lineHeight}</span>
        </div>

        <div className="slider-row">
          <label>字间距</label>
          <input
            type="range" min="0" max="0.15" step="0.01"
            value={local.appearance.letterSpacing}
            onChange={(e) => set('appearance.letterSpacing', Number(e.target.value))}
          />
          <span className="slider-value">{local.appearance.letterSpacing}em</span>
        </div>

        {/* ── 主题 ── */}
        <div className="section-divider">主题</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {(['warm', 'sepia', 'dark'] as const).map((t) => (
            <button
              key={t}
              className={`theme-btn ${local.appearance.theme === t ? 'active' : ''}`}
              onClick={() => set('appearance.theme', t)}
              style={{
                background: t === 'warm' ? '#FDF8F3' : t === 'sepia' ? '#F0EAD6' : '#2D2A26',
                color: t === 'dark' ? '#E8E4DF' : '#3D3632',
              }}
            >
              {t === 'warm' ? '温暖' : t === 'sepia' ? '护眼' : '深色'}
            </button>
          ))}
        </div>

        {/* ── AI ── */}
        <div className="section-divider">AI 助手</div>

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
              <span
                key={m}
                className="model-chip"
                onClick={() => setAiConfig({ ...aiConfig, defaultModel: m })}
              >
                {m.split('/').pop()}
              </span>
            ))}
          </div>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">文章摘要</div>
          </div>
          <div
            className={`toggle-switch ${local.ai.enableSummary ? 'on' : ''}`}
            onClick={() => set('ai.enableSummary', !local.ai.enableSummary)}
          />
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">关键词提取</div>
          </div>
          <div
            className={`toggle-switch ${local.ai.enableKeywords ? 'on' : ''}`}
            onClick={() => set('ai.enableKeywords', !local.ai.enableKeywords)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="adhd-btn" onClick={onClose}>取消</button>
          <button className="adhd-btn active" onClick={handleSave}>保存设置</button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 9: 顶栏按钮更新

**修改:** `src/content/index.tsx` — ReaderPanel 的顶栏 JSX (行 806-833)

- [ ] **Step 1: 更新 toggle 回调**

```jsx
// 删除旧的 toggleLineFocus/toggleFocusMask/toggleRuler/toggleBeeline
// 替换为:
const toggleParagraphFocus = useCallback(() => toggleSetting('paragraphFocus'), [toggleSetting]);
const toggleColorGradient = useCallback(() => toggleSetting('colorGradient'), [toggleSetting]);
```

- [ ] **Step 2: 更新顶栏按钮**

```jsx
{/* 顶栏 — 替换行 806-833 */}
<div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--color-bg-secondary)', flexShrink: 0, gap: 6 }}>
  <button className="adhd-btn" onClick={onClose}>← 返回</button>
  <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 8px' }}>
    {title}
  </h1>
  <button className={`adhd-btn ${bionicOn ? 'active' : ''}`} onClick={toggleBionic} title="单词加粗，创建视觉锚点">
    Bionic
  </button>
  <button className={`adhd-btn ${colorGradientOn ? 'active' : ''}`} onClick={toggleColorGradient} title="文字颜色渐变引导视线">
    渐变
  </button>
  <button className={`adhd-btn ${paragraphFocusOn ? 'active' : ''}`} onClick={toggleParagraphFocus} title="跟随当前段落高亮，其他淡化">
    段落聚焦
  </button>
  <button className="adhd-btn" disabled={!!aiLoading} onClick={requestSummary} title="AI 摘要">
    {aiLoading === 'summary' ? '...' : '摘要'}
  </button>
  <button className="adhd-btn" disabled={!!aiLoading} onClick={requestKeywords} title="AI 关键词">
    {aiLoading === 'keywords' ? '...' : '关键词'}
  </button>
  <button className="adhd-btn" onClick={() => setShowSettings(true)} title="设置">⚙</button>
</div>
```

---

### Task 10: 清理旧组件代码

**修改:** `src/content/index.tsx`

- [ ] **Step 1: 删除 FocusOverlay 组件（行 439-464）**

删除整个 `FocusOverlay` 函数定义。

- [ ] **Step 2: 删除 ReadingRuler 组件（行 466-493）**

删除整个 `ReadingRuler` 函数定义。

- [ ] **Step 3: 删除 overlayMode 逻辑（行 785-792）**

```jsx
// 删除:
const overlayMode = rulerOn
  ? 'ruler' as const
  : lineFocusOn
    ? 'lineFocus' as const
    : focusMaskOn
      ? 'focusMask' as const
      : null;
```

- [ ] **Step 4: 删除内容区中的覆盖层渲染（行 876-878）**

```jsx
// 删除:
{overlayMode === 'ruler' && <ReadingRuler lineHeightPx={lineHeightPx} />}
{overlayMode === 'lineFocus' && <FocusOverlay mode="lineFocus" />}
{overlayMode === 'focusMask' && <FocusOverlay mode="focusMask" />}
```

- [ ] **Step 5: 删除旧的 beelineBgSize 变量**

```jsx
// 删除 (行 772):
const beelineBgSize = `${lineHeightPx * 4}px`;
```

---

### Task 11: 构建验证

- [ ] **Step 1: 运行构建**

```bash
node build.mjs
```

预期输出：3 个构建步骤完成，无错误。

- [ ] **Step 2: 检查构建产物**

```bash
ls -la dist/content/content.js
```

确认文件存在且大小合理（~300-500KB）。

- [ ] **Step 3: 在 Chrome 中手动测试**

1. 打开 `chrome://extensions/`，开启开发者模式
2. 加载已解压的扩展程序，选择 `dist/` 目录
3. 打开任意文章页面
4. 点击插件图标激活阅读模式
5. 验证以下功能：
   - [ ] 设置面板布局正确、无样式错乱
   - [ ] 拖动字号滑块，内容区文字实时变化
   - [ ] 切换字体选择，确认每种字体生效
   - [ ] 开启色彩渐变，切换色系和强度
   - [ ] 开启段落聚焦，滚动确认段落高亮效果
   - [ ] 暖色/护眼/深色三种主题下确认所有功能正常
   - [ ] 同时开启 Bionic + 渐变 + 段落聚焦，确认无冲突

- [ ] **Step 4: 设置迁移测试**

1. 在 chrome://extensions 中清除插件数据
2. 先安装旧版插件，设置一些旧格式的选项
3. 升级到新版，确认旧设置正确迁移为新格式

- [ ] **Step 5: 提交**

```bash
git add src/content/index.tsx
git commit -m "feat: 优化设置面板、字体、色彩渐变、段落聚焦

- 修复设置面板 CSS 引号 bug 和布局问题
- 修复字体大小不生效的 bug（改用直接数值而非 CSS 变量）
- 新增 5 种字体选择（含 OpenDyslexic 和 Lexend）
- 彩度功能替换为色彩渐变引导（3 种色系 + 强度调节）
- 聚焦/遮罩/标尺合并为段落聚焦（3 级透明度 + rAF 滚动追踪）
- 设置自动迁移（旧格式 → 新格式）
- 设置面板重设计为分区布局"
```

---

## Spec 自检

1. **Spec 覆盖率:**
   - [x] 设置面板样式错乱 → Task 2 (CSS 修复) + Task 8 (UI 重写)
   - [x] 字体大小不生效 → Task 3 (Bug 修复) + Task 4 (字体扩展)
   - [x] 彩度问题 → Task 5 (色彩渐变替代)
   - [x] 聚焦/遮罩/标尺鸡肋 → Task 6 + Task 7 (段落聚焦替代)

2. **Placeholder 扫描:** 无 TBD/TODO，所有步骤含具体代码。

3. **类型一致性:** `gradientScheme` 使用 `'blueRed' | 'greenPurple' | 'warm'` 联合类型，`fontFamily` 使用字符串枚举，与 Task 1 定义一致。
