# GRPO Reward v1.0 讨论纪要（工具重复调用 & 参数错误）

时间：2025-12-19  
范围：`tasks/getZhiWeiChatHistory` 数据集（以“首次创建项目/从零生成”为主）

## 1. 目标与约束

### 目标
- 定义一个 **Reward v1.0**（episode 级），用于 GRPO 训练。
- v1.0 的首要优化方向：
  - 减少 **工具重复调用**（相邻两次 `name+args` 完全相同）。
  - 减少 **工具参数错误**（schema 缺参、类型错误、约束错误、路径/文件类型类错误等）。
- 同时允许使用“编译通过”作为压倒性终局奖励。

### 约束/共识
- 本次讨论 **不做 agent/环境优化**；把工具与运行时当作固定环境。
- v1.0 暂不做“不同工具不同权重”的区分（后续在二次修改/增量场景再考虑）。
- 可用信号（训练侧可观测）：
  - 完整对话轨迹（含 tool calls、args、tool responses）。
  - `record_prompt_result`：模型主观认为任务完成的标记。
  - 编译通过/失败：可作为终局标签。
- `OpenAI timeout/500` 等外部不稳定错误 **忽略**（不应被当作模型策略错误）。

## 2. 为什么不使用常数 K 限制 `record_prompt_result` 之前的步数

最初为避免 reward hacking（失败样本里模型可能通过“少做事/立刻结束”获得更高分），考虑过对 “compile_fail 且过早结束” 加惩罚项。

但由于 prompt 工作量不确定，用固定步数阈值 K 不稳，可能误伤真实的短任务或纵容长任务的早停。

最终改为 **与工作量无关** 的判据：只要 episode 内从未进行任何“写入尝试”，就惩罚（见 `Wattempt==0` 项）。

## 3. 术语与统计定义（episode 级）

### 3.1 基础
- `compile_pass (C)`：是否编译通过，`C∈{0,1}`。
- `N`：工具调用总数（**不包含** `record_prompt_result`）。
- `SN`：工具参数传递无错误的次数（基于 tool response 统计，**不包含** `record_prompt_result`）。

### 3.2 工具重复调用
- `Rrep`：相邻两次 tool call 的 `name + canon(args)` 完全相同的次数。
  - `canon(args)`：对 JSON 参数做深度键排序后序列化（保证键顺序不同也视为相同）。

### 3.3 参数错误（模型侧）
- `Eparam`：参数错误次数，包含但不限于：
  - schema 缺必填字段（如 `params must have required property ...`）
  - schema 类型错误 / enum 错误
  - `todo_write` 相关约束错误（如 `id` 重复、`content` 为空、`status` 非法等）
  - 路径/文件类型类错误（如 `File not found`、`Path is a directory, not a file` 等）

### 3.4 语法/校验失败（高优先级）
- `Esyntax`：语法/校验失败次数（例如 `write_file` 写入内容触发校验返回 “文件语法存在错误…” 等）。
  - 讨论结论：这类错误与“最终编译不过”在训练目标上高度同向，因此权重要更高。

### 3.5 无效工具调用
- `Einvalid`：调用了 **不在该 episode allowed tools 列表中** 的工具次数。

### 3.6 写入尝试
- `Wattempt`：episode 内是否至少调用过一次“写入类工具”，如：
  - `write_file` / `write_file_with_check` / `ot_write_file`
  - 仅要求“发生过调用”，不要求成功。

### 3.7 Episode 截断口径（避免把评测/后处理算进策略）
- 若轨迹中出现 `record_prompt_result`：
  - 建议将 episode 的“策略区间”截断为 **从开始到第一次 `record_prompt_result`（含该次 tool call/response）**。
  - `N/Rrep/E*` 等统计均在该截断区间内计算（并继续保持“不把 `record_prompt_result` 计入 N”的规则）。
- 若轨迹中没有 `record_prompt_result`：使用整段轨迹作为 episode。

### 3.8 allowed tools 的来源（用于区分模型错误 vs 环境错误）
- `allowed tools 列表`以“轨迹里记录的工具白名单”为准（你提到的“对话轨迹中的 tools”字段）。
- `Einvalid/Tool not found` 的判定必须依赖该列表；如果某条轨迹缺失 allowed tools 列表：
  - 建议：对包含 `Tool not found` 的轨迹直接丢弃（避免误惩罚模型）。
  - 对不包含 `Tool not found` 的轨迹，可继续计算 reward（`Einvalid` 置 0）。

## 4. Tool not found / OpenAI 错误处理约定

### 4.1 OpenAI 错误
- `OpenAI timeout/500`：忽略或直接丢弃 episode（不计入 `N/Eparam/Esyntax/Einvalid`）。

### 4.2 Tool not found
- 如果工具 **不在 allowed tools 列表**：计入 `Einvalid`（模型问题）。
- 如果工具 **在 allowed tools 列表** 但 registry 缺失：
  - 视为环境/agent 问题，**建议丢弃该 episode**（避免错误惩罚模型）。

## 5. Reward v1.0（最终结论）

### 5.1 主公式
设 `C=I(compile_pass)`，则：

```
reward =
  + 10.0 * C (编译通过)
  - 0.05 * N (工具调用次数)
  + 0.02 * SN (工具参数传递无错误)
  - 2.00 * Rrep (相邻两次重复调用)
  - 3.00 * Eparam (参数错误次数)
  - 5.00 * Esyntax (语法校验失败)
  - 8.00 * Einvalid (调用了 tools 中不存在的工具)
  - 5.00 * I(Wattempt == 0) (至少调用了一次写入，避免直接调用 record)
  + (doRecord?1:-1)(判断是否调用了 record_result_prompt)
```

当前分析**不做裁剪**（clip 关闭）。如需稳定尺度，可在训练阶段再考虑启用 `reward = clip(reward, -10, +10)`。

### 5.2 权重讨论结果
- `+10`：编译通过的压倒性终局奖励（先用 10 作为 v1 起点）。
- `-0.05 * N`：每次工具调用的小成本（压制“无意义多调用/拖回合”）。
- `+0.02 * SN`：工具参数传递无错误的正向激励（鼓励“参数正确+调用成功”的行为）。
- `Rrep` 权重 `2.0`：显著抑制相邻重复调用。
- `Eparam` 权重 `3.0`：参数类错误的高惩罚（覆盖 schema 缺参/类型错/约束错/路径类错误等）。
- `Esyntax` 权重 `5.0`：语法/校验失败的高惩罚（优先让模型“写对语法”）。
- `Einvalid` 权重 `8.0`：调用不在 allowed tools 列表的工具属于严重违规。
- `I(Wattempt==0)` 惩罚 `5.0`：替代常数 K，防止失败样本里“立刻结束”成为最优策略。
- `clip(-10, +10)`：可选项，当前分析不启用；仅在训练不稳定或分布拉长时再启用。

### 5.3 计数去重与分类约定（避免重复惩罚）
- 对于每一次工具返回的错误，**只计入一个桶**：
  - OpenAI/网络/服务不稳定类：忽略或丢弃 episode（不计入任何桶）
  - 工具不在 allowed tools：计入 `Einvalid`
  - 语法/校验失败类：计入 `Esyntax`
  - 其余可视作“参数/约束”问题：计入 `Eparam`

### 5.4 错误桶的可操作判定规则（v1.0 推荐）
- `Esyntax`（优先匹配）：`response.error`（或等价字段）包含关键前缀/片段：
  - `文件语法存在错误`
- `Eparam`：不属于 `Esyntax` 且工具在 allowed tools 内，但出现下列典型错误（示例，不限于此）：
  - `params must have required property`
  - `Parameter "todos" must be an array.`
  - `Todo IDs must be unique`
  - `Each todo must have a non-empty`
  - `File not found`
  - `Path is a directory`
- `Einvalid`：`tool_name ∉ allowed_tools`
- `Tool not found`：
  - 若 `tool_name ∉ allowed_tools`：按 `Einvalid`
  - 若 `tool_name ∈ allowed_tools`：按“环境问题”丢弃 episode（不计入任何桶）

## 6. 实现建议（保证可复现）
- 统计 `Rrep` 时务必对 `args` 做 canonical（深度排序 + JSON stringify）。
- 统计 `N` 时不包含 `record_prompt_result`，避免模型因“宣告完成”本身被惩罚。
- 每个 episode 输出一份调试指标（便于后续调权）：
  - `C, N, SN, Rrep, Eparam, Esyntax, Einvalid, Wattempt`
- 后续调参优先级建议：
  1) 若仍大量 loop：提升 `Rrep`（0.5→1.0），或只对“上一步报错后的重复”再加额外惩罚（v2 考虑）。
  2) 若大量 schema 缺参：提升 `Eparam`，并细分缺参/类型错/约束错（v2 考虑）。
  3) 若大量语法失败：提升 `Esyntax` 或增加“校验失败后仍重复写同内容”的额外惩罚（v2 考虑）。
