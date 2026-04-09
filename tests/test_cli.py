from lifeos.cli import build_parser


def test_cli_parser_uses_lifeos_command_name() -> None:
    parser = build_parser()

    assert parser.prog == "lifeos"
