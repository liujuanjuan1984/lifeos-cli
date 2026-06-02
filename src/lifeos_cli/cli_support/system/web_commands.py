"""Local Web service CLI commands."""

from __future__ import annotations

import argparse
from pathlib import Path

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)


def run_web_serve(args: argparse.Namespace) -> int:
    """Serve the local LifeOS Web application."""
    from lifeos_web.server import serve

    serve(
        host=args.host,
        port=args.port,
        reload=args.reload,
        static_dir=Path(args.static_dir) if args.static_dir else None,
    )
    return 0


def build_web_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the local Web command tree."""
    web_parser = add_documented_help_parser(
        subparsers,
        "web",
        help_content=HelpContent(
            summary="Run the optional local Web interface.",
            description=(
                "Run the local LifeOS Web service against the database configured by "
                "`lifeos init` and `lifeos config`."
            ),
            examples=("lifeos web serve", "lifeos web serve --port 8765"),
            notes=(
                "Install the optional Web dependencies with `lifeos-cli[web]`. "
                "If your configured database is PostgreSQL, install both extras with "
                "`lifeos-cli[web,postgres]`.",
            ),
        ),
    )
    web_subparsers = web_parser.add_subparsers(
        dest="web_command",
        title="actions",
        metavar="action",
    )
    serve_parser = add_documented_parser(
        web_subparsers,
        "serve",
        help_content=HelpContent(
            summary="Serve the local Web API and built frontend assets.",
            description="Start a FastAPI server bound to localhost by default.",
            examples=("lifeos web serve", "lifeos web serve --host 127.0.0.1 --port 8765"),
            notes=(
                "Use `web/` with Vite during frontend development. "
                "With uv and a PostgreSQL database, run with `--extra web --extra postgres`.",
            ),
        ),
    )
    serve_parser.add_argument("--host", default="127.0.0.1", help="Bind host.")
    serve_parser.add_argument("--port", type=int, default=8765, help="Bind port.")
    serve_parser.add_argument("--reload", action="store_true", help="Enable uvicorn reload.")
    serve_parser.add_argument(
        "--static-dir",
        help="Serve a custom built frontend directory instead of bundled static assets.",
    )
    serve_parser.set_defaults(handler=run_web_serve)
