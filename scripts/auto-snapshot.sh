#!/usr/bin/env bash
# auto-snapshot.sh — periodic WIP (work-in-progress) snapshot for safety.
#
# Designed to be run from cron (or manually) every few minutes.
# What it does:
#   1. Checks if there are uncommitted changes OR untracked files.
#   2. If yes:
#      a. Runs `git stash create` and stores the SHA in
#         refs/safety-snapshots/snap-<timestamp>  (if non-empty)
#      b. If there are untracked files in src/, prisma/, scripts/
#         (excluding node_modules and .next), builds an orphan-safe
#         commit on branch safety/untracked-<timestamp> using a
#         TEMPORARY index (does NOT touch your real working index).
#   3. Logs to scripts/snapshot-log.txt
#   4. Prints a one-line summary.
#
# Safe to run repeatedly: it is read-only with respect to your
# working tree and HEAD — it only creates new refs/branches/tags.
#
# Cron example (every 15 min):
#   */15 * * * * cd /home/z/my-project/habit-tracker && ./scripts/auto-snapshot.sh >> scripts/snapshot-cron.log 2>&1

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Error: not inside a git repository." >&2
    exit 1
}
cd "$REPO_ROOT"

LOG_FILE="$REPO_ROOT/scripts/snapshot-log.txt"
mkdir -p "$(dirname "$LOG_FILE")"

ts=$(date +%Y%m%d-%H%M%S)
iso_ts=$(date -Iseconds)
ref_name="refs/safety-snapshots/snap-${ts}"

# Count WIP files (modified + untracked, respecting .gitignore)
wip_files=$(git status --porcelain --untracked-files=normal 2>/dev/null || true)
wip_count=$(printf '%s\n' "$wip_files" | grep -c . || true)

# Count untracked files specifically in src/, prisma/, scripts/
# (git ls-files --others --exclude-standard respects .gitignore)
untracked_list=$(git ls-files --others --exclude-standard -- src/ prisma/ scripts/ 2>/dev/null || true)
untracked_count=0
if [[ -n "$untracked_list" ]]; then
    untracked_count=$(printf '%s\n' "$untracked_list" | grep -c . || true)
fi

if [[ "$wip_count" -eq 0 ]] && [[ "$untracked_count" -eq 0 ]]; then
    echo "[$iso_ts] nothing to snapshot (clean working tree)" >> "$LOG_FILE"
    echo "Nothing to snapshot — working tree is clean."
    exit 0
fi

actions=()

# --- 1. Stash-like backup for tracked modifications ---
stash_sha=$(git stash create 2>/dev/null || true)
if [[ -n "$stash_sha" ]]; then
    git update-ref "$ref_name" "$stash_sha"
    actions+=("stash-ref $ref_name -> $stash_sha")
    {
        echo "[$iso_ts] ref=$ref_name sha=$stash_sha type=stash-tracked wip_files=$wip_count"
    } >> "$LOG_FILE"
fi

# --- 2. Orphan-safe branch for untracked files in src/, prisma/, scripts/ ---
if [[ "$untracked_count" -gt 0 ]]; then
    branch_name="safety/untracked-${ts}"
    tmp_index=$(mktemp)
    cleanup_tmp() { rm -f "$tmp_index"; }
    trap cleanup_tmp EXIT

    # Start the temp index from HEAD's tree (so untracked files get added
    # on top of an otherwise-unchanged baseline)
    GIT_INDEX_FILE="$tmp_index" git read-tree HEAD 2>/dev/null || true

    # Add each untracked file (skip if the file disappeared between
    # git ls-files and git add — race safety)
    while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        [[ -f "$f" ]] || continue
        GIT_INDEX_FILE="$tmp_index" git add -- "$f" 2>/dev/null || true
    done <<< "$untracked_list"

    tree_sha=$(GIT_INDEX_FILE="$tmp_index" git write-tree)
    commit_sha=$(git commit-tree "$tree_sha" -p HEAD -m "safety: untracked files snapshot ${iso_ts}")
    git update-ref "refs/heads/${branch_name}" "$commit_sha"

    actions+=("untracked-branch refs/heads/${branch_name} -> $commit_sha (files=$untracked_count)")
    {
        echo "[$iso_ts] branch=refs/heads/${branch_name} sha=$commit_sha type=orphan-untracked files=$untracked_count"
    } >> "$LOG_FILE"

    cleanup_tmp
    trap - EXIT
fi

# --- 3. Summary ---
# Determine the "primary" ref to report
if [[ -n "${ref_name:-}" ]] && git rev-parse --verify "$ref_name" >/dev/null 2>&1; then
    primary_ref="$ref_name"
elif [[ "${#actions[@]}" -gt 0 ]]; then
    # Only untracked branch was created
    primary_ref="refs/heads/safety/untracked-${ts}"
else
    primary_ref="(none)"
fi

echo "Snapshot taken: $primary_ref, WIP files: $wip_count"
for a in "${actions[@]:-}"; do
    [[ -z "$a" ]] && continue
    echo "  - $a"
done
