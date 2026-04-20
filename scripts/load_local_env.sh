#!/usr/bin/env bash

load_local_env() {
  local env_file="${1:-.env}"

  if [ ! -f "$env_file" ]; then
    return 0
  fi

  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
}
