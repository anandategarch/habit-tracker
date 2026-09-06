#!/usr/bin/env bash
# install-safety.sh — install the git safety system for this repository.
#
# What it does:
#   1. Makes all safety scripts executable (chmod +x).
#   2. Installs the pre-push hook (copies scripts/pre-push → .git/hooks/pre-push).
#   3. Sets up git aliases: git safe-reset, git safe-clean, git safe-push,
#      git safe-rebase — all route through scripts/git-safety.sh.
#   4. Verifies the installation.
#
# Safe to re-run: it is idempotent.
#
# Usage:
#   ./scripts/install-safety.sh

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Error: not inside a git repository." >&2
    exit 1
}
cd "$REPO_ROOT"

SCRIPTS_DIR="$REPO_ROOT/scripts"
HOOK_SRC="$SCRIPTS_DIR/pre-push"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-push"

echo "=== Installing git safety system ==="
echo ""

# ------------------------------------------------------------------
# 1. Make all safety scripts executable
# ------------------------------------------------------------------
echo "[1/4] Making scripts executable..."
for script in git-safety.sh auto-snapshot.sh recover-lost.sh install-safety.sh; do
    if [[ -f "$SCRIPTS_DIR/$script" ]]; then
        chmod +x "$SCRIPTS_DIR/$script"
        echo "   ✓ chmod +x scripts/$script"
    else
        echo "   ⚠️  scripts/$script not found (skipping)"
    fi
done

# ------------------------------------------------------------------
# 2. Install the pre-push hook
# ------------------------------------------------------------------
echo ""
echo "[2/4] Installing pre-push hook..."
if [[ -f "$HOOK_SRC" ]]; then
    # Back up any existing non-sample hook
    if [[ -f "$HOOK_DST" ]] && ! head -1 "$HOOK_DST" 2>/dev/null | grep -q "pre-push git hook" >/dev/null 2>&1; then
        backup="$HOOK_DST.before-safety.$(date +%Y%m%d-%H%M%S)"
        cp "$HOOK_DST" "$backup"
        echo "   ℹ️  Backed up existing pre-push hook to: $backup"
    fi
    cp "$HOOK_SRC" "$HOOK_DST"
    chmod +x "$HOOK_DST"
    echo "   ✓ Installed .git/hooks/pre-push (from scripts/pre-push)"
else
    echo "   ⚠️  scripts/pre-push source not found — cannot install hook."
    echo "      If .git/hooks/pre-push already exists, it will be left in place."
fi

# ------------------------------------------------------------------
# 3. Set up git aliases (repo-local)
# ------------------------------------------------------------------
echo ""
echo "[3/4] Setting up git aliases (repo-local)..."
git config alias.safe-reset  '!scripts/git-safety.sh reset'
git config alias.safe-clean  '!scripts/git-safety.sh clean'
git config alias.safe-push   '!scripts/git-safety.sh push'
git config alias.safe-rebase '!scripts/git-safety.sh rebase'
echo "   ✓ git safe-reset   →  scripts/git-safety.sh reset    (wraps 'git reset --hard')"
echo "   ✓ git safe-clean   →  scripts/git-safety.sh clean    (wraps 'git clean -fd')"
echo "   ✓ git safe-push    →  scripts/git-safety.sh push     (wraps 'git push --force')"
echo "   ✓ git safe-rebase  →  scripts/git-safety.sh rebase   (wraps 'git rebase')"

# ------------------------------------------------------------------
# 4. Verify
# ------------------------------------------------------------------
echo ""
echo "[4/4] Verifying installation..."
ok=true
for script in git-safety.sh auto-snapshot.sh recover-lost.sh; do
    if [[ -x "$SCRIPTS_DIR/$script" ]]; then
        echo "   ✓ scripts/$script is executable"
    else
        echo "   ✗ scripts/$script is NOT executable"
        ok=false
    fi
done
if [[ -x "$HOOK_DST" ]]; then
    echo "   ✓ .git/hooks/pre-push is executable"
else
    echo "   ✗ .git/hooks/pre-push is NOT executable"
    ok=false
fi

# Quick syntax check on all scripts
echo ""
echo "Syntax check (bash -n):"
for script in git-safety.sh auto-snapshot.sh recover-lost.sh install-safety.sh pre-push; do
    if [[ -f "$SCRIPTS_DIR/$script" ]]; then
        if bash -n "$SCRIPTS_DIR/$script" 2>/dev/null; then
            echo "   ✓ scripts/$script — syntax OK"
        else
            echo "   ✗ scripts/$script — SYNTAX ERROR"
            ok=false
        fi
    fi
done
if [[ -f "$HOOK_DST" ]]; then
    if bash -n "$HOOK_DST" 2>/dev/null; then
        echo "   ✓ .git/hooks/pre-push — syntax OK"
    else
        echo "   ✗ .git/hooks/pre-push — SYNTAX ERROR"
        ok=false
    fi
fi

echo ""
if [[ "$ok" == "true" ]]; then
    echo "Safety system installed ✓"
else
    echo "Safety system installed with warnings — review output above."
    exit 1
fi

echo ""
echo "Next steps:"
echo "  • See how it works:    ./scripts/git-safety.sh --help"
echo "  • Test restore mode:   ./scripts/git-safety.sh --restore"
echo "  • Recover lost commits: ./scripts/recover-lost.sh"
echo "  • Optional — set up cron for periodic WIP snapshots:"
echo "      crontab -e"
echo "      */15 * * * * cd $REPO_ROOT && ./scripts/auto-snapshot.sh >> scripts/snapshot-cron.log 2>&1"
echo ""
echo "Docs: scripts/README-safety.md"
