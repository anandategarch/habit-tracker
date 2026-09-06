#!/usr/bin/env bash
# git-safety.sh — wraps dangerous git commands with an automatic backup.
#
# Before running any of these commands, it creates:
#   - a backup branch:  safety/backup-<timestamp>   (pointing at current HEAD)
#   - a backup tag:     safety-tag-<timestamp>      (same SHA, doubly protected)
#   - a log line in:    scripts/safety-log.txt
#
# Wrapped commands:
#   git reset --hard ...
#   git checkout -- ...
#   git clean -f[d]...
#   git push --force / -f / --force-with-lease
#   git rebase ...
#
# Usage:
#   ./scripts/git-safety.sh <git-subcommand> [args]...
#   ./scripts/git-safety.sh --restore
#   ./scripts/git-safety.sh --help
#
# After running scripts/install-safety.sh you can also use git aliases:
#   git safe-reset --hard HEAD~3
#   git safe-clean -fd
#   git safe-push --force

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Error: not inside a git repository." >&2
    exit 1
}
cd "$REPO_ROOT"

LOG_FILE="$REPO_ROOT/scripts/safety-log.txt"
mkdir -p "$(dirname "$LOG_FILE")"

# ------------------------------------------------------------------
# --restore mode: list last 10 backup branches and let user restore
# ------------------------------------------------------------------
if [[ "${1:-}" == "--restore" ]]; then
    echo "=== Safety Backup Branches (last 10) ==="
    echo ""

    mapfile -t backups < <(
        git for-each-ref --sort=-committerdate \
            --format='%(refname:short)|%(objectname:short)|%(committerdate:short)|%(subject)' \
            'refs/heads/safety/backup-*' 2>/dev/null | head -10 || true
    )

    if [[ ${#backups[@]} -eq 0 ]]; then
        echo "No safety backup branches found."
        echo ""
        echo "Tip: Run './scripts/git-safety.sh <dangerous-command>' to create one"
        echo "     before risky operations like reset --hard, clean -fd, etc."
        exit 0
    fi

    i=1
    for line in "${backups[@]}"; do
        name=${line%%|*};   rest=${line#*|}
        sha=${rest%%|*};    rest=${rest#*|}
        date=${rest%%|*};   msg=${rest#*|}
        printf "%2d) %-42s %s  %s\n" "$i" "$name" "$sha" "$date"
        printf "    Message: %s\n" "$msg"
        i=$((i+1))
    done

    echo ""
    read -r -p "Enter number to restore (or 'q' to quit): " choice
    if [[ "$choice" == "q" ]] || [[ -z "$choice" ]]; then
        echo "Aborted."
        exit 0
    fi

    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt ${#backups[@]} ]]; then
        echo "Invalid selection: $choice"
        exit 1
    fi

    selected="${backups[$((choice-1))]}"
    sel_name=${selected%%|*}
    sel_rest=${selected#*|}
    sel_sha=${sel_rest%%|*}

    echo ""
    echo "Restoring from: $sel_name ($sel_sha)"
    echo "This will create a NEW branch 'restore/${sel_name#safety/}' pointing at $sel_sha."
    echo "Your current branch will NOT be modified — this is non-destructive."
    echo ""
    read -r -p "Proceed? (y/N): " confirm
    if [[ "$confirm" != "y" ]] && [[ "$confirm" != "Y" ]]; then
        echo "Aborted."
        exit 0
    fi

    restore_branch="restore/${sel_name#safety/}"
    # Make sure branch name is unique
    while git rev-parse --verify "refs/heads/$restore_branch" >/dev/null 2>&1; do
        restore_branch="${restore_branch}-$RANDOM"
    done

    git branch "$restore_branch" "$sel_sha"
    echo ""
    echo "✓ Created branch '$restore_branch' at $sel_sha"
    echo "  Switch to it:    git checkout $restore_branch"
    echo "  Inspect it:      git log $sel_sha"
    echo "  Cherry-pick:     git cherry-pick <sha>  (from any branch)"
    exit 0
fi

# ------------------------------------------------------------------
# --help mode
# ------------------------------------------------------------------
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]] || [[ $# -eq 0 ]]; then
    cat <<EOF
git-safety.sh — wraps dangerous git commands with auto-backup

Usage:
  ./scripts/git-safety.sh <git-subcommand> [args]...
  ./scripts/git-safety.sh --restore
  ./scripts/git-safety.sh --help

Wrapped commands (creates safety/backup-<ts> branch + safety-tag-<ts> tag
before executing, then logs to scripts/safety-log.txt):
  reset --hard <target>
  checkout -- <path>...
  clean -f[d]...
  push --force / -f / --force-with-lease
  rebase [args]

Examples:
  ./scripts/git-safety.sh reset --hard HEAD~3
  ./scripts/git-safety.sh clean -fd
  ./scripts/git-safety.sh --restore

Git aliases (set up by install-safety.sh):
  git safe-reset --hard HEAD~3   →  scripts/git-safety.sh reset --hard HEAD~3
  git safe-clean -fd             →  scripts/git-safety.sh clean -fd
  git safe-push --force origin main
                                 →  scripts/git-safety.sh push --force origin main
  git safe-rebase main           →  scripts/git-safety.sh rebase main
EOF
    exit 0
fi

# ------------------------------------------------------------------
# Parse the wrapped command
# ------------------------------------------------------------------
cmd="$1"
shift

dangerous=false
case "$cmd" in
    reset)
        if [[ "${1:-}" == "--hard" ]] || [[ "${1:-}" == "-H" ]] || [[ "${1:-}" == "-fh" ]] || [[ "${1:-}" == "-hf" ]]; then
            dangerous=true
        fi
        ;;
    checkout)
        # `git checkout -- ...` discards working-tree changes
        if [[ "${1:-}" == "--" ]]; then
            dangerous=true
        fi
        ;;
    clean)
        # `git clean -f...` deletes untracked files (force required by git)
        if [[ "${1:-}" == -* ]] && [[ "${1:-}" == *f* ]]; then
            dangerous=true
        fi
        ;;
    push)
        for arg in "$@"; do
            case "$arg" in
                --force|-f|--force-with-lease|--force-with-lease=*)
                    dangerous=true
                    break
                    ;;
            esac
        done
        ;;
    rebase)
        dangerous=true
        ;;
esac

prev_head=$(git rev-parse HEAD 2>/dev/null || echo "")
ts=$(date +%Y%m%d-%H%M%S)

if [[ "$dangerous" == "true" ]]; then
    backup_branch="safety/backup-${ts}"
    backup_tag="safety-tag-${ts}"

    # Ensure unique names in case multiple ops happen in the same second
    while git rev-parse --verify "refs/heads/$backup_branch" >/dev/null 2>&1; do
        backup_branch="safety/backup-${ts}-$RANDOM"
    done
    while git rev-parse --verify "refs/tags/$backup_tag" >/dev/null 2>&1; do
        backup_tag="safety-tag-${ts}-$RANDOM"
    done

    full_cmd="git $cmd $*"
    echo "⚠️  DANGER ZONE: Creating safety backup branch $backup_branch before executing: $full_cmd"

    # Create the backup branch and tag at current HEAD (before destructive op)
    git branch "$backup_branch" "$prev_head"
    git tag "$backup_tag" "$prev_head"

    # Log the operation
    {
        echo "[$(date -Iseconds)] cmd='$full_cmd' prev_head=$prev_head backup_branch=$backup_branch backup_tag=$backup_tag"
    } >> "$LOG_FILE"

    echo "   ✓ Backup branch: $backup_branch   (at ${prev_head:0:12})"
    echo "   ✓ Backup tag:    $backup_tag"
    echo "   → Restore later with: ./scripts/git-safety.sh --restore"
    echo ""
fi

# ------------------------------------------------------------------
# Execute the original git command
# ------------------------------------------------------------------
if ! git "$cmd" "$@"; then
    echo "" >&2
    echo "❌ Command failed: git $cmd $*" >&2
    if [[ "$dangerous" == "true" ]]; then
        echo "   Your work is safe in backup branch '$backup_branch' and tag '$backup_tag'." >&2
        echo "   Restore with: ./scripts/git-safety.sh --restore" >&2
    fi
    exit 1
fi

if [[ "$dangerous" == "true" ]]; then
    new_head=$(git rev-parse HEAD 2>/dev/null || echo "?")
    echo ""
    echo "✓ Command completed. HEAD: ${prev_head:0:12} → ${new_head:0:12}"
    echo "  Backup retained:  branch '$backup_branch'  +  tag '$backup_tag'"
fi
