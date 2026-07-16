# Spec 0 — Legacy Branch Reconciliation Audit

Run this once before any feature work in the TravelDoss spec pack. The Lovable
agent cannot execute `git branch` from the sandbox — this checklist is meant
to be executed locally by Todd (or in a dev shell with repo access), the
results pasted back, then feature work proceeds against a truthful `main`.

## 1. Inventory

```bash
git fetch --all --prune
git branch -a --sort=-committerdate > /tmp/branches.txt
```

For each remote branch that is not `main`:

```bash
git log --oneline main..<branch> | head -50
git diff --stat main...<branch>
```

## 2. Targeted searches (spec-pack ghosts)

Run each of these against every non-merged branch. Any hit is a candidate for
cherry-pick before we build on top of it.

| Feature | Grep |
| --- | --- |
| Photo / image handling | `rg -l "gallery|photo|image.*block|storage/v1/object" src/` |
| View switcher | `rg -l "view=|ViewSheet|view_switched|ViewSwitch" src/` |
| Mobile responsive fixes | `rg -l "useIsMobile|md:hidden|dvh|safe-area" src/` |
| Bubbles / gyroscope | `rg -l "bubble|deviceorientation|gyro|requestPermission" src/` |
| Auth screen styling | `rg -l "signup|sign-up|AuthCard|magic.link" src/` |

## 3. Reconciliation table

Fill this in and check into the repo (or paste back into Lovable) before
proceeding to Slice B (bubbles removal). One row per branch.

| Branch | What it contains | Merged? | Still relevant? | Action |
| --- | --- | --- | --- | --- |
| `<name>` | | y / n | y / n | cherry-pick / re-implement / delete |

## 4. Dispositions

- **Cherry-pick**: `git cherry-pick <sha>` onto `main`, resolve conflicts, PR.
- **Re-implement**: capture the intent as a Lovable task; delete the branch.
- **Delete**: `git push origin :<branch>` — no unreviewed branches remain.

## Acceptance

- `main` is the single source of truth.
- This document is filled in and committed.
- Zero unreviewed remote branches remain.

_This satisfies Spec 0 as "advisory + checklist" — the Lovable agent could not
run these git operations itself. Every subsequent slice (4 → 1 → 3 → 2) plans
against `main` on the assumption this audit has been completed._