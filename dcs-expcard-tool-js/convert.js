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

    // 逻辑运算符字典
    this.LOGIC_OPERATORS = {
      与: "且",
      且: "且",
      或: "或",
      或取反: "异或",
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

    for (let i = 0; i < rows.length; i++) {
      if (this.processed_rows.has(i)) continue;
      this._process_row(rows[i], rows, i);
    }

    return this.output.join("\n");
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
    return /^\d+[\u4e00-\u9fa5]/.test(text);
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

  _process_level1(a, b, c, row, all_rows, index) {
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
      content = b && !this._is_logic_separator(b) ? b : "";
    }

    let logic_str = "";
    if (has_children && child_logic) {
      if (this._is_logic_separator(b)) {
        if (b !== this.current_sub_title_logic) {
          logic_str = "（" + b + "）";
        }
      } else {
        logic_str = "（" + child_logic + "）";
      }
    }

    if (b && b.includes("或取反")) {
      logic_str = "（或取反）";
    }

    this.output.push(a + ". " + content + logic_str);
  }

  _process_level2(a, b, c, row, all_rows, index) {
    const b_val = b || "";
    const c_val = c || "";
    const d_val = row[3] || "";
    const e_val = row[4] || "";

    const b_is_logic = this._is_logic_separator(b_val);
    const c_is_logic = this._is_logic_separator(c_val);
    const d_is_logic = this._is_logic_separator(d_val);

    // 情况1: C列和D列都是逻辑分隔符 → 三级条件处理
    if (c_is_logic && d_is_logic) {
      this._process_level3_group(a, c_val, d_val, e_val, row, all_rows, index);
      return;
    }

    // 情况2: C列是逻辑分隔符，D列不是逻辑分隔符 → 二级分组
    if (c_is_logic && !d_is_logic) {
      this._process_level2_group(a, c_val, d_val, row, all_rows, index);
      return;
    }

    // 情况3: B列是逻辑分隔符
    if (b_is_logic) {
      if (c_val && !c_is_logic) {
        this.output.push("   - " + c_val);
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
}

// 导出
if (typeof module !== "undefined" && module.exports) {
  module.exports = DCSConverter;
}
