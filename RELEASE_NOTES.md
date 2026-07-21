# ExpCard Converter v1.2.x 改动文档

## 版本信息

- **当前版本**：v1.2.1
- **发布日期**：2025-07-21
- **改动范围**：自定义检测规则 + Web UI 配置面板

---

## 一、改动概述

本次改动为 ExpCard Converter 新增了自定义检测规则功能，允许用户根据实际 Excel 模板配置识别条件，无需修改代码。同时新增了 Web UI 配置面板，支持可视化编辑配置。

---

## 二、新增功能

### 2.1 自定义检测规则

#### 配置项 `ROW_PATTERNS`

新增 `ROW_PATTERNS` 配置项，支持自定义行识别规则。

**支持的匹配类型**：

| 类型 | 说明 | 示例 |
|------|------|------|
| `exact` | 精确匹配，值在 values 数组中 | `values: ["序号", "条件确认"]` |
| `regex` | 正则匹配，pattern 为正则表达式字符串 | `pattern: "^\\d+$"` |
| `startsWith` | 前缀匹配，值在 values 数组中 | `values: ["或延时", "与延时"]` |

**可配置的规则**：

| 规则名称 | 说明 | 默认值 |
|----------|------|--------|
| `header` | 表头行（匹配后跳过该行） | `["序号", "条件确认"]` |
| `chineseTitle` | 中文数字标题（输出为 ## 标题） | `^[一二三四五六七八九十]+、` |
| `subTitle` | 子标题（输出为 ### 标题） | `^\\d+\\.[\\u4e00-\\u9fa5]` |
| `pureNumber` | 纯数字行（一级内容） | `^\\d+$` |
| `subItem` | 子项行（二级内容） | `^\\d+\\.\\d+$` |
| `paragraphTitle` | 段落标题（跳过内容区域） | `["试验条件", "试验恢复", "结论", "存在问题"]` |
| `contentStart` | 内容起始标记 | `["试验内容"]` |
| `skipSectionStart` | 跳过区间开始 | `["试验条件"]` |

### 2.2 Web UI 配置面板

#### 功能列表

- 新增右上角 ⚙️ 设置按钮，点击打开配置规则面板
- 逻辑运算符映射：支持添加、修改、删除
- 特殊分隔符映射：支持添加、修改、删除
- 行识别规则：支持可视化编辑匹配类型和匹配条件
- 配置导入/导出：支持 JSON 格式
- 恢复默认配置：一键恢复默认值

#### 界面说明

- 配置面板使用中文界面
- 行识别规则显示中文名称（表头行、中文数字标题、子标题等）
- 匹配类型显示中文（精确匹配、正则匹配、前缀匹配）

### 2.3 后端 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/config` | GET | 读取当前配置 |
| `/api/config` | POST | 保存配置到 config.js |

**保存后自动热加载，无需重启服务。**

---

## 三、配置文件结构

### 简化后的配置（v1.2.1）

```javascript
const EXPCARD_CONFIG = {

  // 逻辑运算符映射
  LOGIC_OPERATORS: {
    与: "且",
    且: "且",
    或: "或",
    或取反: "或取反",
  },

  // 特殊分隔符映射
  SPECIAL_SEPARATORS: {
    或延时: "或",
    与延时: "且",
  },

  // 行识别规则
  ROW_PATTERNS: {
    header: { type: "exact", values: ["序号", "条件确认"] },
    chineseTitle: { type: "regex", pattern: "^[一二三四五六七八九十]+、" },
    subTitle: { type: "regex", pattern: "^\\d+\\.[\\u4e00-\\u9fa5]" },
    pureNumber: { type: "regex", pattern: "^\\d+$" },
    subItem: { type: "regex", pattern: "^\\d+\\.\\d+$" },
    paragraphTitle: { type: "exact", values: ["试验条件", "试验恢复", "结论", "存在问题"] },
    contentStart: { type: "exact", values: ["试验内容"] },
    skipSectionStart: { type: "exact", values: ["试验条件"] },
  }
};
```

### 移除的配置项

| 配置项 | 替代方案 |
|--------|----------|
| `SKIP_HEADERS` | `ROW_PATTERNS.header` |
| `SECTION_HEADERS` | `ROW_PATTERNS.paragraphTitle` |
| `CONTENT_START` | `ROW_PATTERNS.contentStart` |

---

## 四、修改的文件

### 4.1 convert.js（核心转换逻辑）

**新增方法**：

| 方法 | 说明 |
|------|------|
| `_getDefaultConfig()` | 获取默认配置 |
| `_parseRowPatterns(patterns)` | 解析行识别规则（编译正则表达式） |
| `_matchPattern(text, patternKey)` | 使用配置的规则匹配文本 |
| `_isPureNumber(text)` | 判断是否为纯数字行 |
| `_isContentStart(text)` | 判断是否为内容起始标记 |

**修改的方法**：

| 方法 | 修改内容 |
|------|----------|
| `constructor()` | 从配置读取规则，不再硬编码 |
| `_isHeaderRow()` | 改为调用 `_matchPattern()` |
| `_isChineseNumberTitle()` | 改为调用 `_matchPattern()` |
| `_isSubTitle()` | 改为调用 `_matchPattern()` |
| `_isSubItem()` | 改为调用 `_matchPattern()` |
| `_processRow()` | 段落标题和内容起始判断改为配置化 |
| `_processNewRow()` | 同上 |

**删除的方法**：

| 方法 | 说明 |
|------|------|
| `_matchDefaultPattern()` | 旧配置回退逻辑，已删除 |

### 4.2 server.js（服务端）

**新增方法**：

| 方法 | 说明 |
|------|------|
| `objectToJs(obj, indent)` | 将对象转换为不带引号键的 JS 格式 |
| `generateConfigFileContent(config)` | 生成带注释的配置文件内容 |

**新增 API**：

| 接口 | 说明 |
|------|------|
| `GET /api/config` | 读取当前配置 |
| `POST /api/config` | 保存配置到 config.js |

**修改的方法**：

| 方法 | 修改内容 |
|------|----------|
| `getDefaultConfig()` | 移除旧配置项，只保留 ROW_PATTERNS |

### 4.3 index.html（前端页面）

**新增 UI**：

| 组件 | 说明 |
|------|------|
| 设置按钮 (⚙️) | 打开配置面板 |
| 配置面板 | 可视化编辑配置 |
| 逻辑运算符列表 | 支持增删改 |
| 特殊分隔符列表 | 支持增删改 |
| 行识别规则列表 | 支持编辑匹配类型和条件 |

**新增 JavaScript 函数**：

| 函数 | 说明 |
|------|------|
| `loadConfig()` | 从服务器加载配置 |
| `renderConfigPanel()` | 渲染配置面板 |
| `renderLogicOperators()` | 渲染逻辑运算符列表 |
| `renderSpecialSeparators()` | 渲染特殊分隔符列表 |
| `renderRowPatterns()` | 渲染行识别规则列表 |
| `syncLogicOperators()` | 同步逻辑运算符到 currentConfig |
| `syncSpecialSeparators()` | 同步特殊分隔符到 currentConfig |

**新增 CSS 样式**：

| 样式 | 说明 |
|------|------|
| `.settings-toggle` | 设置按钮样式 |
| `.config-modal` | 配置面板弹窗样式 |
| `.config-section` | 配置区块样式 |
| `.config-item` | 配置项样式 |
| `.config-tag` | 标签样式 |
| `.config-btn` | 按钮样式 |

### 4.4 config.js（配置文件）

**新增配置项**：

| 配置项 | 说明 |
|------|------|
| `ROW_PATTERNS` | 行识别规则 |

**移除配置项**：

| 配置项 | 说明 |
|------|------|
| `SKIP_HEADERS` | 由 ROW_PATTERNS.header 替代 |
| `SECTION_HEADERS` | 由 ROW_PATTERNS.paragraphTitle 替代 |
| `CONTENT_START` | 由 ROW_PATTERNS.contentStart 替代 |

### 4.5 文档文件

| 文件 | 说明 |
|------|------|
| `CHANGELOG.md` | 版本发布说明 |
| `README.md` | 项目说明文档（已更新配置部分） |

---

## 五、提交记录

| 提交 | 说明 |
|------|------|
| `ae4b146` | feat: v1.2.0 自定义检测规则 + Web UI 配置面板 |
| `eadb976` | fix: 修复配置保存后键值对格式问题 |
| `319e94f` | fix: 修复配置面板值同步问题 |
| `33709ff` | refactor: 简化配置结构，移除冗余配置项 |
| `4d11cc1` | docs: 更新发布文档 |

---

## 六、使用说明

### 6.1 启动服务

```bash
cd dcs-expcard-tool-nodejs
npm install
npm start
```

### 6.2 配置方式

**方式一：修改配置文件**
直接编辑 `config.js`，保存后需重启服务生效。

**方式二：Web UI 配置**
1. 访问 http://localhost:3210
2. 点击右上角 ⚙️ 按钮
3. 修改配置后点击"保存配置"

**方式三：导入/导出**
- 导出：将当前配置保存为 JSON 文件
- 导入：从 JSON 文件导入配置

### 6.3 配置示例

**添加新的逻辑运算符**：
```javascript
LOGIC_OPERATORS: {
  与: "且",
  且: "且",
  或: "或",
  或取反: "或取反",
  异或: "⊕",  // 新增
}
```

**修改表头识别规则**：
```javascript
ROW_PATTERNS: {
  header: { type: "exact", values: ["序号", "条件确认", "备注"] },
  // ...
}
```

**使用正则匹配**：
```javascript
ROW_PATTERNS: {
  subTitle: { type: "regex", pattern: "^\\d+\\.\\d+\\s+[\\u4e00-\\u9fa5]" },
  // ...
}
```

---

## 七、注意事项

1. **正则表达式转义**：配置文件中正则表达式的反斜杠需要转义（如 `\\d` 而非 `\d`）
2. **配置生效**：修改配置文件需重启服务；通过 Web UI 保存后自动生效
3. **向后兼容**：v1.2.0 之前的配置文件需要手动迁移到新格式
4. **备份配置**：建议在修改配置前导出备份

---

## 八、问题排查

### 配置不生效

1. 检查是否重启了服务（修改配置文件后需要重启）
2. 检查浏览器是否缓存了旧的配置（尝试 Ctrl+F5 刷新）
3. 检查 config.js 语法是否正确（可用 Node.js 测试：`node -e "require('./config.js')"`）

### 配置面板无法保存

1. 检查浏览器控制台是否有错误
2. 检查服务器日志是否有错误输出
3. 确认网络连接正常

---

*文档生成日期：2025-07-21*
