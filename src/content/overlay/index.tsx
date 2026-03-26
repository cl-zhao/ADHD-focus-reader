import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReaderPanel } from './ReaderPanel';

let shadowRoot: ShadowRoot | null = null;
let rootContainer: HTMLElement | null = null;
let reactRoot: ReturnType<typeof createRoot> | null = null;

export function createOverlay(data: any) {
  if (shadowRoot) {
    // 已存在则更新
    if (reactRoot) {
      reactRoot.render(<ReaderPanel data={data} onClose={removeOverlay} />);
    }
    return;
  }

  // 创建容器
  rootContainer = document.createElement('div');
  rootContainer.id = 'adhd-reader-root';
  document.body.appendChild(rootContainer);

  // 创建Shadow DOM
  shadowRoot = rootContainer.attachShadow({ mode: 'closed' });

  // 注入完整样式
  const styleElement = document.createElement('style');
  styleElement.textContent = getOverlayStyles();
  shadowRoot.appendChild(styleElement);

  // 创建React挂载点
  const appContainer = document.createElement('div');
  shadowRoot.appendChild(appContainer);

  // 渲染React应用
  reactRoot = createRoot(appContainer);
  reactRoot.render(<ReaderPanel data={data} onClose={removeOverlay} />);

  console.log('ADHD Reader: Overlay created');
}

export function removeOverlay() {
  console.log('ADHD Reader: Removing overlay');

  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  if (rootContainer) {
    rootContainer.remove();
    rootContainer = null;
  }

  shadowRoot = null;
}

function getOverlayStyles(): string {
  return `
    :host {
      all: initial;
      --color-bg-primary: #FDF8F3;
      --color-bg-secondary: #F5F0EB;
      --color-text-primary: #3D3632;
      --color-text-secondary: #6B635B;
      --color-accent: #E8A87C;
      --color-interactive: #C49A6C;
      --font-family: "LXGW WenKai", "Noto Serif SC", system-ui, serif;
      --font-size: 20px;
      --line-height: 2.0;
      --letter-spacing: 0.05em;
      --panel-max-width: 800px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
    }

    @keyframes sweep {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(333%); }
    }

    .reading-guide-dynamic {
      animation: sweep 2s infinite;
    }

    * {
      scroll-behavior: smooth;
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    }

    button {
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.8; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `;
}
