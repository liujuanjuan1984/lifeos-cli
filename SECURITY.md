# Security Policy

## Scope

This repository currently ships a Python package skeleton, local validation scripts, dependency audit workflows, and release automation for publishing to PyPI and GitHub Releases.

## Security-Relevant Areas

- release tags and package version derivation
- trusted publishing configuration and GitHub Actions permissions
- dependency locking, export, and vulnerability audit flows
- secret scanning baselines and repository examples

## Reporting a Vulnerability

Please avoid posting secrets, tokens, private package credentials, or sensitive environment details in public issues.

Preferred disclosure order:

1. Use GitHub private vulnerability reporting if it is enabled for this repository.
2. If private reporting is unavailable, contact the repository maintainer directly through GitHub before opening a public issue.
3. Use a normal public issue only for low-risk hardening ideas that do not expose private data.

## Release and Publishing Notes

- Treat changes to `.github/workflows/publish.yml`, package versioning, and PyPI publishing configuration as security-sensitive.
- Trusted publishing should be configured only for the intended repository and workflow path.
- Keep `uv.lock`, version metadata, and tag validation logic aligned to reduce release drift.

## Supported Branches

Security fixes should land on the active `main` branch first.
