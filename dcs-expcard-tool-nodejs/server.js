const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 检测是否在 SEA 环境中运行
const isSEA =
  !process.argv[1] ||
  process.argv[1].endsWith(".exe") ||
  process.argv[1].includes("sea");

// 加载外部配置文件（如果存在）
let EXPCARD_CONFIG;
const configPath = path.join(process.cwd(), "config.js");

if (fs.existsSync(configPath)) {
  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const cleaned = configContent
      .replace(
        /if\s*\(typeof\s+module\s*!==\s*['"]undefined['"]\s*&&\s*module\.exports\)\s*\{[\s\S]*?\}/g,
        "",
      )
      .replace(/module\.exports\s*=\s*EXPCARD_CONFIG\s*;?/g, "");
    eval(cleaned);
    EXPCARD_CONFIG =
      typeof EXPCARD_CONFIG !== "undefined"
        ? EXPCARD_CONFIG
        : getDefaultConfig();
    console.log("Loaded config.js");
  } catch (err) {
    console.warn("Config load failed, using default:", err.message);
    EXPCARD_CONFIG = getDefaultConfig();
  }
} else {
  console.log("No config.js found, using default");
  EXPCARD_CONFIG = getDefaultConfig();
}

function getDefaultConfig() {
  return {
    LOGIC_OPERATORS: { 与: "且", 且: "且", 或: "或", 或取反: "或取反" },
    SPECIAL_SEPARATORS: { 或延时: "或", 与延时: "且" },
    ROW_PATTERNS: {
      header: { type: "exact", values: ["序号", "条件确认"] },
      chineseTitle: { type: "regex", pattern: "^[一二三四五六七八九十]+、" },
      subTitle: { type: "regex", pattern: "^\\d+\\.[\\u4e00-\\u9fa5]" },
      pureNumber: { type: "regex", pattern: "^\\d+$" },
      subItem: { type: "regex", pattern: "^\\d+\\.\\d+$" },
      paragraphTitle: { type: "exact", values: ["试验条件", "试验恢复", "结论", "存在问题"] },
      contentStart: { type: "exact", values: ["试验内容"] },
      skipSectionStart: { type: "exact", values: ["试验条件"] },
    },
    OUTPUT_FORMAT: {
      useLegacy: false,
      numbering: { enabled: true, separator: ".", startNum: 1, numType: "arabic" },
      levels: {
        title: { type: "ordered", prefix: "", bullet: "-", indent: 0, template: "{prefix}{text}", numType: "chinese" },
        subTitle: { type: "ordered", prefix: "## ", bullet: "-", indent: 0, template: "{prefix}{num}、{text}", numType: "chinese" },
        content1: { type: "ordered", prefix: "### ", bullet: "-", indent: 0, template: "{prefix}{num}. {text}", numType: "arabic" },
        content2: { type: "ordered", prefix: "", bullet: "-", indent: 1, template: "{indent}{num}. {text}", numType: "arabic" },
        content3: { type: "unordered", prefix: "", bullet: "-", indent: 2, template: "{indent}{bullet} {text}" },
        content4: { type: "unordered", prefix: "", bullet: "-", indent: 3, template: "{indent}{bullet} {text}" },
      },
      indent: { size: 3, char: " " }
    },
  };
}

const app = express();
const PORT = process.env.PORT || 3210;

// pandoc 路径
const PANDOC_PATH = isSEA
  ? path.join(process.cwd(), "pandoc.exe")
  : path.join(__dirname, "pandoc.exe");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 读取内嵌的静态文件
function readEmbeddedFile(filename) {
  try {
    return fs.readFileSync(path.join(__dirname, filename), "utf-8");
  } catch (e) {
    return null;
  }
}

// 首页
app.get("/", (req, res) => {
  const indexHtml = readEmbeddedFile("index.html");
  if (indexHtml) {
    res.type("html").send(indexHtml);
  } else {
    res.status(404).send("index.html not found");
  }
});

// 静态文件
app.get("/convert.js", (req, res) => {
  const content = readEmbeddedFile("convert.js");
  if (content) {
    res.type("js").send(content);
  } else {
    res.status(404).send("convert.js not found");
  }
});

app.get("/config.js", (req, res) => {
  // 优先返回外部配置文件
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      res.type("js").send(content);
    } catch (e) {
      res.status(500).send("Error reading config.js");
    }
  } else {
    // 返回默认配置
    const defaultConfig = `const EXPCARD_CONFIG = ${JSON.stringify(EXPCARD_CONFIG, null, 2)};`;
    res.type("js").send(defaultConfig);
  }
});

// ========================================================================
// 配置 API
// ========================================================================

// 读取当前配置
app.get("/api/config", (req, res) => {
  res.json(EXPCARD_CONFIG);
});

// 保存配置到 config.js
app.post("/api/config", (req, res) => {
  const newConfig = req.body;

  if (!newConfig || typeof newConfig !== "object") {
    return res.status(400).json({ error: "Invalid config" });
  }

  // 校验必需的配置项
  const requiredKeys = ["LOGIC_OPERATORS", "SPECIAL_SEPARATORS", "ROW_PATTERNS"];
  for (const key of requiredKeys) {
    if (!newConfig[key]) {
      return res.status(400).json({ error: `Missing required config: ${key}` });
    }
  }

  try {
    // 生成配置文件内容（带详细注释）
    const content = generateConfigFileContent(newConfig);

    // 写入文件
    fs.writeFileSync(configPath, content, "utf-8");

    // 更新内存中的配置
    EXPCARD_CONFIG = newConfig;

    console.log("Config saved to", configPath);
    res.json({ success: true, message: "配置已保存" });
  } catch (err) {
    console.error("Config save failed:", err);
    res.status(500).json({ error: "保存配置失败: " + err.message });
  }
});

// 将对象转换为不带引号键的JS格式
function objectToJs(obj, indent = 4) {
  const spaces = " ".repeat(indent);
  const entries = Object.entries(obj).map(([key, value]) => {
    const val = typeof value === "string" ? `"${value}"` : JSON.stringify(value);
    return `${spaces}${key}: ${val}`;
  });
  return `{\n${entries.join(",\n")},\n${" ".repeat(indent - 2)}}`;
}

// 生成配置文件内容
function generateConfigFileContent(config) {
  return `/**
 * ExpCard Converter - 配置文件
 *
 * 本文件用于自定义试验卡转换工具的识别规则和输出格式。
 * 修改后重启服务即可生效。
 *
 * 配置项说明：
 *   - LOGIC_OPERATORS:      逻辑运算符映射（Excel中的值 → 输出值）
 *   - SPECIAL_SEPARATORS:   特殊分隔符映射（前缀匹配，自动转换）
 *   - ROW_PATTERNS:         行识别规则（支持精确匹配、正则匹配、前缀匹配）
 */

const EXPCARD_CONFIG = {

  // ========================================================================
  // 逻辑运算符映射
  // ========================================================================
  // 用途：将Excel中的逻辑运算符转换为输出格式
  // 格式：{ 键: 值 }，键为Excel中的值，值为输出时使用的值
  //
  // 示例：
  //   Excel中写 "与"，输出时显示 "且"
  //   Excel中写 "或取反"，输出时保持 "或取反"
  //
  // 注意：此处定义的键会自动成为逻辑分隔符识别列表
  // ========================================================================
  LOGIC_OPERATORS: ${objectToJs(config.LOGIC_OPERATORS, 4)},

  // ========================================================================
  // 特殊分隔符映射
  // ========================================================================
  // 用途：处理无法正常拼接的特殊逻辑（如"或延时720s"）
  // 格式：{ 键: 值 }，键为特殊值前缀，值为转换后的输出
  //
  // 匹配方式：前缀匹配
  //   - "或延时720s" 匹配 "或延时"，输出 "或"
  //   - "与延时300s" 匹配 "与延时"，输出 "且"
  //
  // 特殊分隔符的位置会被记录，用于后续标记警告
  // ========================================================================
  SPECIAL_SEPARATORS: ${objectToJs(config.SPECIAL_SEPARATORS, 4)},

  // ========================================================================
  // 行识别规则
  // ========================================================================
  // 用途：定义各类行的识别条件
  // 格式：{ 规则名称: { type: 匹配类型, ... } }
  //
  // 支持的匹配类型：
  //   - exact:       精确匹配，值在 values 数组中
  //   - regex:       正则匹配，pattern 为正则表达式字符串
  //   - startsWith:  前缀匹配，值在 values 数组中
  //
  // 规则名称说明：
  //   - header:           表头行（匹配后跳过该行）
  //   - chineseTitle:     中文数字标题（输出为 ## 标题）
  //   - subTitle:         子标题（输出为 ### 标题）
  //   - pureNumber:       纯数字行（一级内容）
  //   - subItem:          子项行（二级内容）
  //   - paragraphTitle:   段落标题（跳过内容区域）
  //   - contentStart:     内容起始标记
  //   - skipSectionStart: 跳过区间的开始标记
  //
  // 注意：
  //   1. 正则表达式中的反斜杠需要转义（如 \\d 而非 \d）
  //   2. 不配置的规则会使用内置默认值
  // ========================================================================
  ROW_PATTERNS: ${JSON.stringify(config.ROW_PATTERNS || getDefaultConfig().ROW_PATTERNS, null, 4)},

  // ========================================================================
  // 输出格式配置
  // ========================================================================
  // 用途：自定义转换后的输出格式
  //
  // 序号设置（numbering）：
  //   - enabled:   是否启用自动序号
  //   - separator: 层级分隔符（如 "." 或 "-"）
  //   - startNum:  起始序号
  //   - numType:   数字类型（arabic/roman/chinese）
  //
  // 各层级格式（levels）：
  //   - type:     列表类型（ordered 有序 / unordered 无序）
  //   - prefix:   Markdown 标题前缀（如 "## "）
  //   - bullet:   无序列表符号（如 "-"、"*"、"+"）
  //   - indent:   缩进级别（数字）
  //   - template: 格式模板
  //     {prefix}  - 标题前缀
  //     {num}     - 序号
  //     {text}    - 文本内容
  //     {indent}  - 缩进
  //     {bullet}  - 无序列表符号
  //
  // 缩进设置（indent）：
  //   - size: 每级缩进空格数
  //   - char: 缩进字符（空格或制表符）
  // ========================================================================
  OUTPUT_FORMAT: ${JSON.stringify(config.OUTPUT_FORMAT || getDefaultConfig().OUTPUT_FORMAT, null, 4)}
};
`;
}

// Markdown 转 Word
app.post("/api/convert-to-word", (req, res) => {
  const { markdown, filename } = req.body;

  if (!markdown) {
    return res.status(400).json({ error: "Markdown content is empty" });
  }

  const tempDir = os.tmpdir();
  const tempMd = path.join(tempDir, `dcs_${Date.now()}.md`);
  const tempDocx = path.join(tempDir, `dcs_${Date.now()}.docx`);

  fs.writeFileSync(tempMd, markdown, "utf-8");

  const cmd = `"${PANDOC_PATH}" "${tempMd}" -o "${tempDocx}" --from markdown --to docx`;

  exec(cmd, (error, stdout, stderr) => {
    try {
      fs.unlinkSync(tempMd);
    } catch (e) {}

    if (error) {
      console.error("Pandoc conversion failed:", stderr);
      return res.status(500).json({ error: "Conversion failed: " + stderr });
    }

    const docxBuffer = fs.readFileSync(tempDocx);
    try {
      fs.unlinkSync(tempDocx);
    } catch (e) {}

    const outputName = (filename || "test").replace(/\.[^.]+$/, "") + ".docx";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(outputName)}`,
    );
    res.send(docxBuffer);
  });
});

app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
  console.log(`Pandoc path: ${PANDOC_PATH}`);
});
