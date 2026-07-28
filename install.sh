#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'EOF'
Usage: ./install.sh [--help]

Clones or fast-forwards the OpenCode multi-auth and compact plugins, builds
them, and adds their local paths to the global OpenCode configuration.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	usage
	exit 0
fi
if [[ "$#" -ne 0 ]]; then
	usage >&2
	exit 2
fi

readonly CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
readonly PLUGIN_DIR="$CONFIG_HOME/opencode/plugins"
readonly MULTI_DIR="$PLUGIN_DIR/opencode-openai-multi-auth"
readonly COMPACT_DIR="$PLUGIN_DIR/opencode-openai-compact"
readonly CONFIG_FILE="$CONFIG_HOME/opencode/opencode.json"
readonly MULTI_REPO="https://github.com/4our4ace/opencode-openai-multi-auth.git"
readonly COMPACT_REPO="https://github.com/4our4ace/opencode-openai-compact.git"

command -v git >/dev/null || { printf 'Error: git is required.\n' >&2; exit 1; }
command -v npm >/dev/null || { printf 'Error: npm is required.\n' >&2; exit 1; }
command -v python3 >/dev/null || { printf 'Error: python3 is required.\n' >&2; exit 1; }

clone_or_update() {
	local repo="$1" directory="$2"
	if [[ -e "$directory" && ! -d "$directory/.git" ]]; then
		printf 'Error: %s exists but is not a git checkout.\n' "$directory" >&2
		exit 1
	fi
	if [[ ! -e "$directory" ]]; then
		git clone -- "$repo" "$directory"
		return
	fi
	local remote
	remote="$(git -C "$directory" remote get-url origin 2>/dev/null || true)"
	if [[ "$remote" != "$repo" ]]; then
		printf 'Error: %s has unexpected origin %s.\n' "$directory" "${remote:-<none>}" >&2
		exit 1
	fi
	if [[ -n "$(git -C "$directory" status --porcelain)" ]]; then
		printf 'Error: %s has local changes; refusing to update it.\n' "$directory" >&2
		exit 1
	fi
	git -C "$directory" pull --ff-only --quiet
}

mkdir -p "$PLUGIN_DIR"
clone_or_update "$MULTI_REPO" "$MULTI_DIR"
clone_or_update "$COMPACT_REPO" "$COMPACT_DIR"

(cd "$MULTI_DIR" && npm ci --omit=dev)

if command -v corepack >/dev/null 2>&1; then
	corepack pnpm --version >/dev/null
	(cd "$COMPACT_DIR" && corepack pnpm install --prod --frozen-lockfile)
elif command -v pnpm >/dev/null 2>&1; then
	printf 'Warning: corepack is unavailable; using pnpm from PATH.\n' >&2
	(cd "$COMPACT_DIR" && pnpm install --prod --frozen-lockfile)
else
	printf 'Error: corepack/pnpm is required to build opencode-openai-compact.\n' >&2
	exit 1
fi

mkdir -p "$(dirname "$CONFIG_FILE")"
OPENCODE_CONFIG_FILE="$CONFIG_FILE" OPENCODE_MULTI_DIR="$MULTI_DIR" OPENCODE_COMPACT_DIR="$COMPACT_DIR" python3 - <<'PY'
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone

config_file = os.environ["OPENCODE_CONFIG_FILE"]
multi = f'file://{os.environ["OPENCODE_MULTI_DIR"]}/dist/index.js'
compact = f'file://{os.environ["OPENCODE_COMPACT_DIR"]}'
managed = [multi, compact]

if os.path.exists(config_file):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = f"{config_file}.bak-{stamp}"
    shutil.copy2(config_file, backup)
    with open(config_file, encoding="utf-8") as source:
        config = json.load(source)
else:
    backup = None
    config = {}

if not isinstance(config, dict):
    raise SystemExit(f"Error: {config_file} must contain a JSON object")
plugins = config.get("plugin", [])
if not isinstance(plugins, list):
    raise SystemExit(f"Error: {config_file} has a non-array plugin field")
config["plugin"] = [entry for entry in plugins if entry not in managed] + managed

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
print(f"Updated {config_file}" + (f" (backup: {backup})" if backup else ""))
PY
