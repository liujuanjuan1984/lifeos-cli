# lifeos-cli

`lifeos-cli` is a personal operating system built around a simple belief:

> A better life starts with clearer awareness, and clearer awareness starts with honest data.

Most personal systems break life into disconnected tools: notes in one place, plans in another,
calendar somewhere else, habits somewhere else again. That fragmentation makes it hard to answer
simple but important questions:

- What did I intend to do?
- What actually happened?
- Where did my time and energy really go?
- Which relationships, routines, and priorities am I actually living out?

`lifeos-cli` is designed to hold those answers in one structured system.

## Value Proposition

The core idea is to build a bridge between **intention** and **reality**.

- Intention lives in visions, tasks, habits, and planned events.
- Reality lives in notes, timelogs, completed habit actions, and relationship records.

That distinction matters. A personal operating system should not only store what you hope to do. It
should also reflect what you actually did, so self-reflection can be grounded in evidence instead of
memory, mood, or wishful thinking.

## Why CLI

This project deliberately uses the command line as its primary interface.

That choice is not about being more technical for its own sake. It is about creating a stable,
explicit, and scriptable surface that works well for both:

- people who want direct control over their own data
- existing agents and automation systems that can call the same commands

Instead of embedding a special in-product agent layer, `lifeos-cli` treats the CLI itself as the
shared interface.

## Current Scope

The current system already covers the core building blocks of a LifeOS:

- notes
- areas
- tags
- people
- visions
- tasks
- habits and habit actions
- events
- timelogs

These modules are enough to start expressing the shape of a real personal operating system:

- what matters
- what is planned
- what is being executed
- what actually happened

## Getting Started

Install from PyPI:

```bash
uv tool install lifeos-cli
```

Initialize your local setup:

```bash
lifeos init
```

See the available command surface:

```bash
lifeos --help
```

For complete CLI usage, workflows, and output conventions, see [docs/cli.md](docs/cli.md).

## Principles

- Structured data before speculative intelligence
- Clear separation between intention and reality
- One stable interface for both humans and agents
- Local ownership of personal data
- Incremental domain growth instead of feature sprawl

## Development

1. Install `uv`.
2. Sync the development environment:

   ```bash
   uv sync --all-extras
   ```

3. Run the default validation entrypoint:

   ```bash
   bash ./scripts/doctor.sh
   ```

## Project Policies

- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security disclosure: [SECURITY.md](SECURITY.md)
- Community expectations: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
