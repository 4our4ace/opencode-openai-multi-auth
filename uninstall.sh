#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Usage: ./uninstall.sh [--help]

Removes only this suite's local plugin entries and managed plugin folders.
The OpenCode configuration is backed up before it is changed.
EOF
	exit 0
fi
if [[ "$#" -ne 0 ]]; then
	printf 'Usage: ./uninstall.sh [--help]\n' >&2
	exit 2
fi

readonly CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
readonly PLUGIN_DIR="$CONFIG_HOME/opencode/plugins"
readonly MULTI_DIR="$PLUGIN_DIR/opencode-openai-multi-auth"
readonly COMPACT_DIR="$PLUGIN_DIR/opencode-openai-compact"
readonly CONFIG_FILE="$CONFIG_HOME/opencode/opencode.json"

command -v python3 >/dev/null || { printf 'Error: python3 is required.\n' >&2; exit 1; }

OPENCODE_CONFIG_FILE="$CONFIG_FILE" OPENCODE_MULTI_DIR="$MULTI_DIR" OPENCODE_COMPACT_DIR="$COMPACT_DIR" python3 - <<'PY'
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone

config_file = os.environ["OPENCODE_CONFIG_FILE"]
multi = f'file://{os.environ["OPENCODE_MULTI_DIR"]}/dist/index.js'
compact = f'file://{os.environ["OPENCODE_COMPACT_DIR"]}'

if os.path.exists(config_file):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = f"{config_file}.bak-{stamp}"
    shutil.copy2(config_file, backup)
    with open(config_file, encoding="utf-8") as source:
        config = json.load(source)
    if not isinstance(config, dict):
        raise SystemExit(f"Error: {config_file} must contain a JSON object")
    plugins = config.get("plugin", [])
    if not isinstance(plugins, list):
        raise SystemExit(f"Error: {config_file} has a non-array plugin field")
    config["plugin"] = [entry for entry in plugins if entry != multi and entry != compact]
    directory = os.path.dirname(config_file)
    fd, temporary = tempfile.mkstemp(prefix=".opencode.json.", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as target:
            json.dump(config, target, indent=2)
            target.write("\n")
        os.replace(temporary, config_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Updated {config_file} (backup: {backup})")
else:
    print(f"No config found at {config_file}")
PY

rm -rf -- "$MULTI_DIR" "$COMPACT_DIR"
printf 'Removed managed plugin folders. Restart OpenCode to apply the change.\n'
