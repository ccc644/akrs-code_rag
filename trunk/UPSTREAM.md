# 上游源码快照说明

`swe-agent/` 是 SWE-agent 的只读源码快照，用作 ARKS 智能助手的默认被分析项目。

- 上游仓库：https://github.com/SWE-agent/SWE-agent
- 快照提交：`3ea751c087f32b16e039a2233dd6eefecef325d5`
- 对应论文：*SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering*（NeurIPS 2024，CCF-A）
- 许可证：MIT，见 `swe-agent/LICENSE`
- 快照日期：2026-10-19

导入时保留了 `sweagent/`、`tests/`、`tools/`、`config/`、`docs/`、`assets/`、README、LICENSE 等源码与说明文件；未包含 `.git` 历史和 `trajectories/` 示例轨迹数据。目录内容保持只读，ARKS 智能助手不会修改或执行这些业务源码。
