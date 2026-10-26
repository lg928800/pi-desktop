# P0 可行性验证结果

- 时间：2026-10-26T08:13:26.437Z
- 总耗时：24249 ms，收到协议记录 199 条
- 事件类型：agent_end, agent_settled, agent_start, message_end, message_start, message_update, tool_execution_end, tool_execution_start, tool_execution_update, turn_end, turn_start

| 项 | 结果 | 说明 |
| --- | --- | --- |
| A 切帧（含 U+2028/U+2029） | PASS | LF 切分正确，行分隔符未误切 |
| A2 逐字节分片重组 | PASS | 27 字节分片，得到 1 条 |
| B 流式 + 权威消息 + agent_settled | PASS | delta 拼接 2 字 / message_end 2 字 / 5298ms |
| C 多模态（images 字段） | PASS | 红色 / 6931ms |
| D 审批链路（tool_call → confirm → 放行） | PASS | gate 命中 1 次 / 命令输出可见 true / UI 请求 3 个 / 12016ms |
| E get_state / get_available_models | PASS | model=zai-lan/glm-5.3-flash / 可选模型 11 个（其中支持图片 5 个） |

## 说明

- 本目录（spike/）是验证脚本，结论产出后即可删除或归档。
