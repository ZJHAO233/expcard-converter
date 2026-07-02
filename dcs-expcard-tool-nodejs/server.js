const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 加载外部配置文件（如果存在）
let EXPCARD_CONFIG;
const configPath = path.join(process.cwd(), 'config.js');
if (fs.existsSync(configPath)) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    // 移除 module.exports 行，使其成为全局变量
    const cleaned = configContent
      .replace(/if\s*\(typeof\s+module\s*!==\s*['"]undefined['"]\s*&&\s*module\.exports\)\s*\{[\s\S]*?\}/g, '')
      .replace(/module\.exports\s*=\s*EXPCARD_CONFIG\s*;?/g, '');
    eval(cleaned);
    EXPCARD_CONFIG = typeof EXPCARD_CONFIG !== 'undefined' ? EXPCARD_CONFIG : getDefaultConfig();
    console.log('✅ 已加载外部配置文件: config.js');
  } catch (err) {
    console.warn('⚠️  配置文件加载失败，使用默认配置:', err.message);
    EXPCARD_CONFIG = getDefaultConfig();
  }
} else {
  console.log('ℹ️  未找到外部配置文件，使用默认配置');
  EXPCARD_CONFIG = getDefaultConfig();
}

function getDefaultConfig() {
  return {
    LOGIC_OPERATORS: { '与': '且', '且': '且', '或': '或', '或取反': '或取反' },
    SPECIAL_SEPARATORS: { '或延时': '或', '与延时': '且' },
    SKIP_HEADERS: ['序号', '条件确认'],
    SECTION_HEADERS: ['试验条件', '试验恢复', '结论', '存在问题']
  };
}

const app = express();
const PORT = process.env.PORT || 3210;

// pandoc 路径（与项目同目录）
const PANDOC_PATH = path.join(__dirname, 'pandoc.exe');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Markdown 转 Word
app.post('/api/convert-to-word', (req, res) => {
  const { markdown, filename } = req.body;

  if (!markdown) {
    return res.status(400).json({ error: 'Markdown 内容为空' });
  }

  // 创建临时文件
  const tempDir = os.tmpdir();
  const tempMd = path.join(tempDir, `dcs_${Date.now()}.md`);
  const tempDocx = path.join(tempDir, `dcs_${Date.now()}.docx`);

  fs.writeFileSync(tempMd, markdown, 'utf-8');

  // 调用 pandoc 转换
  const cmd = `"${PANDOC_PATH}" "${tempMd}" -o "${tempDocx}" --from markdown --to docx`;

  exec(cmd, (error, stdout, stderr) => {
    // 清理临时 md 文件
    try { fs.unlinkSync(tempMd); } catch (e) {}

    if (error) {
      console.error('Pandoc 转换失败:', stderr);
      return res.status(500).json({ error: '转换失败: ' + stderr });
    }

    // 读取 docx 文件并返回
    const docxBuffer = fs.readFileSync(tempDocx);

    // 清理临时 docx 文件
    try { fs.unlinkSync(tempDocx); } catch (e) {}

    const outputName = (filename || '试验卡').replace(/\.[^.]+$/, '') + '.docx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(outputName)}`);
    res.send(docxBuffer);
  });
});

app.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  console.log(`Pandoc 路径: ${PANDOC_PATH}`);
});
