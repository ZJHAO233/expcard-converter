# Changelog

## [1.2.1] - 2025-07-21

### 修复

- 修复配置面板修改值后未同步到 currentConfig 的问题
- 修复配置保存后键值对格式问题（键不再被双引号包裹）

### 优化

- 简化配置结构，移除冗余配置项（SKIP_HEADERS、SECTION_HEADERS、CONTENT_START）
- 配置文件现在只保留三个配置项：LOGIC_OPERATORS、SPECIAL_SEPARATORS、ROW_PATTERNS

---

## [1.2.0] - 2025-07-21

### 新增功能

#### 自定义检测规则
- 配置文件 `config.js` 新增 `ROW_PATTERNS` 配置项，支持自定义行识别规则
- 支持三种匹配类型：
  - `exact`：精确匹配，值在 values 数组中
  - `regex`：正则匹配，pattern 为正则表达式字符串
  - `startsWith`：前缀匹配，值在 values 数组中

#### Web UI 配置面板
- 新增右上角 ⚙️ 设置按钮，点击打开配置规则面板
- 支持可视化编辑所有配置项，无需手动修改代码文件
- 逻辑运算符映射：支持添加、修改、删除
- 特殊分隔符映射：支持添加、修改、删除
- 行识别规则：支持可视化编辑匹配类型和匹配条件
- 配置面板所有界面文字使用中文显示

#### 配置管理
- 支持导出配置为 JSON 文件
- 支持从 JSON 文件导入配置
- 支持一键恢复默认配置

#### 后端 API
- 新增 `GET /api/config` 接口，读取当前配置
- 新增 `POST /api/config` 接口，保存配置到 config.js
- 保存后自动热加载，无需重启服务

### 修改内容

- `convert.js`：行识别逻辑改为从配置读取，不再硬编码
- `convert.js`：新增 `_parseRowPatterns()`、`_matchPattern()` 方法
- `convert.js`：新增 `_isPureNumber()`、`_isContentStart()` 方法
- `server.js`：新增配置读写 API 和配置文件生成函数
- `index.html`：新增配置面板 UI 和交互逻辑

---

## [1.1.0] - 2025-07-21

### 新增功能

#### 自定义行识别规则
- `config.js` 新增 `ROW_PATTERNS` 配置项
- 支持三种匹配类型：
  - `exact`：精确匹配，值在 values 数组中
  - `regex`：正则匹配，pattern 为正则表达式字符串
  - `startsWith`：前缀匹配，值在 values 数组中

#### 行识别规则说明
- `header`：表头行（匹配后跳过该行）
- `chineseTitle`：中文数字标题（输出为 ## 标题）
- `subTitle`：子标题（输出为 ### 标题）
- `pureNumber`：纯数字行（一级内容）
- `subItem`：子项行（二级内容）
- `paragraphTitle`：段落标题（跳过内容区域）
- `contentStart`：内容起始标记
- `skipSectionStart`：跳过区间的开始标记

### 修改内容

- `convert.js`：行识别逻辑改为从配置读取，不再硬编码
- `convert.js`：新增 `_parseRowPatterns()`、`_matchPattern()` 方法
- `convert.js`：新增 `_isPureNumber()`、`_isContentStart()` 方法

### 向后兼容

- 如果 `config.js` 中没有 `ROW_PATTERNS`，自动使用默认配置
