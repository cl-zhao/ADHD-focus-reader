const s = "https://openrouter.ai/api/v1/chat/completions", c = {
  summarize: (e) => `请用3-5句话总结以下中文文章的核心内容，要求简洁明了：

${e.substring(0, 3e3)}

摘要：`,
  extractKeywords: (e) => `请从以下中文文章中提取5-8个关键词，用于高亮显示：

${e.substring(0, 2e3)}

关键词（用逗号分隔）：`
};
async function i(e, r, o = "anthropic/claude-3-haiku") {
  const t = await fetch(s, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${r}`,
      "Content-Type": "application/json",
      "HTTP-Referer": chrome.runtime.getURL("")
    },
    body: JSON.stringify({
      model: o,
      messages: [{ role: "user", content: e }],
      max_tokens: 500,
      temperature: 0.3
    })
  });
  if (!t.ok) {
    const a = await t.text().catch(() => "Unknown error");
    throw new Error(`OpenRouter API error: ${t.status} - ${a}`);
  }
  const n = await t.json();
  if (!n.choices || n.choices.length === 0)
    throw new Error("OpenRouter API returned no choices");
  return n.choices[0].message.content;
}
async function u(e, r, o) {
  const t = c.summarize(e);
  return i(t, r, o);
}
async function l(e, r, o) {
  const t = c.extractKeywords(e);
  return (await i(t, r, o)).split(/[,，、]/).map((a) => a.trim()).filter((a) => a.length > 0);
}
console.log("ADHD Reader: Background service worker started");
chrome.runtime.onInstalled.addListener(() => {
  console.log("ADHD Reader: Extension installed");
});
chrome.runtime.onMessage.addListener((e, r, o) => (console.log("Background received message:", e), e.type === "AI_SUMMARIZE" ? (d(e.payload).then(o).catch((t) => o({ type: "AI_ERROR", payload: { error: t.message } })), !0) : (e.type === "AI_EXTRACT_KEYWORDS" && p(e.payload).then(o).catch((t) => o({ type: "AI_ERROR", payload: { error: t.message } })), !0)));
async function d(e) {
  var a;
  const r = await chrome.storage.local.get("ai");
  if (!((a = r.ai) != null && a.openrouterKey))
    throw new Error("未配置OpenRouter API密钥");
  const o = r.ai.openrouterKey, t = r.ai.defaultModel || "anthropic/claude-3-haiku";
  return { type: "AI_SUMMARY_RESULT", payload: { summary: await u(e.content, o, t) } };
}
async function p(e) {
  var a;
  const r = await chrome.storage.local.get("ai");
  if (!((a = r.ai) != null && a.openrouterKey))
    throw new Error("未配置OpenRouter API密钥");
  const o = r.ai.openrouterKey, t = r.ai.defaultModel || "anthropic/claude-3-haiku";
  return { type: "AI_KEYWORDS_RESULT", payload: { keywords: await l(e.content, o, t) } };
}
