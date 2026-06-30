/**
 * DCS Converter - Excel试验条件表转Markdown工具 (JS版本)
 */

class DCSConverter {
  constructor() {
    this.output = [];
    this.in_content_area = false;
    this.skip_section = false;
    this.current_sub_title_logic = null;
    this.processed_rows = new Set();
    this.special_separator_positions = new Set();
    this.item_counter = 0;

    // 逻辑运算符字典
    this.LOGIC_OPERATORS = {
      与: "且",
      且: "且",
      或: "或",
      或取反: "或取反",
    };

    // 特殊分隔符字典: 键为特殊分隔符的值, 值为转换后的默认逻辑分隔符
    this.SPECIAL_SEPARATORS = {
      '或延时': '或',
      '与延时': '与',
    };

    // 所有可能的逻辑分隔符
    this.LOGIC_SEPARATORS = Object.keys(this.LOGIC_OPERATORS);

    // 跳过的表头
    this.SKIP_HEADERS = ["序号", "条件确认"];

    // 段落标题
    this.SECTION_HEADERS = ["试验条件", "试验恢复", "结论", "存在问题"];
  }

  convert(rows) {
    this.output = [];
    this.in_content_area = false;
    this.skip_section = false;
    this.current_sub_title_logic = null;
    this.processed_rows = new Set();
    this.special_separator_positions = new Set();
    this.item_counter = 0;

    for (let i = 0; i < rows.length; i++) {
      if (this.processed_rows.has(i)) continue;
      this._process_row(rows[i], rows, i);
    }

    return this.output.join("\n");
  }

  _is_special_separator(text, rowIndex = null, colIndex = null) {
    if (!text) return null;
    
    // 遍历字典，检查文本是否以特殊分隔符开头
    for (const [key, value] of Object.entries(this.SPECIAL_SEPARATORS)) {
      if (text.startsWith(key)) {
        // 只有当行列号都是有效整数时才记录位置
        if (rowIndex !== null && colIndex !== null) {
          const row = parseInt(rowIndex);
          const col = parseInt(colIndex);
          if (!isNaN(row) && !isNaN(col)) {
            this.special_separator_positions.add([row, col]);
          }
        }
        // 返回转换后的逻辑分隔符
        return value;
      }
    }
    return null;
  }

  _process_row(row, all_rows, index) {
    const a = row[0] || "";
    const b = row[1] || "";
    const c = row[2] || "";

    if (!a && !b) return;
    if (this._is_header_row(row)) return;

    // 二级标题
    if (this._is_chinese_number_title(a)) {
      this.output.push("");
      this.output.push("## " + a);
      this.in_content_area = false;
      this.skip_section = false;
      return;
    }

    // 段落标题
    if (this.SECTION_HEADERS.includes(a)) {
      if (a === "试验条件") {
        this.skip_section = true;
      }
      this.in_content_area = false;
      return;
    }

    // 进入内容区域
    if (a === "试验内容") {
      this.in_content_area = true;
      this.skip_section = false;
      return;
    }

    if (this.skip_section) return;

    // 三级标题
    if (this._is_sub_title(a)) {
      const normalized = a.replace(/\(/g, "（").replace(/\)/g, "）");
      this.output.push("");
      this.output.push("### " + normalized);
      this.output.push("");
      this.current_sub_title_logic = this._extract_title_logic(normalized);
      return;
    }

    // 子列一级
    if (/^\d+$/.test(a) && !a.includes(".")) {
      this._process_level1(a, b, c, row, all_rows, index);
      return;
    }

    // 子列二级
    if (this._is_sub_item(a)) {
      this._process_level2(a, b, c, row, all_rows, index);
      return;
    }
  }

  _is_header_row(row) {
    const a = row[0] || "";
    const b = row[1] || "";
    if (this.SKIP_HEADERS.includes(a)) return true;
    if (a === "序号" && (b.includes("条件") || b.includes("内容"))) return true;
    return false;
  }

  _is_chinese_number_title(text) {
    return /^[一二三四五六七八九十]+、/.test(text);
  }

  _is_sub_title(text) {
    return /^\d+\.[\u4e00-\u9fa5]/.test(text);
  }

  _is_sub_item(text) {
    return /^\d+\.\d+$/.test(text);
  }

  _extract_title_logic(title) {
    const match = title.match(/[（(]([与或])[）)]/);
    return match ? match[1] : null;
  }

  _is_logic_separator(text) {
    return this.LOGIC_SEPARATORS.includes(text);
  }

  _get_logic_output(logic) {
    return this.LOGIC_OPERATORS[logic] || logic;
  }

  _get_content_from_row(row, start_col) {
    for (let i = start_col; i < row.length; i++) {
      const val = row[i];
      if (val && !this._is_logic_separator(val)) {
        return val;
      }
    }
    return null;
  }

  _process_level1(a, b, c, row, all_rows, index, useSeqNum = false) {
    // 先检测特殊分隔符，获取转换后的值
    let b_converted = b;
    if (b) {
      const special_result = this._is_special_separator(b, index, 1);
      if (special_result) {
        b_converted = special_result;
      }
    }

    let has_children = false;
    let child_logic = null;

    if (index + 1 < all_rows.length) {
      const next_a = all_rows[index + 1][0] || "";
      if (this._is_sub_item(next_a) && next_a.startsWith(a + ".")) {
        has_children = true;
        const next_b = all_rows[index + 1][1] || "";
        child_logic = this._is_logic_separator(next_b) ? next_b : null;
      }
    }

    let content = this._get_content_from_row(row, 1);
    if (!content) {
      content = b_converted && !this._is_logic_separator(b_converted) ? b_converted : "";
    }

    let logic_str = "";
    if (has_children && child_logic) {
      if (this._is_logic_separator(b_converted)) {
        if (b_converted !== this.current_sub_title_logic) {
          logic_str = "（" + b_converted + "）";
        }
      } else {
        logic_str = "（" + child_logic + "）";
      }
    }

    if (b_converted && b_converted.includes("或取反")) {
      logic_str = "（或取反）";
    }

    if (useSeqNum) {
      this.output.push(this.item_counter + ". " + content + logic_str);
    } else {
      this.output.push(a + ". " + content + logic_str);
    }
  }

  _process_level2(a, b, c, row, all_rows, index) {
    const b_val = b || "";
    const c_val = c || "";
    const d_val = row[3] || "";
    const e_val = row[4] || "";

    // 先检测特殊分隔符，获取转换后的值
    let b_converted = b_val;
    let c_converted = c_val;
    let d_converted = d_val;
    let e_converted = e_val;

    if (b_val) {
      const special = this._is_special_separator(b_val, index, 1);
      if (special) b_converted = special;
    }
    if (c_val) {
      const special = this._is_special_separator(c_val, index, 2);
      if (special) c_converted = special;
    }
    if (d_val) {
      const special = this._is_special_separator(d_val, index, 3);
      if (special) d_converted = special;
    }
    if (e_val) {
      const special = this._is_special_separator(e_val, index, 4);
      if (special) e_converted = special;
    }

    const b_is_logic = this._is_logic_separator(b_converted);
    const c_is_logic = this._is_logic_separator(c_converted);
    const d_is_logic = this._is_logic_separator(d_converted);

    // 情况1: C列和D列都是逻辑分隔符 → 三级条件处理
    if (c_is_logic && d_is_logic) {
      this._process_level3_group(a, c_converted, d_converted, e_converted, row, all_rows, index);
      return;
    }

    // 情况2: C列是逻辑分隔符，D列不是逻辑分隔符 → 二级分组
    if (c_is_logic && !d_is_logic) {
      this._process_level2_group(a, c_converted, d_converted, row, all_rows, index);
      return;
    }

    // 情况3: B列是逻辑分隔符
    if (b_is_logic) {
      if (c_converted && !c_is_logic) {
        this.output.push("   - " + c_converted);
        return;
      }
      return;
    }

    // 情况4: 简单输出
    let content = null;
    for (let col_idx = 1; col_idx < row.length; col_idx++) {
      const val = row[col_idx];
      if (val && !this._is_logic_separator(val)) {
        content = val;
        break;
      }
    }

    if (content) {
      this.output.push("   - " + content);
    }
  }

  _process_level3_group(
    a,
    c_logic,
    d_logic,
    first_content,
    row,
    all_rows,
    index,
  ) {
    const level3_groups = [];
    let current_group_items = first_content ? [first_content] : [];
    let current_d_logic = d_logic;

    let j = index + 1;
    while (j < all_rows.length) {
      const next_row = all_rows[j];
      const next_a = next_row[0] || "";

      if (
        this._is_sub_item(next_a) &&
        next_a.startsWith(a.split(".")[0] + ".")
      ) {
        const next_c = next_row[2] || "";
        const next_d = next_row[3] || "";
        const next_e = next_row[4] || "";

        if (this._is_logic_separator(next_c)) break;

        if (this._is_logic_separator(next_d)) {
          if (current_group_items.length > 0) {
            level3_groups.push([current_d_logic, [...current_group_items]]);
          }
          current_group_items = [];
          current_d_logic = next_d;
          if (next_e && !this._is_logic_separator(next_e)) {
            current_group_items.push(next_e);
            this.processed_rows.add(j);
          }
        } else if (next_d && !this._is_logic_separator(next_d)) {
          if (current_group_items.length > 0) {
            level3_groups.push([current_d_logic, [...current_group_items]]);
            current_group_items = [];
          }
          level3_groups.push([null, [next_d]]);
          this.processed_rows.add(j);
        } else if (next_e && !this._is_logic_separator(next_e)) {
          current_group_items.push(next_e);
          this.processed_rows.add(j);
        }
        j++;
      } else if (!next_a) {
        const next_c = next_row[2] || "";
        const next_d = next_row[3] || "";
        const next_e = next_row[4] || "";

        if (this._is_logic_separator(next_c)) break;

        if (this._is_logic_separator(next_d)) {
          if (current_group_items.length > 0) {
            level3_groups.push([current_d_logic, [...current_group_items]]);
          }
          current_group_items = [];
          current_d_logic = next_d;
          if (next_e && !this._is_logic_separator(next_e)) {
            current_group_items.push(next_e);
            this.processed_rows.add(j);
          }
        } else if (next_d && !this._is_logic_separator(next_d)) {
          if (current_group_items.length > 0) {
            level3_groups.push([current_d_logic, [...current_group_items]]);
            current_group_items = [];
          }
          level3_groups.push([null, [next_d]]);
          this.processed_rows.add(j);
        } else if (next_e && !this._is_logic_separator(next_e)) {
          current_group_items.push(next_e);
          this.processed_rows.add(j);
        }
        j++;
      } else {
        break;
      }
    }

    if (current_group_items.length > 0) {
      level3_groups.push([current_d_logic, current_group_items]);
    }

    if (level3_groups.length > 0) {
      const result_parts = [];
      for (const [logic, items] of level3_groups) {
        if (logic === null) {
          result_parts.push(items[0]);
        } else {
          const output_logic = this._get_logic_output(logic);
          const separator = " " + output_logic + " ";
          const group_str = items.join(separator);
          if (items.length > 1) {
            result_parts.push("（" + group_str + "）");
          } else {
            result_parts.push(group_str);
          }
        }
      }
      const result = result_parts.join(" 或 ");
      this.output.push("   - " + result);
    }
  }

  _process_level2_group(a, c_logic, first_content, row, all_rows, index) {
    const group_items = first_content ? [first_content] : [];
    const continuation_logic = c_logic;

    let j = index + 1;
    while (j < all_rows.length) {
      const next_row = all_rows[j];
      const next_a = next_row[0] || "";

      if (
        this._is_sub_item(next_a) &&
        next_a.startsWith(a.split(".")[0] + ".")
      ) {
        const next_c = next_row[2] || "";
        const next_d = next_row[3] || "";

        if (this._is_logic_separator(next_c)) break;
        if (this._is_logic_separator(next_d)) break;

        let next_content = null;
        for (let col_idx = 2; col_idx < next_row.length; col_idx++) {
          const val = next_row[col_idx];
          if (val && !this._is_logic_separator(val)) {
            next_content = val;
            break;
          }
        }

        if (next_content) {
          group_items.push(next_content);
          this.processed_rows.add(j);
        }
        j++;
      } else if (!next_a) {
        const next_c = next_row[2] || "";
        const next_d = next_row[3] || "";

        if (this._is_logic_separator(next_c)) break;
        if (this._is_logic_separator(next_d)) break;

        let next_content = null;
        for (let col_idx = 2; col_idx < next_row.length; col_idx++) {
          const val = next_row[col_idx];
          if (val && !this._is_logic_separator(val)) {
            next_content = val;
            break;
          }
        }

        if (next_content) {
          group_items.push(next_content);
          this.processed_rows.add(j);
        }
        j++;
      } else {
        break;
      }
    }

    if (group_items.length > 1) {
      let result = group_items[0];
      const output_logic = this._get_logic_output(continuation_logic);
      const separator = " " + output_logic + " ";
      for (let i = 1; i < group_items.length; i++) {
        result = result + separator + group_items[i];
      }
      this.output.push("   - " + result);
    } else if (group_items.length > 0) {
      this.output.push("   - " + group_items[0]);
    }
  }

  // ==================== New Mode Methods ====================

  convertNew(rows) {
    this.output = [];
    this.in_content_area = false;
    this.skip_section = false;
    this.current_sub_title_logic = null;
    this.processed_rows = new Set();
    this.special_separator_positions = new Set();
    this.item_counter = 0;

    for (let i = 0; i < rows.length; i++) {
      if (this.processed_rows.has(i)) continue;
      this._processNewRow(rows[i], rows, i);
    }

    return this.output.join("\n");
  }

  _processNewRow(row, all_rows, index) {
    const a = row[0] || "";
    const b = row[1] || "";

    if (!a && !b) return;
    if (this._is_header_row(row)) return;

    // 二级标题
    if (this._is_chinese_number_title(a)) {
      this.output.push("");
      this.output.push("## " + a);
      this.in_content_area = false;
      this.skip_section = false;
      return;
    }

    // 段落标题
    if (this.SECTION_HEADERS.includes(a)) {
      if (a === "试验条件") {
        this.skip_section = true;
      }
      this.in_content_area = false;
      return;
    }

    // 进入内容区域
    if (a === "试验内容") {
      this.in_content_area = true;
      this.skip_section = false;
      return;
    }

    if (this.skip_section) return;

    // 三级标题
    if (this._is_sub_title(a)) {
      const normalized = a.replace(/\(/g, "（").replace(/\)/g, "）");
      this.output.push("");
      this.output.push("### " + normalized);
      this.output.push("");
      this.current_sub_title_logic = this._extract_title_logic(normalized);
      this.item_counter = 0;
      return;
    }

    // 纯数字序号 → 新模式处理
    if (/^\d+$/.test(a)) {
      this._processNewItem(a, row, all_rows, index);
      return;
    }
  }

  _processNewItem(a, row, all_rows, index) {
    const b = row[1] || "";
    const c = row[2] || "";

    // 先检测特殊分隔符，获取转换后的值
    let b_converted = b;
    let c_converted = c;
    if (b) {
      const special = this._is_special_separator(b, index, 1);
      if (special) b_converted = special;
    }
    if (c) {
      const special = this._is_special_separator(c, index, 2);
      if (special) c_converted = special;
    }

    // 检测下一行A列是否是x.y格式
    if (index + 1 < all_rows.length) {
      const next_a = all_rows[index + 1][0] || "";
      if (this._is_sub_item(next_a)) {
        // 下一行是x.y格式 → old模式处理
        this.item_counter += 1;
        this._process_level1(a, b_converted, c_converted, row, all_rows, index, true);
        // 处理所有x.y子项
        let j = index + 1;
        while (j < all_rows.length) {
          if (this.processed_rows.has(j)) {
            j++;
            continue;
          }
          const next_row = all_rows[j];
          const next_a_val = next_row[0] || "";
          if (this._is_sub_item(next_a_val) && next_a_val.startsWith(a + ".")) {
            this._process_level2(
              next_a_val,
              next_row[1] || "",
              next_row[2] || "",
              next_row,
              all_rows,
              j,
            );
            this.processed_rows.add(j);
            j++;
          } else {
            break;
          }
        }
        return;
      }
    }

    // 下一行不是x.y格式 → new模式执行检测
    const b_is_logic = this._is_logic_separator(b_converted);

    // B列不是逻辑 → 一级（直接输出）
    if (!b_is_logic) {
      const content = b_converted || "";
      this.item_counter += 1;
      this.output.push(this.item_counter + ". " + content);
      return;
    }

    // B列是逻辑 → 进入二级处理
    this.item_counter += 1;
    const result = this._processNewLevel2(
      this.item_counter,
      b_converted,
      row,
      all_rows,
      index,
    );
    this.output.push(this.item_counter + ". " + result);
  }

  _processNewLevel2(itemNum, b_logic, row, all_rows, index) {
    const c = row[2] || "";

    // 先检测特殊分隔符，获取转换后的值
    let c_converted = c;
    if (c) {
      const special = this._is_special_separator(c, index, 2);
      if (special) c_converted = special;
    }

    const c_is_logic = this._is_logic_separator(c_converted);

    // 确定二级遍历范围
    const endIndex = this._findEndIndex(all_rows, index, 1);

    const items = [];
    let j = index;
    while (j <= endIndex) {
      if (j >= all_rows.length) break;
      const next_row = all_rows[j];
      const next_c = next_row[2] || "";

      // 先检测特殊分隔符，获取转换后的值
      let next_c_converted = next_c;
      if (next_c) {
        const special = this._is_special_separator(next_c, j, 2);
        if (special) next_c_converted = special;
      }

      if (j === index) {
        // 当前行：C列是逻辑 → 三级处理
        if (c_is_logic) {
          const level3Result = this._processNewLevel3(
            itemNum,
            c_converted,
            next_row,
            all_rows,
            j,
          );
          items.push(level3Result);
        } else if (c_converted) {
          items.push(c_converted);
        }
      } else {
        // 后续行：C列是逻辑 → 三级处理
        if (this._is_logic_separator(next_c_converted)) {
          const level3Result = this._processNewLevel3(
            itemNum,
            next_c_converted,
            next_row,
            all_rows,
            j,
          );
          items.push(level3Result);
          this.processed_rows.add(j);
        } else if (next_c_converted) {
          items.push(next_c_converted);
          this.processed_rows.add(j);
        }
      }

      j++;
    }

    // 用B列逻辑连接所有项目
    const output_logic = this._get_logic_output(b_logic);
    const separator = " " + output_logic + " ";
    return items.join(separator);
  }

  _processNewLevel3(itemNum, c_logic, row, all_rows, index) {
    const d = row[3] || "";

    // 先检测特殊分隔符，获取转换后的值
    let d_converted = d;
    if (d) {
      const special = this._is_special_separator(d, index, 3);
      if (special) d_converted = special;
    }

    const d_is_logic = this._is_logic_separator(d_converted);

    // 确定三级遍历范围
    const endIndex = this._findEndIndex(all_rows, index, 2);

    const items = [];
    let j = index;
    while (j <= endIndex) {
      if (j >= all_rows.length) break;
      const next_row = all_rows[j];
      const next_d = next_row[3] || "";

      // 先检测特殊分隔符，获取转换后的值
      let next_d_converted = next_d;
      if (next_d) {
        const special = this._is_special_separator(next_d, j, 3);
        if (special) next_d_converted = special;
      }

      if (j === index) {
        // 当前行：D列是逻辑 → 四级处理
        if (d_is_logic) {
          const level4Result = this._processNewLevel4(
            itemNum,
            d_converted,
            next_row,
            all_rows,
            j,
          );
          items.push(level4Result);
        } else if (d_converted) {
          items.push(d_converted);
        }
      } else {
        // 后续行：D列是逻辑 → 四级处理
        if (this._is_logic_separator(next_d_converted)) {
          const level4Result = this._processNewLevel4(
            itemNum,
            next_d_converted,
            next_row,
            all_rows,
            j,
          );
          items.push(level4Result);
          this.processed_rows.add(j);
        } else if (next_d_converted) {
          items.push(next_d_converted);
          this.processed_rows.add(j);
        }
      }

      j++;
    }

    // 用C列逻辑连接，三层输出用（）包裹
    const output_logic = this._get_logic_output(c_logic);
    const separator = " " + output_logic + " ";
    const result = items.join(separator);
    if (items.length > 1) {
      return "（" + result + "）";
    }
    return result;
  }

  _processNewLevel4(itemNum, d_logic, row, all_rows, index) {
    const e = row[4] || "";

    // 先检测特殊分隔符，获取转换后的值
    let e_converted = e;
    if (e) {
      const special = this._is_special_separator(e, index, 4);
      if (special) e_converted = special;
    }

    // 确定四级遍历范围
    const endIndex = this._findEndIndex(all_rows, index, 3);

    const items = [];
    let j = index;
    while (j <= endIndex) {
      if (j >= all_rows.length) break;
      const next_row = all_rows[j];
      const next_e = next_row[4] || "";

      // 先检测特殊分隔符，获取转换后的值
      let next_e_converted = next_e;
      if (next_e) {
        const special = this._is_special_separator(next_e, j, 4);
        if (special) next_e_converted = special;
      }

      if (j === index) {
        // 当前行：E列内容
        if (e_converted && !this._is_logic_separator(e_converted)) {
          items.push(e_converted);
        }
      } else {
        // 后续行：E列内容
        if (next_e_converted && !this._is_logic_separator(next_e_converted)) {
          items.push(next_e_converted);
          this.processed_rows.add(j);
        }
      }

      j++;
    }

    // 用D列逻辑连接，四层输出用（）包裹
    const output_logic = this._get_logic_output(d_logic);
    const separator = " " + output_logic + " ";
    const result = items.join(separator);
    if (items.length > 1) {
      return "（" + result + "）";
    }
    return result;
  }

  _findEndIndex(all_rows, startIndex, col) {
    let j = startIndex + 1;
    while (j < all_rows.length) {
      const next_row = all_rows[j];
      const val = next_row[col] || "";

      // 遇到逻辑分隔符 → 结束
      if (this._is_logic_separator(val)) {
        return j - 1;
      }

      j++;
    }

    return all_rows.length - 1;
  }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
  module.exports = DCSConverter;
}
