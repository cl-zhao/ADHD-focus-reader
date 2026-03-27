# ADHD 专注阅读器 - 设置面板 + 功能优化设计文档

## 概述

优化 ADHD 专注阅读插件的 4 个方面：修复设置面板样式、修复字体大小 Bug、替换彩度为色彩渐变引导、用段落聚焦替代聚焦/遮罩/标尺。

## 变更范围

**仅修改文件：** `src/content/index.tsx`（单体内容脚本，所有逻辑内联）
**可能新增：** Google Fonts CSS import（OpenDyslexic + Lexend 字体文件）

---

## 1. 设置面板重新设计

### 问题
- CSS 中存在引号 bug：`color: 'var(--color-text-primary)'` 应为 `color: var(--color-text-primary)`（多处）
- 布局混乱，分区不清晰
- 旧的聚焦/遮罩/标尺三个开关需要合并

### 新布局

```
┌─────────────────────────────────────┐
│  ✕  阅读设置                         │
├─────────────────────────────────────┤
│                                     │
│  ── 阅读辅助 ──                      │
│  Bionic 阅读     [开关]              │
│    单词加粗，创建视觉锚点             │
│  段落聚焦        [开关]              │
│    跟随当前段落高亮，其他淡化         │
│  色彩渐变        [开关]              │
│    文字颜色渐变引导视线               │
│  渐变色系        [蓝红][绿紫][暖色]   │
│  渐变强度  [========○--] 70          │
│                                     │
│  ── 排版 ──                          │
│  字体           [下拉选择]           │
│  字号  20px     [========○--]        │
│  行高  2.0      [========○--]        │
│  字间距 0.05em  [========○--]        │
│                                     │
│  ── 主题 ──                          │
│  [温暖] [护眼] [深色]                │
│                                     │
│  ── AI ──                            │
│  API Key  [sk-or-v1-****]            │
│  模型    [anthropic/claude-3-haiku]  │
│  文章摘要 [开关]                     │
│  关键词提取 [开关]                   │
│                                     │
│          [取消]  [保存设置]           │
└─────────────────────────────────────┘
```

### CSS 修复清单

| 行号 | 当前代码 | 修复 |
|------|---------|------|
| 215 | `color: 'var(--color-text-primary)'` | `color: var(--color-text-primary)` |
| 216 | `color: 'var(--color-text-secondary);` | `color: var(--color-text-secondary)` |
| 256 | `color: 'var(--color-text-primary)'` | `color: var(--color-text-primary)` |
| 257 | `color: 'var(--color-text-secondary)'` | `color: var(--color-text-secondary)` |

---

## 2. 字体大小 Bug 修复 + 字体扩展

### Bug 分析

当前代码（行 696-701）：
```jsx
const fontStyle = {
  '--font-size': `${settings.appearance.fontSize}px`,
  '--line-height': `${settings.appearance.lineHeight}`,
  ...
};
```

内容区（行 868）：
```jsx
fontSize: 'var(--font-size)', lineHeight: 'var(--line-height)',
```

问题：React 内联样式中使用 `var(--font-size)` 引用 CSS 变量。虽然理论上 Shadow DOM 内 CSS 变量应该传递，但实际上 React 的 `style` prop 直接使用 CSS 变量时可能存在解析问题。

**修复方案：** 将 fontSize/lineHeight 直接用数值，不通过 CSS 变量间接引用。
```jsx
// 修改内容区样式
fontSize: settings.appearance.fontSize,
lineHeight: settings.appearance.lineHeight,
letterSpacing: `${settings.appearance.letterSpacing}em`,
```

### 字体选择

新增设置 `appearance.fontFamily`，默认值 `'system'`：

```typescript
const FONT_OPTIONS = [
  { value: 'system', label: '系统默认', css: 'system-ui, -apple-system, sans-serif' },
  { value: 'serif', label: '思源宋体', css: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif' },
  { value: 'georgia', label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { value: 'dyslexic', label: 'OpenDyslexic', css: '"OpenDyslexic", sans-serif' },
  { value: 'lexend', label: 'Lexend', css: '"Lexend", sans-serif' },
];
```

OpenDyslexic 和 Lexend 通过 Google Fonts / CDN 引入：
```html
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;700&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.css" rel="stylesheet">
```

在 `createOverlay` 中动态添加到 Shadow DOM 的 style 中。

---

## 3. 彩度 → 色彩渐变引导

### 数据结构变更

```typescript
// 旧
reading: { ..., beeline: boolean }
// 新
reading: {
  bionicReading: boolean,
  paragraphFocus: boolean,     // 替代 lineFocus/focusMask/ruler
  colorGradient: boolean,      // 替代 beeline
  gradientScheme: 'blueRed' | 'greenPurple' | 'warm',  // 新增
  gradientIntensity: number,   // 新增, 20-100
}
```

### 渐变色系定义

```typescript
const GRADIENT_SCHEMES = {
  blueRed: {
    light: ['#1a5276', '#8e44ad', '#c0392b'],  // 蓝 → 紫 → 红
    dark:  ['#6BB5E8', '#BB8FCE', '#E74C3C'],   // 暗色变体
  },
  greenPurple: {
    light: ['#117a65', '#6c3483', '#935116'],   // 绿 → 紫 → 橙
    dark:  ['#48C9B0', '#AF7AC5', '#E67E22'],
  },
  warm: {
    light: ['#935116', '#c0392b', '#8e44ad'],   // 橙 → 红 → 紫
    dark:  ['#E67E22', '#E74C3C', '#BB8FCE'],
  },
};
```

### 实现

复用现有的 `.beeline` CSS 类（`background-clip: text`），改为 `.color-gradient` 类名。

**强度控制：** 通过 `filter: saturate()` 在渐变容器上控制：
```jsx
// 强度 20 → saturate(0.2), 强度 100 → saturate(1.0)
filter: `saturate(${settings.reading.gradientIntensity / 100})`
```

---

## 4. 聚焦/遮罩/标尺 → 段落聚焦

### 数据结构

```typescript
reading: {
  paragraphFocus: boolean,  // 新增，替代 lineFocus + focusMask + ruler
}
```

### 实现逻辑

**段落标记：**
在 `processedHtml` 的 useMemo 中，对提取后的 HTML 进行预处理：为每个 `<p>`、`<li>`、`<blockquote>` 添加 `data-para` 属性和唯一 ID。

```typescript
function addParagraphMarkers(html: string): string {
  let counter = 0;
  return html.replace(/<(p|li|blockquote)([\s>])/gi, (match, tag, after) => {
    return `<${tag} data-para="${counter++}"${after}`;
  });
}
```

**滚动追踪：**
在 `useEffect` 中注册 scroll 监听器（节流到 rAF），计算每个段落元素的 `getBoundingClientRect()` 相对于视口中心的距离：

```typescript
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
      if (distance < height * 0.15) opacity = 1.0;        // 当前段落
      else if (distance < height * 0.35) opacity = 0.5;   // 前后段落
      else opacity = 0.25;                                 // 远处段落

      (el as HTMLElement).style.opacity = String(opacity);
      (el as HTMLElement).style.transition = 'opacity 0.3s ease';
    });
  };

  const onScroll = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateFocus);
  };

  container.addEventListener('scroll', onScroll, { passive: true });
  updateFocus(); // 初始调用

  return () => {
    container.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(rafId);
  };
}, [settings.reading.paragraphFocus, processedHtml]);
```

### 顶栏按钮变更

旧按钮：`Bionic` | `彩读` | `聚焦` | `遮罩` | `标尺` | `摘要` | `关键词` | `⚙`
新按钮：`Bionic` | `渐变` | `段落聚焦` | `摘要` | `关键词` | `⚙`

---

## 5. 设置迁移

从旧格式到新格式的自动迁移：

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
  // 默认值
  if (reading.gradientScheme === undefined) reading.gradientScheme = 'blueRed';
  if (reading.gradientIntensity === undefined) reading.gradientIntensity = 70;
  if (reading.paragraphFocus === undefined) reading.paragraphFocus = false;

  const appearance = { ...s.appearance };
  if (appearance.fontFamily === undefined) appearance.fontFamily = 'system';

  return { ...s, reading, appearance };
}
```

---

## 6. 移除的组件

以下不再使用，从代码中删除：
- `FocusOverlay` 组件（行 444-464）
- `ReadingRuler` 组件（行 470-493）
- `overlayMode` 逻辑（行 786-792）
- 顶栏的 `聚焦`、`遮罩`、`标尺` 按钮
- `toggleLineFocus`、`toggleFocusMask`、`toggleRuler` 回调

---

## 测试计划

1. **设置面板** — 打开设置面板，确认布局正确、无样式错乱
2. **字体大小** — 拖动字号滑块，确认内容区文字实时变化
3. **字体选择** — 切换 5 种字体，确认每种字体生效
4. **色彩渐变** — 开启渐变，切换色系和强度，确认效果
5. **段落聚焦** — 开启后滚动页面，确认当前段落高亮、其他淡化
6. **设置迁移** — 从旧版升级后，确认旧设置正确迁移
7. **组合使用** — 同时开启 Bionic + 渐变 + 段落聚焦，确认无冲突
8. **主题兼容** — 暖色/护眼/深色三种主题下，确认所有功能正常
