#!/usr/bin/env bash
# recover-lost.sh — find and recover dangling/lost commits in this repository.
#
# What it does:
#   1. Runs `git fsck --lost-found` to find dangling commit objects.
#   2. For each dangling commit, shows: sha, date, message, author.
#   3. Checks whether the commit is reachable from any current branch/tag
#      (so we can distinguish truly "lost" commits from ones still pinned
#      by a safety ref or stash).
#   4. Lists the LOST ones (not reachable from any branch/tag) with a
#      `git show --stat` summary.
#   5. Prints clear recovery instructions for each lost commit.
#
# Usage:
#   ./scripts/recover-lost.sh

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Error: not inside a git repository." >&2
    exit 1
}
cd "$REPO_ROOT"

echo "=== Recover Lost Commits ==="
echo ""
echo "Scanning for dangling commits (this may take a moment)..."
echo ""

# Find dangling commits: lines like "dangling commit <sha>"
mapfile -t dangling < <(
    git fsck --lost-found 2>/dev/null | awk '/^dangling commit/ {print $3}' || true
)

if [[ ${#dangling[@]} -eq 0 ]]; then
    echo "✓ No dangling commits found. Your repo has no lost commits."
    echo ""
    echo "Note: git's gc keeps dangling commits for ~90 days by default."
    echo "      If you've run 'git gc --prune=now' since losing commits, they may be gone."
    exit 0
fi

echo "Found ${#dangling[@]} dangling commit(s). Analyzing reachability..."
echo ""

# Build list of all refs to test reachability against
all_refs=$(git for-each-ref --format='%(refname)' refs/heads/ refs/tags/ refs/safety-snapshots/ 2>/dev/null || true)

lost_count=0
reachable_count=0
lost_shas=()

for sha in "${dangling[@]}"; do
    # Verify the object is still present and is a commit
    if ! git cat-file -t "$sha" >/dev/null 2>&1; then
        continue
    fi
    [[ "$(git cat-file -t "$sha" 2>/dev/null)" == "commit" ]] || continue

    date=$(git show -s --format='%ci' "$sha" 2>/dev/null || echo "unknown date")
    subject=$(git show -s --format='%s' "$sha" 2>/dev/null || echo "(no message)")
    author=$(git show -s --format='%an' "$sha" 2>/dev/null || echo "unknown")

    # Is $sha reachable from any ref? (i.e. is $sha an ancestor of any ref?)
    reachable=false
    reachable_from=""
    while IFS= read -r ref; do
        [[ -z "$ref" ]] && continue
        if git merge-base --is-ancestor "$sha" "$ref" 2>/dev/null; then
            reachable=true
            reachable_from="$ref"
            break
        fi
    done <<< "$all_refs"

    short_sha="${sha:0:12}"

    if [[ "$reachable" == "true" ]]; then
        reachable_count=$((reachable_count + 1))
        echo "✓ REACHABLE  $short_sha  ($date)  $subject"
        echo "             reachable from: $reachable_from"
    else
        lost_count=$((lost_count + 1))
        lost_shas+=("$sha")
        echo "❌ LOST      $short_sha  ($date)  $subject"
        echo "             author: $author"
        # Show stat summary (file change count, insertions/deletions)
        stat_line=$(git show --stat --format='' "$sha" 2>/dev/null | tail -1 || true)
        if [[ -n "$stat_line" ]]; then
            echo "             $stat_line"
        fi
    fi
    echo ""
done

echo "=== Summary ==="
echo "  Reachable from existing refs: $reachable_count"
echo "  Lost (not reachable):         $lost_count"
echo ""

if [[ "$lost_count" -gt 0 ]]; then
    echo "=== Recovery Instructions ==="
    echo ""
    echo "For each LOST commit above, you have two recovery options:"
    echo ""
    echo "  Option A — Cherry-pick (apply the commit on top of current branch):"
    echo "    git cherry-pick <sha>"
    echo ""
    echo "  Option B — Create a branch at the lost commit (preserves its tree):"
    echo "    git branch recover-<short-sha> <sha>"
    echo "    git checkout recover-<short-sha>"
    echo ""
    echo "Per-commit instructions:"
    for sha in "${lost_shas[@]}"; do
        short="${sha:0:12}"
        echo "  → To recover commit $short, run:  git cherry-pick $sha"
        echo "                                    OR"
        echo "                                    git branch recover-$short $sha"
    done
    echo ""
    echo "Tip: To see the full content of a lost commit:"
    echo "     git show <sha>"
    echo "     git log --oneline <sha>"
    echo ""
    echo "⚠️  IMPORTANT: Do NOT run 'git gc --prune=now' until you have recovered"
    echo "   all the commits you need — that command PERMANENTLY deletes them."
    echo ""
    echo "After recovering, you can also use the safety backup branches:"
    echo "  ./scripts/git-safety.sh --restore"
fi
