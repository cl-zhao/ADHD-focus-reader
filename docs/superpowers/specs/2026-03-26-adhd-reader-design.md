# ADHD专注阅读器 - 设计文档

## 概述

面向ADHD用户的Chrome扩展，通过AI辅助和专注工具降低阅读负担、帮助保持专注。

## 目标用户

- ADHD用户（注意力缺陷多动障碍）
- 中文阅读用户
- 需要长时间阅读复杂文本的用户

## 核心价值

1. **降低阅读负担**：AI摘要、关键词提取、简化排版
2. **帮助保持专注**：分段阅读、阅读引导线、进度追踪

---

## 技术架构

### 整体架构

```
Chrome Extension (Manifest V3)
├── manifest.json
├── background/
│   └── index.ts          # Service Worker
├── content/
│   ├── index.ts          # 内容脚本入口
│   ├── extractor/        # 内容提取器
│   └── overlay/          # 覆盖层UI组件
│       ├── ReaderPanel.tsx    # 主阅读面板
│       ├── FocusMode.tsx      # 分段阅读组件
│       └── SettingsPanel.tsx  # 设置面板
└── popup/
    └── App.tsx           # 扩展弹出菜单
```

### 技术栈

| 类别 | 选择 | 理由 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 组件化开发，类型安全 |
| 样式方案 | Tailwind CSS + Shadow DOM | 快速构建，CSS隔离 |
| 构建工具 | Vite + CRXJS | 热更新开发体验 |
| 状态管理 | Zustand | 轻量级，适合扩展场景 |
| AI集成 | OpenRouter API | 多模型支持，灵活选择 |
| 内容提取 | @mozilla/readability | Mozilla开源算法 |

### CSS隔离策略

使用 Shadow DOM 将覆盖层与原页面隔离：

```typescript
// 在content script中创建Shadow DOM
const container = document.createElement('div');
container.id = 'adhd-reader-root';
const shadowRoot = container.attachShadow({ mode: 'closed' });

// 将Tailwind编译后的CSS注入Shadow DOM
const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(compiledTailwindCSS);
shadowRoot.adoptedStyleSheets = [styleSheet];

// 渲染React应用到Shadow DOM
const root = createRoot(shadowRoot);
root.render(<ReaderApp />);
```

### 权限声明

```json
{
  "permissions": [
    "storage",        // 存储设置和阅读历史
    "activeTab",      // 仅在用户激活时访问当前标签页
    "contextMenus"    // 右键菜单
  ],
  "host_permissions": [
    "https://openrouter.ai/*"  // 仅OpenRouter API
  ]
}
```

**权限最小化原则**：
- 使用 `activeTab` 而非 `<all_urls>`，仅在用户点击图标时注入脚本
- API调用仅在background中进行，content script不直接访问外部API

### 消息通信协议

```typescript
// 定义类型安全的消息类型
type MessageType =
  | { type: 'EXTRACT_CONTENT'; payload: { url: string } }
  | { type: 'CONTENT_EXTRACTED'; payload: { content: string; title: string } }
  | { type: 'AI_SUMMARIZE'; payload: { content: string } }
  | { type: 'AI_SUMMARY_RESULT'; payload: { summary: string } }
  | { type: 'AI_ERROR'; payload: { error: string } }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: Partial<Settings> };

// 消息发送包装函数
async function sendMessage<T>(message: MessageType): Promise<T> {
  return chrome.runtime.sendMessage(message);
}
```

---

## 功能模块

### 1. 内容提取器 (ContentExtractor)

**职责**：从各种网页中提取正文内容

**支持平台**：

| 平台 | 提取策略 | 选择器 | 特殊处理 |
|------|----------|--------|----------|
| 微信公众号 | 容器提取 | `#js_content` | - |
| 知乎文章 | 容器提取 | `.Post-RichText` | - |
| 知乎问答 | 问答区提取 | `.RichContent-inner` | - |
| 今日头条 | 语义提取 | `article` | - |
| 小红书 | 笔记提取 | `[data-v-note-content]` | MutationObserver监听动态加载 |
| 通用网页 | Readability | `@mozilla/readability` | 配合DOMParser |

**提取流程**：
```
原网页 → 平台识别 → SPA检测 → 定制化提取/Readability → 清洗HTML → 结构化内容
```

**SPA处理**：
```typescript
// 对于SPA应用，等待内容加载完成
function waitForContent(selector: string, timeout = 5000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) return resolve(element);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Content load timeout'));
    }, timeout);
  });
}
```

### 2. 分段阅读模式 (FocusMode)

**职责**：将长文分成小段，降低心理负担

**分段算法**：
- 优先按自然段落分割
- 超长段落按句号分割
- 每段控制在 100-300 字（可调）

**交互设计**：
- 左右箭头键切换段落
- 点击导航按钮切换
- 自动播放模式（可调速度）

**UI布局**：
```
┌─────────────────────────────────┐
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ 进度条
│                                  │
│  「当前段落内容显示在这里」        │ 单段显示
│                                  │
│         [←上一段] [下一段→]       │ 导航
│           3 / 15 段              │ 进度
└─────────────────────────────────┘
```

### 3. 阅读引导线 (ReadingGuide)

**职责**：引导视线，减少跳行和分心

**三种模式**：

| 模式 | 效果 | 适用场景 |
|------|------|----------|
| 高亮模式 | 当前行高亮，其余行轻微淡化 | 初次使用 |
| 下划线模式 | 当前行下方显示柔和的引导线 | 轻度引导 |
| 动态模式 | 视觉引导动画，从左到右扫过高亮 | 需要强引导时 |

**注意**：动态模式是"视觉引导动画"，非真正的眼动追踪（不需要摄像头）。

**实现**：
- 监听滚动位置计算当前行
- CSS transition 实现平滑动画
- 支持 requestAnimationFrame 优化性能
- 尊重 `prefers-reduced-motion` 用户偏好

### 4. AI辅助功能 (AIAssistant)

**职责**：通过OpenRouter调用大模型提供智能辅助

**功能列表**：

| 功能 | 触发时机 | 输出格式 | 预估Token |
|------|----------|----------|-----------|
| 智能摘要 | 文章加载完成 | 3-5句话概括 | ~200 |
| 关键词提取 | 自动运行 | 高亮词列表 | ~100 |
| 段落总结 | 分段模式开启 | 每段末尾一句话 | ~50/段 |

**Prompt模板**：
```typescript
const PROMPTS = {
  summarize: `请用3-5句话总结以下中文文章的核心内容，要求简洁明了：

{content}

摘要：`,

  extractKeywords: `请从以下中文文章中提取5-8个关键词，用于高亮显示：

{content}

关键词（用逗号分隔）：`,

  segmentSummary: `请用一句话总结这段内容（不超过30字）：

{segment}

总结：`
};
```

**支持的模型**：
```typescript
const SUPPORTED_MODELS = [
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', costPer1k: 0.00025 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', costPer1k: 0.00015 },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', costPer1k: 0.0001 },
];
```

**API调用设计**：
```typescript
// background/index.ts
async function callOpenRouter(prompt: string, model: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': chrome.runtime.getURL(''),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 5. 进度追踪 (ProgressTracker)

**职责**：显示阅读进度，给予成就感

**追踪维度**：
- 当前段落 / 总段落数
- 预计剩余阅读时间（基于平均阅读速度 300字/分钟）
- 整体进度百分比

**存储**：
- 阅读进度保存到 chrome.storage.local
- 重新打开文章时恢复进度

---

## UI设计规范

### 色彩系统

温暖舒适风格，使用CSS变量定义：

```css
:root {
  /* 温暖主题（默认） */
  --color-bg-primary: #FDF8F3;    /* 米白，纸张质感 */
  --color-bg-secondary: #F5F0EB;  /* 暖灰，卡片/面板 */
  --color-text-primary: #3D3632;  /* 深褐，主文字 */
  --color-text-secondary: #6B635B;/* 暖灰，次要文字 */
  --color-accent: #E8A87C;        /* 暖橙，高亮/引导线 */
  --color-interactive: #C49A6C;   /* 暖棕，按钮/交互 */
}

[data-theme="sepia"] {
  --color-bg-primary: #F0EAD6;    /* 米黄 */
  --color-text-primary: #4A4A4A;
}

[data-theme="dark"] {
  --color-bg-primary: #2D2A26;
  --color-bg-secondary: #3A3632;
  --color-text-primary: #E8E4DF;
  --color-accent: #D4A574;
}
```

### 字体规范

```css
:root {
  --font-family: "LXGW WenKai", "Noto Serif SC", system-ui, serif;
  --font-size: 20px;           /* 范围 18-24px */
  --line-height: 2.0;          /* 范围 1.8-2.2 */
  --letter-spacing: 0.05em;    /* 范围 0.05-0.15em */
  --paragraph-spacing: 1.5em;
}
```

### 组件尺寸

```css
:root {
  --panel-max-width: 800px;
  --panel-padding: 40px;
  --button-height: 40px;
  --button-radius: 8px;
  --button-padding: 12px 20px;
}
```

### 阅读面板布局

```
┌────────────────────────────────────────────────┐
│ [←返回]  文章标题              [⚙设置] [✕关闭] │ 顶栏 56px
├────────────────────────────────────────────────┤
│                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ 进度条 4px
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ 📝 摘要：AI生成的3句话总结                 │ │ 摘要卡片（可折叠）
│  └──────────────────────────────────────────┘ │
│                                                │
│  ─────────────────────────────────────────────│ 分隔线
│                                                │
│      「正文内容区域」                           │
│      当前段落会高亮显示                         │
│      阅读引导线跟随当前行                       │
│                                                │
│                                                │
├────────────────────────────────────────────────┤
│  [📖连续] [📄分段] [👁引导]    ← 3/15 →        │ 底栏 60px
└────────────────────────────────────────────────┘
```

---

## 数据存储

### Chrome Storage 结构

#### Local Storage（本地存储，包含敏感数据）

```typescript
interface LocalData {
  // AI配置（敏感，仅存本地）
  ai: {
    openrouterKey: string;      // API密钥，仅存储在本地
    defaultModel: string;        // 默认模型
  };

  // 阅读历史
  readingHistory: Array<{
    url: string;
    title: string;
    progress: number;      // 0-100
    lastRead: number;      // timestamp
  }>;

  // 内容缓存
  cache: Record<string, {
    content: string;
    summary: string;
    keywords: string[];
    extractedAt: number;   // 用于TTL
  }>;
}

// 缓存策略
const CACHE_TTL = 24 * 60 * 60 * 1000;  // 24小时
const MAX_CACHE_SIZE = 100;              // 最多100条

// 缓存清理
function cleanExpiredCache() {
  const now = Date.now();
  const cache = await chrome.storage.local.get('cache');
  const valid = Object.entries(cache)
    .filter(([_, v]) => now - v.extractedAt < CACHE_TTL)
    .slice(0, MAX_CACHE_SIZE);
  await chrome.storage.local.set({ cache: Object.fromEntries(valid) });
}
```

#### Sync Storage（跨设备同步，仅非敏感数据）

```typescript
interface SyncSettings {
  reading: {
    mode: 'continuous' | 'segmented';
    segmentSize: number;         // 每段字数 100-300
    autoPlaySpeed: number;       // 秒/段
    guideLineType: 'highlight' | 'underline' | 'dynamic';
  };

  appearance: {
    fontSize: number;           // 18-24
    lineHeight: number;         // 1.8-2.2
    letterSpacing: number;      // 0.05-0.15
    theme: 'warm' | 'sepia' | 'dark';
  };

  ai: {
    enableSummary: boolean;      // 自动摘要开关
    enableKeywords: boolean;     // 关键词提取开关
    // 注意：API密钥不存储在sync中
  };
}
```

---

## 错误处理

### 错误类型与处理策略

| 错误类型 | 处理策略 | 用户提示 |
|----------|----------|----------|
| 内容提取失败 | 尝试备用提取器，最终降级显示原文 | "无法提取正文，显示原始内容" |
| AI API调用失败 | 降级为无AI辅助模式，显示原始内容 | "AI服务暂时不可用" |
| 网络错误 | 显示离线提示，禁用AI功能 | "网络连接失败，AI功能暂不可用" |
| API密钥无效 | 提示用户检查设置 | "API密钥无效，请检查设置" |
| Service Worker休眠 | 使用chrome.alarms保活 | 无感知 |

### 错误处理代码示例

```typescript
async function extractContent(): Promise<ExtractResult> {
  try {
    // 尝试平台特定提取
    const platform = detectPlatform();
    if (platform) {
      const content = await platformExtractors[platform]();
      if (content) return { success: true, content };
    }

    // 降级到Readability
    const content = await extractWithReadability();
    if (content) return { success: true, content };

    // 最终降级：显示原文
    return { success: false, fallback: document.body.innerText };
  } catch (error) {
    console.error('Content extraction failed:', error);
    return { success: false, fallback: document.body.innerText };
  }
}

async function summarizeContent(content: string): Promise<string | null> {
  try {
    return await callOpenRouter(PROMPTS.summarize(content), settings.ai.model);
  } catch (error) {
    if (error instanceof ApiKeyError) {
      showToast('API密钥无效，请检查设置');
    } else if (error instanceof NetworkError) {
      showToast('网络连接失败，AI功能暂不可用');
    } else {
      showToast('AI服务暂时不可用');
    }
    return null;
  }
}
```

---

## 隐私与安全

### 隐私政策要点

1. **数据传输说明**：使用AI功能时，文章内容会发送到OpenRouter API处理
2. **本地存储**：阅读历史和设置仅存储在用户本地浏览器
3. **API密钥**：用户自行提供OpenRouter API密钥，扩展不收集任何密钥
4. **数据控制**：用户可随时清除阅读历史和缓存

### 首次使用AI确认

```typescript
async function firstTimeAIConsent(): Promise<boolean> {
  const hasConsented = await chrome.storage.local.get('aiConsent');
  if (hasConsented) return true;

  const result = await showConfirmDialog({
    title: 'AI功能使用说明',
    message: '使用AI摘要和关键词提取功能时，文章内容会发送到OpenRouter API进行处理。\n\n您可以在设置中随时关闭AI功能。',
    confirmText: '了解并启用',
    cancelText: '暂不启用',
  });

  if (result) {
    await chrome.storage.local.set({ aiConsent: true });
  }
  return result;
}
```

### 数据清除功能

设置面板提供：
- 清除阅读历史
- 清除内容缓存
- 清除所有数据（重置）

---

## 交互流程

### 入口触发

| 方式 | 操作 |
|------|------|
| 扩展图标 | 点击工具栏图标 |
| 快捷键 | `Alt + R`（可在chrome://extensions/shortcuts自定义） |
| 右键菜单 | 选择「专注阅读」 |

### 主要用户流程

```
1. 用户浏览网页
2. 触发阅读模式（图标/快捷键/右键）
3. 扩展注入content script（仅此时，因activeTab权限）
4. 内容提取器识别平台并提取正文
5. 显示阅读面板
6. [可选] 首次使用AI时显示确认对话框
7. [可选] 调用AI生成摘要
8. 用户阅读内容
9. 进度自动保存
10. 用户关闭阅读模式
```

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + R` | 开关阅读模式（可自定义） |
| `←` / `→` | 上/下一段（分段模式） |
| `Space` | 下一段 / 向下滚动 |
| `Esc` | 关闭阅读模式 |
| `S` | 打开设置 |

### 无障碍支持

- 所有交互元素支持键盘导航
- 使用语义化HTML标签（`<main>`, `<article>`, `<nav>`）
- 添加ARIA标签
- 颜色对比度符合WCAG 2.1 AA标准
- 尊重 `prefers-reduced-motion` 用户偏好

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## 文件结构

```
adhd-chrome-plugin/
├── public/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── manifest.json
│   ├── background/
│   │   └── index.ts              # Service Worker
│   ├── content/
│   │   ├── index.ts              # 内容脚本入口
│   │   ├── extractor/            # 内容提取器
│   │   │   ├── index.ts
│   │   │   ├── platforms/        # 平台适配
│   │   │   │   ├── weixin.ts
│   │   │   │   ├── zhihu.ts
│   │   │   │   └── index.ts
│   │   │   └── readability.ts    # 通用提取
│   │   └── overlay/              # 覆盖层组件
│   │       ├── index.tsx
│   │       ├── ReaderPanel.tsx
│   │       ├── FocusMode.tsx
│   │       ├── ReadingGuide.tsx
│   │       ├── ProgressBar.tsx
│   │       └── SettingsPanel.tsx
│   ├── popup/
│   │   ├── index.tsx
│   │   └── App.tsx
│   ├── shared/
│   │   ├── store/                # Zustand状态
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── types/
│   │   └── messages.ts           # 消息类型定义
│   └── styles/
│       └── tailwind.css
├── _locales/                     # i18n预留
│   └── zh_CN/
│       └── messages.json
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 非功能需求

### 性能

- 内容提取：< 500ms
- 覆盖层渲染：< 100ms
- AI摘要生成：< 3s（取决于API响应）
- 内存占用：< 50MB

### 兼容性

- Chrome 88+（Manifest V3）
- Chromium内核浏览器（Edge、Brave等）

### 可访问性

- 支持键盘导航
- 语义化HTML标签
- ARIA标签支持
- 足够的颜色对比度（WCAG 2.1 AA）
- 减少动画选项

---

## 里程碑

### Phase 1: 基础框架 (MVP)
- 项目搭建
- 内容提取（通用 + 微信公众号）
- 覆盖层基础UI
- 连续阅读模式

### Phase 2: 专注功能
- 分段阅读模式
- 阅读引导线
- 进度追踪
- 阅读历史

### Phase 3: AI集成
- OpenRouter集成
- 首次使用确认
- 智能摘要
- 关键词提取

### Phase 4: 完善体验
- 更多平台适配
- 设置面板
- 多主题支持
- 数据清除功能
- 性能优化
