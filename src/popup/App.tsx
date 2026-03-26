import React, { useState } from 'react'

function App() {
  const [status, setStatus] = useState('');

  const handleActivate = () => {
    setStatus('正在注入...');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setStatus('错误: 未找到活动标签页');
        return;
      }

      // 检查是否可以在该页面注入
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
        setStatus('错误: 不能在此页面使用，请打开普通网页');
        return;
      }

      // 使用 chrome.scripting.executeScript 按需注入
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js'],
      }, () => {
        if (chrome.runtime.lastError) {
          setStatus('注入失败: ' + chrome.runtime.lastError.message);
          console.error('Injection failed:', chrome.runtime.lastError);
          return;
        }

        // 注入成功，发送消息
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_READER' }, (response) => {
            if (chrome.runtime.lastError) {
              setStatus('消息发送失败: ' + chrome.runtime.lastError.message);
            } else {
              setStatus('已激活！');
              setTimeout(() => window.close(), 500);
            }
          });
        }, 500); // 等待content script注册消息监听
      });
    });
  };

  return (
    <div style={{
      width: '320px',
      padding: '24px',
      backgroundColor: '#FDF8F3',
      fontFamily: '"LXGW WenKai", "Noto Serif SC", system-ui, serif',
    }}>
      <h1 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#3D3632',
        marginBottom: '16px',
      }}>
        ADHD专注阅读器
      </h1>

      <p style={{
        fontSize: '14px',
        color: '#6B635B',
        marginBottom: '24px',
      }}>
        为ADHD用户设计的专注阅读工具
      </p>

      <button
        onClick={handleActivate}
        style={{
          width: '100%',
          height: '40px',
          backgroundColor: '#C49A6C',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer',
        }}
      >
        激活阅读模式
      </button>

      {status && (
        <p style={{
          marginTop: '12px',
          fontSize: '13px',
          color: '#C49A6C',
          textAlign: 'center',
          wordBreak: 'break-all',
        }}>
          {status}
        </p>
      )}

      <div style={{
        marginTop: '24px',
        fontSize: '12px',
        color: '#6B635B',
      }}>
        <p>快捷键: Alt+R</p>
        <p style={{ marginTop: '8px', color: '#999' }}>
          注意：请在普通网页上使用，不支持chrome://页面
        </p>
      </div>
    </div>
  )
}

export default App
