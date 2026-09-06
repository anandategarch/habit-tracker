# Git Safety System

Automated backup & safety mechanisms for this repository, so you **never lose work again** due to a bad git operation.

## What happened (the incident)

The user ran:

```bash
git reset --hard 973239f
```

This **silently discarded 8 local commits** (`77a1dd8..80307c6`). Those commits only survived because git keeps unreachable objects as "dangling" for ~90 days before `git gc` permanently deletes them. If the user had then run `git gc --prune=now` (or waited ~90 days), those 8 commits would have been gone **forever**.

`git reset --hard` is one of the few git commands that performs an **irreversible** change to your branch pointer without creating any backup ref. The same is true of `git clean -fd`, `git push --force`, and `git checkout -- .` — they all destroy work without a paper trail.

This safety system adds 4 layers of defense so this never happens again.

---

## The 4 safety mechanisms

### 1. Pre-reset safety wrapper — `scripts/git-safety.sh`

A wrapper around dangerous git commands. **Before** running any of these, it auto-creates a backup branch AND a backup tag pointing at the current HEAD, logs the operation, and only then executes the original command.

Wrapped commands:
- `git reset --hard ...`
- `git checkout -- ...`
- `git clean -f[d]...`
- `git push --force` / `git push -f` / `git push --force-with-lease`
- `git rebase ...`

For each dangerous invocation it:
1. Creates branch `safety/backup-<timestamp>` at current HEAD
2. Creates tag `safety-tag-<timestamp>` at the same SHA (doubly protected — tags survive branch deletes)
3. Appends a line to `scripts/safety-log.txt`: `timestamp, command, previous HEAD sha, backup branch name`
4. Prints: `⚠️  DANGER ZONE: Creating safety backup branch safety/backup-<ts> before executing: <command>`
5. Executes the original command

**If the incident happened again with this wrapper in place**, the 8 commits would have been saved on `safety/backup-<ts>` and recoverable via `./scripts/git-safety.sh --restore`.

#### `--restore` mode

Lists the last 10 `safety/backup-*` branches (with their SHAs, dates, and commit messages) and lets you pick one to restore. Restoring creates a NEW branch `restore/safety/backup-<ts>` at that SHA — your current branch is **not** modified (non-destructive).

```bash
./scripts/git-safety.sh --restore
```

### 2. Auto-snapshot cron script — `scripts/auto-snapshot.sh`

Runs periodically (e.g. every 15 min via cron) to snapshot work-in-progress. If there are uncommitted changes or untracked files:

1. Runs `git stash create` and, if non-empty, stores the SHA in a ref `refs/safety-snapshots/snap-<timestamp>`
2. If there are new untracked files in `src/`, `prisma/`, or `scripts/` (excluding `node_modules` and `.next` — those are already in `.gitignore`), it builds an orphan-safe commit on branch `safety/untracked-<timestamp>` using a **temporary git index** (does NOT touch your real working index)
3. Logs to `scripts/snapshot-log.txt`
4. Prints: `Snapshot taken: <ref>, WIP files: <count>`

The script is **read-only with respect to HEAD and your working tree** — it only creates new refs.

#### Cron setup

```bash
crontab -e
# Add (every 15 min):
*/15 * * * * cd /home/z/my-project/habit-tracker && ./scripts/auto-snapshot.sh >> scripts/snapshot-cron.log 2>&1
```

### 3. Pre-push protection hook — `.git/hooks/pre-push`

A git hook that fires before any `git push`. For pushes to `refs/heads/main` or `refs/heads/master`:

1. **Always** creates a backup tag `pre-push-<timestamp>` at the current remote tip (`origin/main` sha) — so even a regular push can be rolled back.
2. **If the push is a force-push** (detected via `git merge-base --is-ancestor <remote-sha> <local-sha>` returning false):
   - Prints a BIG warning banner
   - Requires the env var `FORCE_PUSH_MAIN_CONFIRMED=yes` to proceed
   - Exits 1 (blocks the push) otherwise

To override the block (you really mean it):

```bash
FORCE_PUSH_MAIN_CONFIRMED=yes git push --force origin main
```

Normal pushes to main and any pushes to other branches are never blocked.

The hook source is version-controlled at `scripts/pre-push`; `install-safety.sh` copies it into `.git/hooks/pre-push` and makes it executable.

### 4. Recovery helper — `scripts/recover-lost.sh`

Helps recover commits that are already lost (e.g. from a past `git reset --hard` that wasn't wrapped).

It:
1. Runs `git fsck --lost-found` and parses dangling commits
2. For each: shows `sha`, `date`, `message`, `author`, and whether it's reachable from any current branch/tag
3. Separates them into "REACHABLE" (still pinned by some ref) vs "LOST" (truly unreachable)
4. For each LOST commit, shows a `git show --stat` summary
5. Prints per-commit recovery instructions:

```
→ To recover commit <sha>, run:  git cherry-pick <sha>
                                OR
                                git branch recover-<sha> <sha>
```

It also warns you: **do not run `git gc --prune=now`** until you've recovered everything — that command permanently deletes dangling objects.

---

## Installation

```bash
cd /home/z/my-project/habit-tracker
./scripts/install-safety.sh
```

This will:
1. `chmod +x` all safety scripts
2. Copy `scripts/pre-push` → `.git/hooks/pre-push` and make it executable
3. Set up these repo-local git aliases (via `git config`):

| Alias | Routes to |
|---|---|
| `git safe-reset`  | `scripts/git-safety.sh reset`    (use: `git safe-reset --hard HEAD~3`) |
| `git safe-clean`  | `scripts/git-safety.sh clean`    (use: `git safe-clean -fd`)            |
| `git safe-push`   | `scripts/git-safety.sh push`     (use: `git safe-push --force origin main`) |
| `git safe-rebase` | `scripts/git-safety.sh rebase`   (use: `git safe-rebase main`)         |

4. Run `bash -n` syntax checks on every script and the hook
5. Print `Safety system installed ✓`

The script is **idempotent** — safe to re-run any time.

> The install script is provided because manually typing the alias commands (e.g. `git config alias.safe-reset '!scripts/git-safety.sh reset --hard'`) is error-prone. The install script handles it for you.

---

## Usage cheatsheet

```bash
# Make a dangerous operation safe (auto-backup before):
./scripts/git-safety.sh reset --hard HEAD~3
./scripts/git-safety.sh clean -fd
./scripts/git-safety.sh push --force origin main
./scripts/git-safety.sh rebase main

# ...or via aliases (after install):
git safe-reset --hard HEAD~3
git safe-clean -fd
git safe-push --force origin main
git safe-rebase main

# List & restore from a previous safety backup:
./scripts/git-safety.sh --restore

# Take a WIP snapshot right now (cron also does this):
./scripts/auto-snapshot.sh

# Find & recover dangling/lost commits:
./scripts/recover-lost.sh

# Force-push to main (explicitly override the pre-push hook block):
FORCE_PUSH_MAIN_CONFIRMED=yes git push --force origin main
```

---

## How each mechanism would have prevented the incident

| Mechanism | How it stops the `git reset --hard` data loss |
|---|---|
| **1. git-safety.sh** | If the user had run `./scripts/git-safety.sh reset --hard 973239f` (or `git safe-reset --hard 973239f` after install), a `safety/backup-<ts>` branch would have been created at the pre-reset HEAD BEFORE the reset ran. The 8 commits would have been preserved on that branch and instantly recoverable via `--restore`. |
| **2. auto-snapshot.sh** | If cron had been running, every 15 minutes the WIP state would have been snapshotted into `refs/safety-snapshots/snap-<ts>`. Even an unwrapped `git reset --hard` would not destroy the last snapshot — only new commits made since the last snapshot would be at risk. |
| **3. pre-push hook** | This wouldn't have stopped a local `git reset --hard`, but it protects against the analogous "reset and push" disaster: if the user had then tried to force-push the reset to `main`, the hook would have created a `pre-push-<ts>` tag at the original `origin/main` and blocked the force-push unless `FORCE_PUSH_MAIN_CONFIRMED=yes` was set. |
| **4. recover-lost.sh** | Even after the worst happens, this finds the dangling commits, identifies the lost ones, and gives you the exact `git cherry-pick` / `git branch recover-<sha> <sha>` commands to restore them — as long as you haven't run `git gc --prune=now` yet. |

---

## Files created by this safety system

```
scripts/
├── git-safety.sh         # dangerous-command wrapper + --restore mode
├── auto-snapshot.sh      # cron-friendly WIP snapshotter
├── recover-lost.sh       # dangling-commit finder + recovery guide
├── install-safety.sh     # installer (chmod, hook copy, git aliases)
├── pre-push              # source of the .git/hooks/pre-push hook
├── README-safety.md      # this file
├── safety-log.txt        # (created at runtime) log of wrapped ops
└── snapshot-log.txt      # (created at runtime) log of snapshots

.git/hooks/
└── pre-push              # active hook (copied from scripts/pre-push by install-safety.sh)
```

Runtime-generated refs/branches/tags:
- `refs/heads/safety/backup-*` — pre-reset backups (from git-safety.sh)
- `refs/tags/safety-tag-*` — same SHAs as above, as doubly-protected tags
- `refs/safety-snapshots/snap-*` — WIP stash snapshots (from auto-snapshot.sh)
- `refs/heads/safety/untracked-*` — orphan-safe branches for untracked files
- `refs/tags/pre-push-*` — origin/main backups taken by the pre-push hook

---

## Cleanup (optional)

To delete old safety backups after you're sure you don't need them:

```bash
# Delete all safety backup branches
git for-each-ref --format='%(refname)' 'refs/heads/safety/backup-*' | xargs -r -n1 git update-ref -d

# Delete all safety tags
git for-each-ref --format='%(refname)' 'refs/tags/safety-tag-*' | xargs -r -n1 git update-ref -d

# Delete all snapshot refs
git for-each-ref --format='%(refname)' 'refs/safety-snapshots/*' | xargs -r -n1 git update-ref -d

# Delete pre-push backup tags
git for-each-ref --format='%(refname)' 'refs/tags/pre-push-*' | xargs -r -n1 git update-ref -d

# Delete untracked-file snapshot branches
git for-each-ref --format='%(refname)' 'refs/heads/safety/untracked-*' | xargs -r -n1 git branch -D
```
