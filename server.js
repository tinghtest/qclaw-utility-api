const express = require('express');
const QRCode = require('qrcode');
const app = express();
app.use(express.json());

// ── 健康检查 ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'QClaw Utility API', version: '1.0.0' });
});

// ── 1. 二维码生成 ─────────────────────────────────────
// GET /qrcode?text=xxx&size=300&format=png|svg|base64
app.get('/qrcode', async (req, res) => {
  const { text, size = 300, format = 'base64', color = '000000', bg = 'ffffff' } = req.query;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const opts = {
    width: parseInt(size),
    color: { dark: `#${color}`, light: `#${bg}` },
    errorCorrectionLevel: 'M'
  };

  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(text, { ...opts, type: 'svg' });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }
    if (format === 'png') {
      const buf = await QRCode.toBuffer(text, opts);
      res.setHeader('Content-Type', 'image/png');
      return res.send(buf);
    }
    // default: base64 data URL
    const dataUrl = await QRCode.toDataURL(text, opts);
    res.json({ success: true, format: 'base64', data: dataUrl, text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 2. 文本统计分析 ───────────────────────────────────
// POST /text/analyze  body: { text }
app.post('/text/analyze', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const chars = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const lines = text.split(/\n/).length;
  const sentences = text.split(/[。！？.!?]+/).filter(Boolean).length;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/\b[a-zA-Z]+\b/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  const readingMinutes = Math.ceil(chars / 500);

  // 简单关键词提取（高频词）
  const wordFreq = {};
  const tokens = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
  tokens.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  res.json({
    success: true,
    stats: { chars, words, lines, sentences, chineseChars, englishWords, numbers, readingMinutes },
    keywords
  });
});

// ── 3. 文本格式转换 ───────────────────────────────────
// POST /text/transform  body: { text, action }
// action: uppercase | lowercase | trim | reverse | count_lines | remove_blank_lines | deduplicate_lines
app.post('/text/transform', (req, res) => {
  const { text, action } = req.body;
  if (!text || !action) return res.status(400).json({ error: 'text and action are required' });

  let result;
  switch (action) {
    case 'uppercase':       result = text.toUpperCase(); break;
    case 'lowercase':       result = text.toLowerCase(); break;
    case 'trim':            result = text.trim(); break;
    case 'reverse':         result = text.split('').reverse().join(''); break;
    case 'remove_blank_lines':
      result = text.split('\n').filter(l => l.trim()).join('\n'); break;
    case 'deduplicate_lines':
      result = [...new Set(text.split('\n'))].join('\n'); break;
    case 'count_lines':
      return res.json({ success: true, action, count: text.split('\n').length });
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
  res.json({ success: true, action, result });
});

// ── 4. URL 编解码 ─────────────────────────────────────
// GET /url/encode?text=xxx   GET /url/decode?text=xxx
app.get('/url/encode', (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text is required' });
  res.json({ success: true, original: text, encoded: encodeURIComponent(text) });
});
app.get('/url/decode', (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text is required' });
  try {
    res.json({ success: true, original: text, decoded: decodeURIComponent(text) });
  } catch (e) {
    res.status(400).json({ error: 'Invalid encoded string' });
  }
});

// ── 5. Base64 编解码 ──────────────────────────────────
app.get('/base64/encode', (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text is required' });
  res.json({ success: true, original: text, encoded: Buffer.from(text).toString('base64') });
});
app.get('/base64/decode', (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'text is required' });
  try {
    res.json({ success: true, original: text, decoded: Buffer.from(text, 'base64').toString('utf8') });
  } catch (e) {
    res.status(400).json({ error: 'Invalid base64 string' });
  }
});

// ── 6. 随机数据生成 ───────────────────────────────────
// GET /random?type=uuid|password|number&length=16
app.get('/random', (req, res) => {
  const { type = 'uuid', length = 16, min = 0, max = 1000000 } = req.query;
  let result;
  if (type === 'uuid') {
    result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  } else if (type === 'password') {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    result = Array.from({ length: parseInt(length) }, () => chars[Math.random() * chars.length | 0]).join('');
  } else if (type === 'number') {
    result = Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min);
  } else {
    return res.status(400).json({ error: 'type must be uuid|password|number' });
  }
  res.json({ success: true, type, result });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
