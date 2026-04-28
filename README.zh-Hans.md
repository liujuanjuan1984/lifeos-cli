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

## 为什么做它

大多数个人系统会把生活拆散到多个互不相通的工具里。任务在一个地方，日程在另一个地方，笔记在别处，
实际投入的时间又散落在各种零碎记录里。

这会让一些本来很实际的问题变得很难回答：

- 我原本打算做什么？
- 实际上发生了什么？
- 我的时间到底花在了哪里？
- 哪些习惯是真正活出来的，哪些只是停留在愿望里？
- 我真正服务的是哪些人、哪些项目、哪些优先级？

它同时为生活的两侧提供结构：

- intention：visions、tasks、habits、planned events
- reality：notes、timelogs、completed habit actions、relationship records

目标不只是存储数据，而是为自我管理、复盘反思和自动化提供同一套 CLI 接口。

## 快速开始

从 PyPI 安装或升级：

```bash
uv tool install --upgrade lifeos-cli
```

只有在需要 PostgreSQL 支持时，再安装对应可选依赖：

```bash
uv tool install --upgrade "lifeos-cli[postgres]"
```

`lifeos-cli` 当前正式支持 SQLite 和 PostgreSQL。

- SQLite 适合本地、单用户、低门槛使用场景。
- PostgreSQL 仍然是支持 schema 的部署型后端。

初始化本地环境：

```bash
lifeos init
```

如果当前还没有配置数据库 URL，`lifeos init` 默认会使用位于 `~/.lifeos/lifeos.db` 的本地 SQLite 数据库。

这一步既可以由人类自己执行，也可以交给能执行终端命令的 agent 来代为完成。

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

常用命令：

```bash
lifeos schedule show --date 2026-04-13
lifeos task list
lifeos note add "Capture today's key decisions"
lifeos timelog list --date 2026-04-13
```

完整的 CLI 用法、工作流和输出约定，请参考 [docs/cli.md](docs/cli.md)。

## Agent 使用（推荐）

任意能够执行终端命令并读取命令输出的 agent runtime 都可以操作同一套 CLI。
这包括但不限于 Codex、OpenCode、Swival、Claude Code、Cursor、Gemini CLI、OpenClaw，
以及你自己的自定义 agent runtime。

- 稳定的命令语法：`lifeos <resource> <action> [arguments] [options]`
- 以 `--help` 作为主命令参考的 help-first 模型
- 围绕 `list` 和 `show` 构建的 identifier-driven 发现流程
- 面向列表的紧凑摘要输出，以及面向详情的标注字段输出
- 使用 `task_id`、`vision_id`、`event_id` 等实体化主键列表头

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

## 项目策略

- 贡献流程：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全披露：[SECURITY.md](SECURITY.md)
- 社区行为规范：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## 许可证

本项目使用 Apache License 2.0。详见 [LICENSE](LICENSE)。
