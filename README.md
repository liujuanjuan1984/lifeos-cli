# lifeos

`lifeos` is a Python project for building personal operating system workflows, tools, and automation.

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

## Tooling

- `pre-commit` is used for local quality gates.
- `pip-audit` is used for dependency vulnerability checks.
- GitHub Actions validates pull requests, audits dependencies, and prepares release publishing on version tags.

## Project Policies

- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security disclosure: [SECURITY.md](SECURITY.md)
- Community expectations: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
