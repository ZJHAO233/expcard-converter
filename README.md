# ExpCard Converter (Node.js)

将试验卡 Excel 表格中的逻辑条件快速提取并转换为 Markdown 格式，支持导出为 Word 文档。

## 功能特性

- **智能逻辑提取** - 自动识别"与"、"且"、"或"、"或取反"等逻辑运算符
- **多级结构支持** - 保持原文档的层级结构
- **特殊分隔符处理** - 自动检测并转换"或延时"、"与延时"等特殊分隔符
- **实时预览** - 转换后即时预览 Markdown 效果
- **大纲导航** - 生成可折叠的大纲树，快速定位内容
- **批量处理** - 支持单个 Sheet 或全部 Sheet 批量转换
- **多格式导出** - 支持 Markdown 和 Word 文档导出
- **主题切换** - 支持浅色、深色、毛玻璃三种主题

## 快速开始

### 安装依赖

```bash
cd dcs-expcard-tool-nodejs
npm install
```

### 启动服务

```bash
npm start
```

服务器将在 `http://localhost:3210` 启动。

### 使用步骤

1. 上传 `.xlsx` 格式的试验卡文件
2. 选择要转换的工作表
3. 选择转换范围（当前 Sheet 或全部）
4. 点击"转换"按钮
5. 预览转换后的 Markdown 内容
6. 导出为 Markdown 或 Word 文档

## 项目结构

```
dcs-expcard-tool-nodejs/
├── server.js          # Express 服务器
├── convert.js         # 核心转换逻辑
├── config.js          # 配置文件
├── index.html         # 前端界面
├── package.json       # 项目配置
└── pandoc.exe         # Word 转换工具
```

## 技术栈

- **后端**：Node.js + Express
- **前端**：原生 HTML/CSS/JavaScript
- **Excel 解析**：SheetJS (xlsx)
- **Markdown 转 Word**：Pandoc

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 许可证

MIT License
