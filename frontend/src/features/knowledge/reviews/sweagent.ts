import type { SourceGuide } from '../sourceGuides';
import { flow, step } from './builders.ts';

// 每条说明对应 SWE-agent 快照中已人工选定的源码范围；只描述入口、循环和工具边界，
// 不推断模型回答质量或容器内命令的运行时结果。
export const sweAgentGuide: SourceGuide = {
  id: 'sweagent-architecture',
  topic: 'architecture',
  diagrams: [],
  title: 'SWE-agent 运行入口与 Agent 循环',
  flows: [
    flow(
      'cli-entry',
      '命令行入口与实例运行',
      '从 __main__ 到 RunSingle.run：入口只解析命令并延迟导入子命令，单实例运行负责启动环境、调用 Agent 并保存预测结果。',
      ['entry', 'cli-main', 'run-single-config', 'run-single-run'],
      [
        step(
          'main',
          '模块入口',
          '__main__ 只从 sweagent.run.run 导入 main，并在直接执行时调用；没有额外的初始化逻辑。',
          ['entry'],
        ),
        step(
          'dispatch',
          '命令分发',
          'main 用命令行解析器读取 command；run 分支延迟导入 run_single，run-batch 分支导入 run_batch，避免启动时加载全部子命令。',
          ['cli-main'],
        ),
        step(
          'config',
          '构造运行对象',
          'RunSingle.from_config 先加载环境变量并确定输出目录，再按配置创建 Agent 与 SWEEnv，并注册保存补丁的 Hook。',
          ['run-single-config'],
        ),
        step(
          'run',
          '启动环境并执行',
          'RunSingle.run 启动环境，调用 agent.run，完成回调后保存 predictions 并关闭环境。',
          ['run-single-run'],
        ),
      ],
    ),
    flow(
      'agent-loop',
      'Agent 步进循环',
      'DefaultAgent.run 先完成 setup，然后反复调用 step，直到 StepOutput.done 为真。',
      ['agent-step', 'agent-loop'],
      [
        step(
          'step',
          '单步执行',
          'step 调用 forward_with_handling 得到 StepOutput，再更新消息历史、trajectory、submission、exit_status 和编辑文件上下文。',
          ['agent-step'],
        ),
        step(
          'loop',
          '循环直到结束',
          'run 在 while not step_output.done 中反复 step 并保存 trajectory；循环结束后从轨迹读取全局信息并返回 AgentRunResult。',
          ['agent-loop'],
          [
            {
              label: '结束条件',
              text: '循环只看 StepOutput.done；本说明未展开 done 的具体来源和模型输出解析。',
              refs: ['agent-loop'],
            },
          ],
        ),
      ],
    ),
    flow(
      'tool-boundary',
      '工具安装与动作边界',
      'ToolHandler 负责安装工具、重置环境、判断命令是否应被阻断，并把模型输出解析成动作。',
      ['tools-install', 'tools-block', 'tools-parse'],
      [
        step(
          'install',
          '安装与重置',
          'install 先执行 _install_commands，再 reset；reset 写入环境变量与 /root/.swe-agent-env、/root/state.json，然后执行重置命令。',
          ['tools-install'],
        ),
        step(
          'block',
          '阻断危险动作',
          'should_block_action 依据 blocklist、blocklist_standalone 和 block_unless_regex 判断是否阻断；空动作直接返回不阻断。',
          ['tools-block'],
        ),
        step(
          'parse',
          '解析模型输出',
          'parse_actions 直接委托 config.parse_function，把模型输出解析成 thought 和 action 两项。',
          ['tools-parse'],
        ),
      ],
    ),
  ],
  boundaries: [
    {
      text: '本说明只覆盖入口、单实例运行、Agent 循环和工具边界；模型后端、环境实现和批处理路径不在本次范围内。',
      refs: ['cli-main', 'agent-loop'],
    },
    {
      text: '说明来自静态阅读。ARKS 助手不会执行 trunk 中的业务代码，不能据此推断运行结果或回答质量。',
      refs: ['agent-loop', 'tools-install'],
    },
    {
      text: '工具命令的实际执行发生在 SWEEnv 环境中；本说明只核对安装、阻断和解析调用，不证明具体命令的运行时效果。',
      refs: ['tools-install', 'tools-block'],
    },
  ],
};
