/**
 * 初始化配置文件脚本
 * 运行此脚本将生成默认的 config.js 文件
 */

const fs = require('fs');
const path = require('path');

const defaultConfig = {
  // 逻辑运算符字典
  // 格式: "Excel中的值": "输出格式"
  LOGIC_OPERATORS: {
    "与": "且",
    "且": "且",
    "或": "或",
    "或取反": "或取反",
  },

  // 特殊分隔符字典
  // 格式: "Excel中的特殊值": "转换后的输出"
  SPECIAL_SEPARATORS: {
    "或延时": "或",
    "与延时": "且",
  },

  // 跳过的表头（不处理的行）
  SKIP_HEADERS: ["序号", "条件确认"],

  // 段落标题（这些标题下的内容不进行逻辑转换）
  SECTION_HEADERS: ["试验条件", "试验恢复", "结论", "存在问题"],
};

const configContent = `/**
 * ExpCard Converter - 配置文件
 * 修改此文件可自定义逻辑运算符和特殊分隔符
 * 
 * 使用说明：
 * 1. LOGIC_OPERATORS: 逻辑运算符映射
 *    - key: Excel中的运算符文本
 *    - value: 输出到Markdown的格式
 * 
 * 2. SPECIAL_SEPARATORS: 特殊分隔符映射
 *    - key: Excel中的特殊分隔符
 *    - value: 转换后的标准输出
 * 
 * 3. SKIP_HEADERS: 跳过的表头行
 *    - 这些表头对应的行不会被处理
 * 
 * 4. SECTION_HEADERS: 段落标题
 *    - 这些标题下的内容不进行逻辑转换
 */

const EXPCARD_CONFIG = ${JSON.stringify(defaultConfig, null, 2)};
`;

const configPath = path.join(__dirname, 'config.js');

if (fs.existsSync(configPath)) {
  console.log('⚠️  config.js 已存在，跳过创建');
  console.log('   如需重新生成，请先删除现有文件');
} else {
  fs.writeFileSync(configPath, configContent, 'utf-8');
  console.log('✅ 已创建默认配置文件: config.js');
  console.log('   请根据需要修改此文件');
}
