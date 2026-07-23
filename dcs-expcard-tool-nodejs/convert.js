/**
 * ExpCard Converter - Excel试验条件表转Markdown工具
 */

class ExpCardConverter {
  constructor(config = null) {
    // 如果没有传入配置，尝试从全局变量获取，否则使用默认配置
    if (config === null) {
      config = (typeof EXPCARD_CONFIG !== 'undefined') ? EXPCARD_CONFIG : this._getDefaultConfig();
    }
    this.config = config;

    // 从配置中读取
    this.LOGIC_OPERATORS = config.LOGIC_OPERATORS;
    this.SPECIAL_SEPARATORS = config.SPECIAL_SEPARATORS;
    this.LOGIC_SEPARATORS = Object.keys(this.LOGIC_OPERATORS);

    // 解析行识别规则
    this.ROW_PATTERNS = this._parseRowPatterns(config.ROW_PATTERNS);

    // 输出格式配置
    this.OUTPUT_FORMAT = config.OUTPUT_FORMAT || this._getDefaultOutputFormat();

    this.output = [];
    this.inContentArea = false;
    this.skipSection = false;
    this.currentSubTitleLogic = null;
    this.processedRows = new Set();
    this.special_separator_positions = new Set();
    this._recordedPositions = new Set();
    this.itemCounter = 0;

    // 序号计数器
    this.numberCounters = [0, 0, 0, 0, 0]; // 最多支持5层
    this.currentLevel = 0;
  }

  _getDefaultConfig() {
    return {
      LOGIC_OPERATORS: { '与': '且', '且': '且', '或': '或', '或取反': '或取反' },
      SPECIAL_SEPARATORS: { '或延时': '或', '与延时': '且' },
      ROW_PATTERNS: {
        header: { type: 'exact', values: ['序号', '条件确认'] },
        chineseTitle: { type: 'regex', pattern: '^[一二三四五六七八九十]+、' },
        subTitle: { type: 'regex', pattern: '^\\d+\\.[\\u4e00-\\u9fa5]' },
        pureNumber: { type: 'regex', pattern: '^\\d+$' },
        subItem: { type: 'regex', pattern: '^\\d+\\.\\d+$' },
        paragraphTitle: { type: 'exact', values: ['试验条件', '试验恢复', '结论', '存在问题'] },
        contentStart: { type: 'exact', values: ['试验内容'] },
        skipSectionStart: { type: 'exact', values: ['试验条件'] }
      },
      OUTPUT_FORMAT: this._getDefaultOutputFormat()
    };
  }

  _getDefaultOutputFormat() {
    // 默认不启用自定义格式，保持原有输出
    return {
      useLegacy: true,  // 使用原有格式
      numbering: {
        enabled: false,
        separator: ".",
        startNum: 1,
        numType: "arabic",
      },
      levels: {
        title: { type: "ordered", prefix: "## ", bullet: "-", indent: 0, template: "{prefix}{num} {text}" },
        subTitle: { type: "ordered", prefix: "### ", bullet: "-", indent: 0, template: "{prefix}{num} {text}" },
        content1: { type: "ordered", prefix: "", bullet: "-", indent: 0, template: "{indent}{num} {text}" },
        content2: { type: "ordered", prefix: "", bullet: "-", indent: 1, template: "{indent}{num} {text}" },
        content3: { type: "unordered", prefix: "", bullet: "-", indent: 2, template: "{indent}{bullet} {text}" },
        content4: { type: "unordered", prefix: "", bullet: "*", indent: 3, template: "{indent}{bullet} {text}" },
      },
      indent: { size: 3, char: " " }
    };
  }

  // 生成层级序号（如 1.1.2）
  _generateNumber() {
    const numbering = this.OUTPUT_FORMAT.numbering;
    if (!numbering.enabled) return '';

    const parts = [];
    for (let i = 0; i < this.numberCounters.length; i++) {
      if (this.numberCounters[i] === 0 && i > 0) break;
      parts.push(this._formatSingleNumber(this.numberCounters[i], numbering.numType));
    }

    const sep = numbering.separator || '.';
    return parts.join(sep);
  }

  // 格式化单个序号
  _formatSingleNumber(num, numType) {
    if (!numType || numType === 'arabic') return String(num);
    if (numType === 'roman') return this._toRoman(num);
    if (numType === 'chinese') return this._toChinese(num);
    return String(num);
  }

  _toRoman(num) {
    const romanNumerals = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let result = '';
    for (const [value, numeral] of romanNumerals) {
      while (num >= value) {
        result += numeral;
        num -= value;
      }
    }
    return result;
  }

  _toChinese(num) {
    const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (num <= 10) return chineseNums[num];
    if (num < 20) return '十' + (num % 10 === 0 ? '' : chineseNums[num % 10]);
    if (num < 100) {
      const tens = Math.floor(num / 10);
      const ones = num % 10;
      return chineseNums[tens] + '十' + (ones === 0 ? '' : chineseNums[ones]);
    }
    return String(num); // 超过100用数字
  }

  // 生成缩进
  _makeIndent(level) {
    const { size = 3, char = ' ' } = this.OUTPUT_FORMAT.indent || {};
    return char.repeat(size * level);
  }

  // 提取标题文字（去掉原始编号）
  _extractTitleText(text) {
    // 去掉中文数字编号：一、试验内容 → 试验内容
    text = text.replace(/^[一二三四五六七八九十]+、\s*/, '');
    // 去掉子标题编号：1.1 试验条件（与） → 试验条件（与）
    text = text.replace(/^\d+\.\d+\s*/, '');
    // 去掉纯数字编号：1. 试验内容 → 试验内容
    text = text.replace(/^\d+[.、]\s*/, '');
    return text.trim();
  }

  // 检查是否使用自定义格式
  _useCustomFormat() {
    return this.OUTPUT_FORMAT && !this.OUTPUT_FORMAT.useLegacy;
  }

  // 格式化输出行
  _formatOutput(levelKey, text, levelIndex = 0) {
    // 如果使用原有格式，直接返回文本
    if (!this._useCustomFormat()) {
      return text;
    }

    const level = this.OUTPUT_FORMAT.levels[levelKey];
    if (!level) return text;

    const numbering = this.OUTPUT_FORMAT.numbering;
    const indent = this._makeIndent(level.indent + levelIndex);

    let numStr = '';
    if (numbering.enabled && level.type === 'ordered') {
      numStr = this._generateNumber();
    }

    const bullet = level.bullet || '-';
    const template = level.template || '{indent}{num} {text}';

    return template
      .replace('{prefix}', level.prefix || '')
      .replace('{num}', numStr)
      .replace('{text}', text)
      .replace('{indent}', indent)
      .replace('{bullet}', bullet);
  }

  // 重置子级序号
  _resetChildCounters(level) {
    for (let i = level + 1; i < this.numberCounters.length; i++) {
      this.numberCounters[i] = 0;
    }
  }

  // 递增序号
  _incrementCounter(level) {
    this.numberCounters[level]++;
    this._resetChildCounters(level);
    return this.numberCounters[level];
  }

  // 获取当前序号（不递增）
  _getCounter(level) {
    return this.numberCounters[level];
  }

  _parseRowPatterns(patterns) {
    if (!patterns) return null;
    const result = {};
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.type === 'regex') {
        result[key] = { type: 'regex', regex: new RegExp(pattern.pattern) };
      } else {
        result[key] = pattern;
      }
    }
    return result;
  }

  _matchPattern(text, patternKey) {
    if (!this.ROW_PATTERNS || !this.ROW_PATTERNS[patternKey]) {
      return false;
    }
    const pattern = this.ROW_PATTERNS[patternKey];
    if (pattern.type === 'regex') {
      return pattern.regex.test(text);
    } else if (pattern.type === 'exact') {
      return pattern.values.includes(text);
    } else if (pattern.type === 'startsWith') {
      return pattern.values.some(v => text.startsWith(v));
    }
    return false;
  }

  convert(rows) {
    this.output = [];
    this.inContentArea = false;
    this.skipSection = false;
    this.currentSubTitleLogic = null;
    this.processedRows = new Set();
    this.special_separator_positions = new Set();
    this._recordedPositions = new Set();
    this.itemCounter = 0;

    // 初始化序号计数器（从0开始，_incrementCounter会先递增）
    this.numberCounters = [0, 0, 0, 0, 0];
    this.currentLevel = 0;

    for (let i = 0; i < rows.length; i++) {
      if (this.processedRows.has(i)) continue;
      this._processRow(rows[i], rows, i);
    }

    return this.output.join("\n");
  }

  _isSpecialSeparator(text, rowIndex = null, colIndex = null) {
    for (const key of Object.keys(this.SPECIAL_SEPARATORS)) {
      if (text.startsWith(key)) {
        if (rowIndex !== null && colIndex !== null) {
          this.special_separator_positions.add([rowIndex, colIndex]);
        }
        return true;
      }
    }
    return false;
  }

  _getSpecialSeparatorOutput(text) {
    for (const [key, value] of Object.entries(this.SPECIAL_SEPARATORS)) {
      if (text.startsWith(key)) {
        return value;
      }
    }
    return text;
  }

  _processRow(row, allRows, index) {
    const seqNum = row[0] || "";
    const logicCol = row[1] || "";
    const contentCol = row[2] || "";

    if (!seqNum && !logicCol) return;
    if (this._isHeaderRow(row)) return;

    if (this._isChineseNumberTitle(seqNum)) {
      this.output.push("");
      if (this._useCustomFormat()) {
        const titleText = this._extractTitleText(seqNum);
        this._incrementCounter(0);
        this.output.push(this._formatOutput('title', titleText));
      } else {
        this.output.push("## " + seqNum);
      }
      this.inContentArea = false;
      this.skipSection = false;
      return;
    }

    if (this._matchPattern(seqNum, 'paragraphTitle')) {
      if (this._matchPattern(seqNum, 'skipSectionStart')) {
        this.skipSection = true;
      }
      this.inContentArea = false;
      return;
    }

    if (this._isContentStart(seqNum)) {
      this.inContentArea = true;
      this.skipSection = false;
      return;
    }

    if (this.skipSection) return;

    if (this._isSubTitle(seqNum)) {
      const normalized = seqNum.replace(/\(/g, "（").replace(/\)/g, "）");
      this.output.push("");
      if (this._useCustomFormat()) {
        const subTitleText = this._extractTitleText(normalized);
        this._incrementCounter(1);
        this.output.push(this._formatOutput('subTitle', subTitleText));
      } else {
        this.output.push("### " + normalized);
      }
      this.output.push("");
      this.currentSubTitleLogic = this._extractTitleLogic(normalized);
      return;
    }

    if (this._isPureNumber(seqNum)) {
      this._processLevel1(seqNum, logicCol, contentCol, row, allRows, index);
      return;
    }

    if (this._isSubItem(seqNum)) {
      this._processLevel2(seqNum, logicCol, contentCol, row, allRows, index);
      return;
    }
  }

  _isHeaderRow(row) {
    const seqNum = row[0] || "";
    const logicCol = row[1] || "";
    if (this._matchPattern(seqNum, 'header')) return true;
    if (seqNum === "序号" && (logicCol.includes("条件") || logicCol.includes("内容"))) return true;
    return false;
  }

  _isChineseNumberTitle(text) {
    return this._matchPattern(text, 'chineseTitle');
  }

  _isSubTitle(text) {
    return this._matchPattern(text, 'subTitle');
  }

  _isPureNumber(text) {
    return this._matchPattern(text, 'pureNumber');
  }

  _isSubItem(text) {
    return this._matchPattern(text, 'subItem');
  }

  _isContentStart(text) {
    return this._matchPattern(text, 'contentStart');
  }

  _extractTitleLogic(title) {
    const match = title.match(/[（(]([与或])[）)]/);
    return match ? match[1] : null;
  }

  _isLogicSeparator(text) {
    if (this.LOGIC_SEPARATORS.includes(text)) return true;
    for (const key of Object.keys(this.SPECIAL_SEPARATORS)) {
      if (text.startsWith(key)) return true;
    }
    return false;
  }

  _recordSpecialSeparators(row, rowIndex) {
    for (let col = 1; col <= Math.min(row.length - 1, 4); col++) {
      const val = row[col] || "";
      if (val) {
        for (const [key, value] of Object.entries(this.SPECIAL_SEPARATORS)) {
          if (val.startsWith(key)) {
            const posKey = `${rowIndex},${col}`;
            if (!this._recordedPositions.has(posKey)) {
              this._recordedPositions.add(posKey);
              this.special_separator_positions.add([rowIndex, col]);
            }
            break;
          }
        }
      }
    }
  }

  _getLogicOutput(logic) {
    for (const [key, value] of Object.entries(this.SPECIAL_SEPARATORS)) {
      if (logic.startsWith(key)) {
        return value;
      }
    }
    return this.LOGIC_OPERATORS[logic] || logic;
  }

  _getContentFromRow(row, startCol) {
    for (let i = startCol; i < row.length; i++) {
      const val = row[i];
      if (val && !this._isLogicSeparator(val)) {
        return val;
      }
    }
    return null;
  }

  _processLevel1(seqNum, logicCol, contentCol, row, allRows, index, useSeqNum = false) {
    this._recordSpecialSeparators(row, index);

    let hasChildren = false;
    let childLogic = null;

    if (index + 1 < allRows.length) {
      const nextSeqNum = allRows[index + 1][0] || "";
      if (this._isSubItem(nextSeqNum) && nextSeqNum.startsWith(seqNum + ".")) {
        hasChildren = true;
        const nextLogicCol = allRows[index + 1][1] || "";
        childLogic = this._isLogicSeparator(nextLogicCol) ? this._getLogicOutput(nextLogicCol) : null;
      }
    }

    let content = this._getContentFromRow(row, 1);
    if (!content) {
      content = logicCol && !this._isLogicSeparator(logicCol) ? logicCol : "";
    }

    let logicStr = "";
    if (hasChildren && childLogic) {
      if (this._isLogicSeparator(logicCol)) {
        const outputLogic = this._getLogicOutput(logicCol);
        if (outputLogic !== this.currentSubTitleLogic) {
          logicStr = "（" + outputLogic + "）";
        }
      } else {
        logicStr = "（" + childLogic + "）";
      }
    }

    if (logicCol && this._isSpecialSeparator(logicCol)) {
      logicStr = "（" + this._getLogicOutput(logicCol) + "）";
    } else if (logicCol && logicCol.includes("或取反")) {
      logicStr = "（或取反）";
    }

    if (useSeqNum) {
      if (this._useCustomFormat()) {
        this._incrementCounter(1);
        this.output.push(this._formatOutput('content1', content + logicStr));
      } else {
        this.output.push(this.itemCounter + ". " + content + logicStr);
      }
    } else {
      if (this._useCustomFormat()) {
        this._incrementCounter(1);
        this.output.push(this._formatOutput('content1', content + logicStr));
      } else {
        this.output.push(seqNum + ". " + content + logicStr);
      }
    }
  }

  _processLevel2(seqNum, logicCol, contentCol, row, allRows, index) {
    this._recordSpecialSeparators(row, index);

    const logicVal = logicCol || "";
    const contentVal = contentCol || "";
    const colD = row[3] || "";
    const colE = row[4] || "";

    const logicIsLogic = this._isLogicSeparator(logicVal);
    const contentIsLogic = this._isLogicSeparator(contentVal);
    const colDIsLogic = this._isLogicSeparator(colD);

    if (contentIsLogic && colDIsLogic) {
      this._processLevel3Group(seqNum, contentVal, colD, colE, row, allRows, index);
      return;
    }

    if (contentIsLogic && !colDIsLogic) {
      this._processLevel2Group(seqNum, contentVal, colD, row, allRows, index);
      return;
    }

    if (logicIsLogic) {
      if (contentVal && !contentIsLogic) {
        if (this._useCustomFormat()) {
          this._incrementCounter(2);
          this.output.push(this._formatOutput('content2', contentVal));
        } else {
          this.output.push("   - " + contentVal);
        }
        return;
      }
      return;
    }

    let content = null;
    for (let colIdx = 1; colIdx < row.length; colIdx++) {
      const val = row[colIdx];
      if (val && !this._isLogicSeparator(val)) {
        content = val;
        break;
      }
    }

    if (content) {
      if (this._useCustomFormat()) {
        this._incrementCounter(2);
        this.output.push(this._formatOutput('content2', content));
      } else {
        this.output.push("   - " + content);
      }
    }
  }

  _processLevel3Group(seqNum, cLogic, dLogic, firstContent, row, allRows, index) {
    this._recordSpecialSeparators(row, index);

    const level3Groups = [];
    let currentGroupItems = firstContent ? [firstContent] : [];
    let currentDLogic = dLogic;

    let j = index + 1;
    while (j < allRows.length) {
      const nextRow = allRows[j];
      const nextSeqNum = nextRow[0] || "";

      if (
        this._isSubItem(nextSeqNum) &&
        nextSeqNum.startsWith(seqNum.split(".")[0] + ".")
      ) {
        this._recordSpecialSeparators(nextRow, j);

        const nextC = nextRow[2] || "";
        const nextD = nextRow[3] || "";
        const nextE = nextRow[4] || "";

        if (this._isLogicSeparator(nextC)) break;

        if (this._isLogicSeparator(nextD)) {
          if (currentGroupItems.length > 0) {
            level3Groups.push([currentDLogic, [...currentGroupItems]]);
          }
          currentGroupItems = [];
          currentDLogic = nextD;
          if (nextE && !this._isLogicSeparator(nextE)) {
            currentGroupItems.push(nextE);
            this.processedRows.add(j);
          }
        } else if (nextD && !this._isLogicSeparator(nextD)) {
          if (currentGroupItems.length > 0) {
            level3Groups.push([currentDLogic, [...currentGroupItems]]);
            currentGroupItems = [];
          }
          level3Groups.push([null, [nextD]]);
          this.processedRows.add(j);
        } else if (nextE && !this._isLogicSeparator(nextE)) {
          currentGroupItems.push(nextE);
          this.processedRows.add(j);
        }
        j++;
      } else if (!nextSeqNum) {
        this._recordSpecialSeparators(nextRow, j);

        const nextC = nextRow[2] || "";
        const nextD = nextRow[3] || "";
        const nextE = nextRow[4] || "";

        if (this._isLogicSeparator(nextC)) break;

        if (this._isLogicSeparator(nextD)) {
          if (currentGroupItems.length > 0) {
            level3Groups.push([currentDLogic, [...currentGroupItems]]);
          }
          currentGroupItems = [];
          currentDLogic = nextD;
          if (nextE && !this._isLogicSeparator(nextE)) {
            currentGroupItems.push(nextE);
            this.processedRows.add(j);
          }
        } else if (nextD && !this._isLogicSeparator(nextD)) {
          if (currentGroupItems.length > 0) {
            level3Groups.push([currentDLogic, [...currentGroupItems]]);
            currentGroupItems = [];
          }
          level3Groups.push([null, [nextD]]);
          this.processedRows.add(j);
        } else if (nextE && !this._isLogicSeparator(nextE)) {
          currentGroupItems.push(nextE);
          this.processedRows.add(j);
        }
        j++;
      } else {
        break;
      }
    }

    if (currentGroupItems.length > 0) {
      level3Groups.push([currentDLogic, currentGroupItems]);
    }

    if (level3Groups.length > 0) {
      const resultParts = [];
      for (const [logic, items] of level3Groups) {
        if (logic === null) {
          resultParts.push(items[0]);
        } else {
          const outputLogic = this._getLogicOutput(logic);
          const separator = " " + outputLogic + " ";
          const groupStr = items.join(separator);
          if (items.length > 1) {
            resultParts.push("（" + groupStr + "）");
          } else {
            resultParts.push(groupStr);
          }
        }
      }
      const result = resultParts.join(" 或 ");
      if (this._useCustomFormat()) {
        this._incrementCounter(3);
        this.output.push(this._formatOutput('content3', result));
      } else {
        this.output.push("   - " + result);
      }
    }
  }

  _processLevel2Group(seqNum, cLogic, firstContent, row, allRows, index) {
    this._recordSpecialSeparators(row, index);

    const groupItems = firstContent ? [firstContent] : [];
    const continuationLogic = cLogic;

    let j = index + 1;
    while (j < allRows.length) {
      const nextRow = allRows[j];
      const nextSeqNum = nextRow[0] || "";

      if (
        this._isSubItem(nextSeqNum) &&
        nextSeqNum.startsWith(seqNum.split(".")[0] + ".")
      ) {
        this._recordSpecialSeparators(nextRow, j);

        const nextC = nextRow[2] || "";
        const nextD = nextRow[3] || "";

        if (this._isLogicSeparator(nextC)) break;
        if (this._isLogicSeparator(nextD)) break;

        let nextContent = null;
        for (let colIdx = 2; colIdx < nextRow.length; colIdx++) {
          const val = nextRow[colIdx];
          if (val && !this._isLogicSeparator(val)) {
            nextContent = val;
            break;
          }
        }

        if (nextContent) {
          groupItems.push(nextContent);
          this.processedRows.add(j);
        }
        j++;
      } else if (!nextSeqNum) {
        this._recordSpecialSeparators(nextRow, j);

        const nextC = nextRow[2] || "";
        const nextD = nextRow[3] || "";

        if (this._isLogicSeparator(nextC)) break;
        if (this._isLogicSeparator(nextD)) break;

        let nextContent = null;
        for (let colIdx = 2; colIdx < nextRow.length; colIdx++) {
          const val = nextRow[colIdx];
          if (val && !this._isLogicSeparator(val)) {
            nextContent = val;
            break;
          }
        }

        if (nextContent) {
          groupItems.push(nextContent);
          this.processedRows.add(j);
        }
        j++;
      } else {
        break;
      }
    }

    if (groupItems.length > 1) {
      let result = groupItems[0];
      const outputLogic = this._getLogicOutput(continuationLogic);
      const separator = " " + outputLogic + " ";
      for (let i = 1; i < groupItems.length; i++) {
        result = result + separator + groupItems[i];
      }
      if (this._useCustomFormat()) {
        this._incrementCounter(3);
        this.output.push(this._formatOutput('content3', result));
      } else {
        this.output.push("   - " + result);
      }
    } else if (groupItems.length > 0) {
      if (this._useCustomFormat()) {
        this._incrementCounter(3);
        this.output.push(this._formatOutput('content3', groupItems[0]));
      } else {
        this.output.push("   - " + groupItems[0]);
      }
    }
  }

  // ==================== New Mode Methods ====================

  convertNew(rows) {
    this.output = [];
    this.inContentArea = false;
    this.skipSection = false;
    this.currentSubTitleLogic = null;
    this.processedRows = new Set();
    this.special_separator_positions = new Set();
    this._recordedPositions = new Set();
    this.itemCounter = 0;

    // 初始化序号计数器（从0开始，_incrementCounter会先递增）
    this.numberCounters = [0, 0, 0, 0, 0];
    this.currentLevel = 0;

    for (let i = 0; i < rows.length; i++) {
      if (this.processedRows.has(i)) continue;
      this._processNewRow(rows[i], rows, i);
    }

    return this.output.join("\n");
  }

  _processNewRow(row, allRows, index) {
    const seqNum = row[0] || "";
    const logicCol = row[1] || "";

    if (!seqNum && !logicCol) return;
    if (this._isHeaderRow(row)) return;

    if (this._isChineseNumberTitle(seqNum)) {
      this.output.push("");
      if (this._useCustomFormat()) {
        const titleText = this._extractTitleText(seqNum);
        this._incrementCounter(0);
        this.output.push(this._formatOutput('title', titleText));
      } else {
        this.output.push("## " + seqNum);
      }
      this.inContentArea = false;
      this.skipSection = false;
      return;
    }

    if (this._matchPattern(seqNum, 'paragraphTitle')) {
      if (this._matchPattern(seqNum, 'skipSectionStart')) {
        this.skipSection = true;
      }
      this.inContentArea = false;
      return;
    }

    if (this._isContentStart(seqNum)) {
      this.inContentArea = true;
      this.skipSection = false;
      return;
    }

    if (this.skipSection) return;

    if (this._isSubTitle(seqNum)) {
      const normalized = seqNum.replace(/\(/g, "（").replace(/\)/g, "）");
      this.output.push("");
      if (this._useCustomFormat()) {
        const subTitleText = this._extractTitleText(normalized);
        this._incrementCounter(1);
        this.output.push(this._formatOutput('subTitle', subTitleText));
      } else {
        this.output.push("### " + normalized);
      }
      this.output.push("");
      this.currentSubTitleLogic = this._extractTitleLogic(normalized);
      this.itemCounter = 0;
      return;
    }

    if (this._isPureNumber(seqNum)) {
      this._processNewItem(seqNum, row, allRows, index);
      return;
    }
  }

  _processNewItem(seqNum, row, allRows, index) {
    this._recordSpecialSeparators(row, index);

    const logicCol = row[1] || "";
    const contentCol = row[2] || "";

    if (index + 1 < allRows.length) {
      const nextSeqNum = allRows[index + 1][0] || "";
      if (this._isSubItem(nextSeqNum)) {
        this.itemCounter += 1;
        this._processLevel1(seqNum, logicCol, contentCol, row, allRows, index, true);
        let j = index + 1;
        while (j < allRows.length) {
          if (this.processedRows.has(j)) {
            j++;
            continue;
          }
          const nextRow = allRows[j];
          const nextSeqNumVal = nextRow[0] || "";
          if (this._isSubItem(nextSeqNumVal) && nextSeqNumVal.startsWith(seqNum + ".")) {
            this._processLevel2(
              nextSeqNumVal,
              nextRow[1] || "",
              nextRow[2] || "",
              nextRow,
              allRows,
              j,
            );
            this.processedRows.add(j);
            j++;
          } else {
            break;
          }
        }
        return;
      }
    }

    const logicIsLogic = this._isLogicSeparator(logicCol);

    if (!logicIsLogic) {
      const content = logicCol || "";
      this.itemCounter += 1;
      if (this._useCustomFormat()) {
        this.output.push(this._formatOutput('content1', content));
      } else {
        this.output.push(this.itemCounter + ". " + content);
      }
      return;
    }

    this.itemCounter += 1;
    const result = this._processNewLevel2(
      this.itemCounter,
      logicCol,
      row,
      allRows,
      index,
    );
    if (this._useCustomFormat()) {
      this.output.push(this._formatOutput('content1', result));
    } else {
      this.output.push(this.itemCounter + ". " + result);
    }
  }

  _processNewLevel2(itemNum, bLogic, row, allRows, index) {
    this._recordSpecialSeparators(row, index);

    const contentCol = row[2] || "";
    const contentIsLogic = this._isLogicSeparator(contentCol);

    const endIndex = this._findEndIndex(allRows, index, 1);

    const items = [];
    let j = index;
    while (j <= endIndex) {
      if (j >= allRows.length) break;
      const nextRow = allRows[j];

      if (j !== index) {
        this._recordSpecialSeparators(nextRow, j);
      }

      const nextContent = nextRow[2] || "";

      if (j === index) {
        if (contentIsLogic) {
          const level3Result = this._processNewLevel3(
            itemNum,
            contentCol,
            nextRow,
            allRows,
            j,
          );
          items.push(level3Result);
        } else if (contentCol) {
          items.push(contentCol);
        }
      } else {
        if (this._isLogicSeparator(nextContent)) {
          const level3Result = this._processNewLevel3(
            itemNum,
            nextContent,
            nextRow,
            allRows,
            j,
          );
          items.push(level3Result);
          this.processedRows.add(j);
        } else if (nextContent) {
          items.push(nextContent);
          this.processedRows.add(j);
        }
      }

      j++;
    }

    const outputLogic = this._getLogicOutput(bLogic);
    const separator = " " + outputLogic + " ";
    return items.join(separator);
  }

  _processNewLevel3(itemNum, cLogic, row, allRows, index) {
    this._recordSpecialSeparators(row, index);

    const colD = row[3] || "";
    const colDIsLogic = this._isLogicSeparator(colD);

    const endIndex = this._findEndIndex(allRows, index, 2);

    const items = [];
    let j = index;
    while (j <= endIndex) {
      if (j >= allRows.length) break;
      const nextRow = allRows[j];

      if (j !== index) {
        this._recordSpecialSeparators(nextRow, j);
      }

      const nextD = nextRow[3] || "";

      if (j === index) {
        if (colDIsLogic) {
          const level4Result = this._processNewLevel4(
            itemNum,
            colD,
            nextRow,
            allRows,
            j,
          );
          items.push(level4Result);
        } else if (colD) {
          items.push(colD);
        }
      } else {
        if (this._isLogicSeparator(nextD)) {
          const level4Result = this._processNewLevel4(
            itemNum,
            nextD,
            nextRow,
            allRows,
            j,
          );
          items.push(level4Result);
          this.processedRows.add(j);
        } else if (nextD) {
          items.push(nextD);
          this.processedRows.add(j);
        }
      }

      j++;
    }

    const outputLogic = this._getLogicOutput(cLogic);
    const separator = " " + outputLogic + " ";
    const result = items.join(separator);
    if (items.length > 1) {
      return "（" + result + "）";
    }
    return result;
  }

  _formatGroupOutput(levelKey, items, logic) {
    const outputLogic = this._getLogicOutput(logic);
    const separator = " " + outputLogic + " ";
    const result = items.join(separator);
    if (items.length > 1) {
      return this._formatOutput(levelKey, "（" + result + "）");
    }
    return this._formatOutput(levelKey, result);
  }

  _processNewLevel4(itemNum, dLogic, row, allRows, index) {
    this._recordSpecialSeparators(row, index);

    const colE = row[4] || "";
    const endIndex = this._findEndIndex(allRows, index, 3);

    const items = [];
    let j = index;
    while (j <= endIndex) {
      if (j >= allRows.length) break;
      const nextRow = allRows[j];

      if (j !== index) {
        this._recordSpecialSeparators(nextRow, j);
      }

      const nextE = nextRow[4] || "";

      if (j === index) {
        if (colE && !this._isLogicSeparator(colE)) {
          items.push(colE);
        }
      } else {
        if (nextE && !this._isLogicSeparator(nextE)) {
          items.push(nextE);
          this.processedRows.add(j);
        }
      }

      j++;
    }

    const outputLogic = this._getLogicOutput(dLogic);
    const separator = " " + outputLogic + " ";
    const result = items.join(separator);
    if (this._useCustomFormat()) {
      if (items.length > 1) {
        return this._formatOutput('content4', "（" + result + "）");
      }
      return this._formatOutput('content4', result);
    } else {
      if (items.length > 1) {
        return "（" + result + "）";
      }
      return result;
    }
  }

  _findEndIndex(allRows, startIndex, col) {
    let j = startIndex + 1;
    while (j < allRows.length) {
      const nextRow = allRows[j];
      const val = nextRow[col] || "";

      this._recordSpecialSeparators(nextRow, j);

      if (this._isLogicSeparator(val)) {
        return j - 1;
      }

      j++;
    }

    return allRows.length - 1;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ExpCardConverter;
}
