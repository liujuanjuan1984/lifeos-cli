# lifeos-cli

English: [README.md](README.md)

```text
 _      ___   _____  _____   ___    ____
| |    |_ _| |  ___|| ____| / _ \  / ___|
| |     | |  | |_   |  _|  | | | | \___ \
| |___  | |  |  _|  | |___ | |_| |  ___) |
|_____||___| |_|    |_____| \___/  |____/
```

`lifeos-cli` 是一个终端原生的 LifeOS，面向希望用同一个结构化系统管理意图、计划、执行、复盘与现实的人。

你既可以把它当作适合人类直接使用的 CLI，也可以让任意足够能力的 agent 通过同一套命令面来操作它。

这包括但不限于 Codex、OpenCode、Swival、Claude Code、Cursor、Gemini CLI、OpenClaw，
以及你自己的自定义 agent runtime。只要它能够执行终端命令并读取命令输出，就能消费这套接口。

## 为什么做它

大多数个人系统会把生活拆散到多个互不相通的工具里。任务在一个地方，日程在另一个地方，笔记在别处，
实际投入的时间又散落在各种零碎记录里。

这会让一些本来很实际的问题变得很难回答：

- 我原本打算做什么？
- 实际上发生了什么？
- 我的时间到底花在了哪里？
- 哪些习惯是真正活出来的，哪些只是停留在愿望里？
- 我真正服务的是哪些人、哪些项目、哪些优先级？

`lifeos-cli` 把这些问题当作同一个系统问题来处理。

它同时为生活的两侧提供结构：

- intention：visions、tasks、habits、planned events
- reality：notes、timelogs、completed habit actions、relationship records

目标不只是存储数据，而是为自我管理、复盘反思和自动化提供同一个共享操作接口。

## 你可以自己用，也可以让任意 Agent 来用

`lifeos-cli` 从一开始就面向两种同等重要的工作方式：

- 人类直接在终端中使用
- 由 agent 通过稳定 CLI 命令面来调用

人类可以直接用它查看计划、记录现实、维护个人上下文：

```bash
lifeos schedule show --date 2026-04-13
lifeos task list
lifeos note add "Capture today's key decisions"
lifeos timelog list --date 2026-04-13
```

agent 也可以使用完全相同的接口来发现标识符、检查当前状态并执行更新，而不需要额外的内嵌 agent API。

这使它适合：

- 终端优先的个人自我管理
- AI 辅助的每日计划与复盘
- 需要结构化个人上下文的 coding-agent 工作流
- 基于持久化个人数据而不是零散文本文件的自动化流程

## 为什么 Agent 适合消费这套 CLI

这套命令面是刻意为“人类可读、agent 可用”设计的：

- 稳定的命令语法：`lifeos <resource> <action> [arguments] [options]`
- 以 `--help` 作为主命令参考的 help-first 模型
- 围绕 `list` 和 `show` 构建的 identifier-driven 发现流程
- 面向列表的紧凑摘要输出，以及面向详情的标注字段输出
- 使用 `task_id`、`vision_id`、`event_id` 等实体化主键列表头
- 支持本地化 help，并显式建模 language 与时间偏好
- 不区分“人类界面”和“agent API”，而是统一到同一个共享 CLI 接口

## 当前范围

当前系统已经覆盖一个实用 LifeOS 的核心积木：

- notes
- areas
- tags
- people
- visions
- tasks
- habits and habit actions
- events
- timelogs

当前还具备这些跨模块能力：

- 一个 `schedule` 读模型，可把 tasks、habit actions 和 planned events 聚合成按天或按区间查看的视图
- recurring events 的展开能力，以及 recurring habits 的 cadence 支持，包括按需生成的 habit-action
- 跨 tasks、visions、events、people、timelogs、tags 的通用 note associations
- 持久化的运行时配置，既覆盖 database 连接，也覆盖 timezone、language、day boundary、week boundary 和 vision experience defaults 等偏好
- 本地化的 CLI help，以及适合人类直用和 agent 消费的稳定摘要表输出

## 快速开始

从 PyPI 安装：

```bash
uv tool install lifeos-cli
```

`lifeos-cli` 当前默认采用 PostgreSQL 作为数据库后端。

初始化本地环境：

```bash
lifeos init
```

这一步既可以由人类自己执行，也可以交给能够执行终端命令并读取命令输出的 agent 来代为完成本地初始化。

查看 CLI 命令面：

```bash
lifeos --help
```

查看并调整运行时偏好：

```bash
lifeos config show
lifeos config set preferences.timezone America/Toronto
lifeos config set preferences.language zh-Hans
```

完整的 CLI 用法、工作流和输出约定，请参考 [docs/cli.md](docs/cli.md)。

## 项目策略

- 贡献流程：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全披露：[SECURITY.md](SECURITY.md)
- 社区行为规范：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 依赖更新策略：针对 `uv` 保持单个每周分组 version-update PR
- 依赖健康基线：`bash ./scripts/dependency_health.sh`

贡献者环境搭建、校验入口、integration tests 以及依赖维护流程，以
[CONTRIBUTING.md](CONTRIBUTING.md) 作为唯一开发指南。

## 许可证

本项目使用 Apache License 2.0。详见 [LICENSE](LICENSE)。
