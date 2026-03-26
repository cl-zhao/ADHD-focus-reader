import React, { useState, useEffect } from 'react';
import { useReaderStore } from '../../shared/store/readerStore';
import { DEFAULT_SETTINGS } from '../../shared/utils/messaging';
import { SyncSettings, LocalData } from '../../shared/types';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useReaderStore();

  // 本地状态
  const [localSettings, setLocalSettings] = useState<SyncSettings>(settings);
  const [aiConfig, setAiConfig] = useState<LocalData['ai']>({
    openrouterKey: '',
    defaultModel: 'anthropic/claude-3-haiku',
  });

  // 加载AI配置
  useEffect(() => {
    chrome.storage.local.get('ai').then((data) => {
      if (data.ai) {
        setAiConfig(data.ai);
      }
    });
  }, []);

  const handleSave = async () => {
    // 保存阅读和外观设置到sync
    updateSettings(localSettings);
    await chrome.storage.sync.set(localSettings);

    // 保存AI配置到local
    await chrome.storage.local.set({ ai: aiConfig });

    onClose();
  };

  const handleReset = () => {
    // 重置为默认设置
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: '12px',
          padding: '32px',
          width: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '24px', color: 'var(--color-text-primary)' }}>
          ⚙ 设置
        </h2>

        {/* AI设置 */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)' }}>
            🤖 AI助手
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              OpenRouter API Key:
            </label>
            <input
              type="password"
              value={aiConfig.openrouterKey}
              onChange={(e) => setAiConfig({ ...aiConfig, openrouterKey: e.target.value })}
              placeholder="sk-or-..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-bg-secondary)',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              默认模型:
            </label>
            <select
              value={aiConfig.defaultModel}
              onChange={(e) => setAiConfig({ ...aiConfig, defaultModel: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-bg-secondary)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
              <option value="google/gemini-2.0-flash">Gemini 2.0 Flash</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={localSettings.ai.enableSummary}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                ai: { ...localSettings.ai, enableSummary: e.target.checked },
              })}
              style={{ marginRight: '8px' }}
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>自动生成摘要</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={localSettings.ai.enableKeywords}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                ai: { ...localSettings.ai, enableKeywords: e.target.checked },
              })}
              style={{ marginRight: '8px' }}
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>提取关键词高亮</span>
          </label>
        </section>

        {/* 阅读模式 */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)' }}>
            📖 阅读模式
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              默认模式:
            </label>
            <select
              value={localSettings.reading.mode}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                reading: { ...localSettings.reading, mode: e.target.value as SyncSettings['reading']['mode'] },
              })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-bg-secondary)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="continuous">连续阅读</option>
              <option value="segmented">分段阅读</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              引导线样式:
            </label>
            <select
              value={localSettings.reading.guideLineType}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                reading: { ...localSettings.reading, guideLineType: e.target.value as SyncSettings['reading']['guideLineType'] },
              })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-bg-secondary)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="highlight">高亮当前行</option>
              <option value="underline">下划线引导</option>
              <option value="dynamic">动态引导</option>
            </select>
          </div>
        </section>

        {/* 外观 */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)' }}>
            🎨 外观
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              字体大小: {localSettings.appearance.fontSize}px
            </label>
            <input
              type="range"
              min="18"
              max="24"
              value={localSettings.appearance.fontSize}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                appearance: { ...localSettings.appearance, fontSize: Number(e.target.value) },
              })}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              行间距: {localSettings.appearance.lineHeight}
            </label>
            <input
              type="range"
              min="1.8"
              max="2.2"
              step="0.1"
              value={localSettings.appearance.lineHeight}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                appearance: { ...localSettings.appearance, lineHeight: Number(e.target.value) },
              })}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              主题:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['warm', 'sepia', 'dark'].map((theme) => (
                <button
                  key={theme}
                  onClick={() => setLocalSettings({
                    ...localSettings,
                    appearance: { ...localSettings.appearance, theme: theme as SyncSettings['appearance']['theme'] },
                  })}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: localSettings.appearance.theme === theme ? '2px solid var(--color-interactive)' : '1px solid var(--color-bg-secondary)',
                    borderRadius: '6px',
                    backgroundColor: theme === 'warm' ? '#FDF8F3' : theme === 'sepia' ? '#F0EAD6' : '#2D2A26',
                    color: theme === 'dark' ? '#E8E4DF' : '#3D3632',
                    cursor: 'pointer',
                  }}
                >
                  {theme === 'warm' ? '温暖' : theme === 'sepia' ? '护眼' : '深色'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '12px 24px',
              border: '1px solid var(--color-bg-secondary)',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            恢复默认
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              border: '1px solid var(--color-bg-secondary)',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: 'var(--color-interactive)',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
