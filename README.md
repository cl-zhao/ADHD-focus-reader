# ADHD专注阅读器

> 面向ADHD用户的Chrome扩展，通过AI辅助和专注工具降低阅读负担、帮助保持专注

## ✨ 功能特性

### 🎯 核心功能

#### 1. 内容提取
- **智能提取**：自动识别主流中文平台（微信公众号、知乎、头条等）
- **通用支持**：使用Mozilla Readability算法支持任意网页
- **降级策略**：提取失败时显示原文，确保始终可用

#### 2. 分段阅读模式 (FocusMode)
- 将长文分成小段（100-300字/段）
- 单段显示，降低心理负担
- 键盘快捷键（←/→）切换段落
- 实时进度显示

#### 3. 阅读引导线 (ReadingGuide)
- **高亮模式**：当前行高亮，其余行淡化
- **下划线模式**：当前行下方显示引导线
- **动态模式**：视觉引导动画，从左到右扫过

#### 4. 进度追踪
- 实时进度百分比
- 预计剩余阅读时间
- 阅读历史记录（最多100条）
- 重新打开文章时恢复进度

#### 5. AI辅助功能
- **智能摘要**：3-5句话概括文章核心内容
- **关键词提取**：自动提取5-8个关键词高亮显示
- **多模型支持**：Claude 3 Haiku / GPT-4o Mini / Gemini 2.0 Flash
- 通过OpenRouter API调用

### 🎨 用户体验

#### 三种主题
- **温暖主题**（默认）：米白+暖色调，纸张质感
- **护眼主题**：米黄色调，减少视觉疲劳
- **深色主题**：深色背景，适合夜间阅读

#### 个性化设置
- 字体大小：18-24px可调
- 行间距：1.8-2.2可调
- 字间距：0.05-0.15em可调
- 引导线样式选择
- AI功能开关

## 🚀 快速开始

### 安装

1. **下载源码**
   ```bash
   git clone <repository-url>
   cd ADHD-chrome-plugin
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建**
   ```bash
   npm run build
   ```

4. **加载到Chrome**
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目的 `dist` 文件夹

### 配置

1. **设置OpenRouter API密钥**
   - 点击扩展图标
   - 点击"激活阅读模式"
   - 点击右上角"⚙设置"
   - 输入你的OpenRouter API密钥

2. **获取API密钥**
   - 访问 [OpenRouter](https://openrouter.ai/)
   - 注册账号
   - 在API Keys页面创建密钥

## 📖 使用指南

### 基本使用

1. **打开任意中文网页**（如微信公众号文章）
2. **点击扩展图标** 或 **按 Alt+R**
3. **点击"激活阅读模式"**
4. **享受专注阅读**

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + R` | 开关阅读模式 |
| `←` / `→` | 上/下一段（分段模式） |
| `Space` | 下一段 / 向下滚动 |
| `Esc` | 关闭阅读模式 |

### 设置面板

点击右上角"⚙设置"按钮，可以配置：

#### AI设置
- OpenRouter API密钥（本地存储，安全）
- 默认模型选择
- 自动摘要开关
- 关键词提取开关

#### 阅读模式
- 默认模式（连续/分段）
- 引导线样式（高亮/下划线/动态）

#### 外观
- 字体大小
- 行间距
- 主题（温暖/护眼/深色）

## 🏗️ 项目结构

```
adhd-chrome-plugin/
├── src/
│   ├── background/          # Service Worker
│   │   ├── index.ts         # 消息处理
│   │   └── ai.ts            # OpenRouter集成
│   ├── content/             # 内容脚本
│   │   ├── index.ts         # 入口
│   │   ├── extractor/       # 内容提取器
│   │   │   ├── index.ts
│   │   │   ├── readability.ts
│   │   │   └── platforms/   # 平台适配
│   │   │       ├── weixin.ts
│   │   │       └── ...
│   │   └── overlay/         # 覆盖层UI
│   │       ├── index.tsx
│   │       ├── ReaderPanel.tsx
│   │       ├── FocusMode.tsx
│   │       ├── ReadingGuide.tsx
│   │       ├── ProgressBar.tsx
│   │       └── SettingsPanel.tsx
│   ├── popup/               # 弹出菜单
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── App.tsx
│   ├── shared/              # 共享代码
│   │   ├── store/           # Zustand状态
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── types/
│   └── styles/
│       └── tailwind.css
├── public/                  # 静态资源
├── dist/                    # 构建输出
└── docs/                    # 文档
```

## 🛠️ 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 18.2 |
| 语言 | TypeScript | 5.3 |
| 构建工具 | Vite + CRXJS | 5.0 / 2.0 |
| 样式 | Tailwind CSS | 3.4 |
| 状态管理 | Zustand | 4.4 |
| 内容提取 | @mozilla/readability | 0.4 |
| AI集成 | OpenRouter API | - |

## 📊 开发进度

### ✅ Phase 1-3: MVP (已完成)
- [x] 项目初始化
- [x] 内容提取（通用+微信）
- [x] 覆盖层UI
- [x] 连续阅读模式

### ✅ Phase 4: 专注功能 (已完成)
- [x] 分段阅读模式
- [x] 阅读引导线
- [x] 进度追踪
- [x] 阅读历史

### ✅ Phase 5: AI集成 (已完成)
- [x] OpenRouter集成
- [x] 智能摘要
- [x] 关键词提取
- [x] 首次使用确认

### ✅ Phase 6: 完善体验 (已完成)
- [x] 设置面板
- [x] 多主题支持
- [x] UI优化
- [x] 性能优化

## 🧪 测试

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 预览构建
npm run preview
```

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 许可证

MIT License

## 🙏 致谢

- [Mozilla Readability](https://github.com/mozilla/readability) - 内容提取算法
- [OpenRouter](https://openrouter.ai/) - AI模型API
- [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) - 霞鹜文楷字体

---

**为ADHD用户打造，让阅读更专注** 💙
