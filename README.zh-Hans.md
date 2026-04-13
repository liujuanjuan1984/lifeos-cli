# lifeos-cli

English: [README.md](README.md)

`lifeos-cli` 是一个以 CLI 为核心的 LifeOS：既适合人类直接使用，也适合 agent 自动化调用，
用于承载连接“意图”和“现实”的结构化数字生活数据。

## 价值主张

大多数个人系统会把生活拆散到多个互不相通的工具里，因此很难回答这些关键问题：

- 我原本打算做什么？
- 实际上发生了什么？
- 我的时间和精力究竟流向了哪里？
- 我真正活出来的关系、习惯和优先级是什么？

`lifeos-cli` 把这些问题当作同一个系统问题来处理。它同时为生活的两侧提供结构：

- intention：visions、tasks、habits、planned events
- reality：notes、timelogs、completed habit actions、relationship records

目标不只是存储个人数据，而是让自我管理、复盘反思和自动化都建立在同一个可持续的事实源之上。

## 为什么是 CLI

CLI 是统一接口。人可以直接使用它，现有 agent 也可以调用同一套命令，而不需要额外再嵌入一层
agent 专用接口。

## 当前范围

当前系统已经覆盖 LifeOS 的核心积木：

- notes
- areas
- tags
- people
- visions
- tasks
- habits and habit actions
- events
- timelogs

这些模块已经覆盖了“什么重要、计划了什么、正在执行什么、实际发生了什么”这条主链路。

当前还具备这些跨模块能力：

- 一个 `schedule` 读模型，可把 tasks、habit actions 和 planned events 聚合成按天或按区间查看的视图
- recurring events 的展开能力，以及 recurring habits 的 cadence 支持，包括按需生成的 habit-action
- 跨 tasks、visions、events、people、timelogs、tags 的通用 note associations
- 持久化的运行时配置，既覆盖 database 连接，也覆盖 timezone、language、day boundary、week boundary 和 vision experience defaults 等偏好
- 本地化的 CLI help，以及带有实体化主键列表头的稳定摘要表输出，既适合人类直接使用，也适合 agent 消费

## 快速开始

从 PyPI 安装：

```bash
uv tool install lifeos-cli
```

初始化本地环境：

```bash
lifeos init
```

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

## 开发

1. 安装 `uv`。
2. 同步开发环境：

   ```bash
   uv sync --all-extras
   ```

3. 运行默认校验入口：

   ```bash
   bash ./scripts/doctor.sh
   ```

   该基线会覆盖 lint、死代码扫描以及默认的非 integration 测试套件。

4. 当你已经准备好 PostgreSQL 测试库时，使用完整回归入口并显式打开真实 CLI integration tests：

   ```bash
   LIFEOS_RUN_INTEGRATION=1 \
   LIFEOS_TEST_DATABASE_URL=postgresql+psycopg://postgres:<password>@127.0.0.1:5432/lifeos_test \
   bash ./scripts/doctor.sh
   ```

   这样会在默认校验基线之上，一并运行数据库驱动的 integration 测试套件。

5. 有意识地使用仓库依赖管理工作流：

   - `.github/dependabot.yml` 会为 `uv` 依赖更新创建单个、按周聚合的 PR。
   - `bash ./scripts/dependency_health.sh` 仍然是维护者显式执行的过期依赖与开发期漏洞审计流程。

CI 也会通过同一个独立入口，在临时 PostgreSQL 服务上真实运行 CLI integration tests。

## 项目策略

- 贡献流程：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全披露：[SECURITY.md](SECURITY.md)
- 社区行为规范：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## 许可证

本项目使用 Apache License 2.0。详见 [LICENSE](LICENSE)。
