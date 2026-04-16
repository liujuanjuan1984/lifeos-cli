from __future__ import annotations

import argparse
from functools import partial

from lifeos_cli.cli_support.runtime_utils import make_sync_handler


async def _sample_async_handler(
    args: argparse.Namespace,
    *,
    offset: int,
) -> int:
    return int(args.value) + offset


def test_make_sync_handler_supports_partials() -> None:
    handler = make_sync_handler(partial(_sample_async_handler, offset=2))

    assert handler(argparse.Namespace(value=3)) == 5
    assert handler.__name__ == "_sample_async_handler".removesuffix("_async")
