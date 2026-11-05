# PR Review & Self-Healing Loop Implementation Plan

This plan outlines the architecture, implementation, and end-to-end verification of an automated, two-agent Greptile-style Pull Request review and self-healing loop triggered by `@pr-review` comments on GitHub Pull Requests.

---

## Architecture Overview

```
                               PR Comment: "@pr-review"
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │   GitHub Actions / Local CLI    │
                         │    Acknowledge (eyes reaction)  │
                         │    Checkout PR Head Branch      │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
             ┌───────►│ Pass #X: Fetch Diff (`gh pr diff`)   │
             │        └───────────────────┬───────────────────┘
             │                            │
             │                            ▼
             │        ┌───────────────────────────────────────┐
             │        │ Agent 1: Code Reviewer (Read-Only)    │
             │        │ Tools: read, grep, find, ls           │
             │        │ Posts review comment to PR            │
             │        │ Outputs: `RATING: X/5`                │
             │        └───────────────────┬───────────────────┘
             │                            │
             │                            ▼
             │        ┌───────────────────────────────────────┐
             │        │ Gatekeeper: Rating Parser             │
             │        │ Is RATING == 5?                       │
             │        └─────────┬───────────────────┬─────────┘
             │             No   │                   │ Yes
             │                  ▼                   ▼
             │        ┌───────────────────┐   ┌───────────────────────────┐
             │        │ Agent 2: Coder    │   │ Approval Comment:         │
             │        │ Tools: read,edit, │   │ "✅ PR achieved a 5/5!"   │
             │        │        write,bash │   │ Loop Complete. Exits 0.   │
             │        └─────────┬─────────┘   └───────────────────────────┘
             │                  │
             │                  ▼
             │        ┌───────────────────┐
             │        │ Check git changes │
             │        │ (Empty? Abort)    │
             │        │ Commit & push     │
             │        │ Post status note  │
             │        └─────────┬─────────┘
             │                  │
             └──────────────────┘ (Loop if Pass < MAX_LOOPS)
```

---

## Phase Breakdown

### Phase 1: Environment & Repository Baseline Setup
- Initialize git repository and configure remote tracking to `aditya-deokar/local-code-review`.
- Configure `.gitignore` to prevent committing ephemeral artifacts (`.pr_review.diff`, `.review_output.md`, `.agent_response.md`, node/npm logs).
- Verify GitHub authentication (`gh auth status`) and inspect GitHub repository secrets (`gh secret list`).
- Validate `pi` execution in current environment.

### Phase 2: Agent Prompts Engineering
- **`.github/prompts/reviewer-prompt.md`**:
  - Role: Senior Staff Code Reviewer (Greptile-style).
  - Scope: Reads PR diff and repository files for surrounding context.
  - Evaluation dimensions: Security/secrets, bugs & edge cases, type & syntax errors, error handling, clean architecture.
  - Output standard: Markdown summary, inline file/line annotations `- [File: path:line] (Severity: High/Medium/Low): Issue & suggested fix`, and strict closing rating line `RATING: X/5`.
- **`.github/prompts/coder-prompt.md`**:
  - Role: Autonomous Senior Software Engineer.
  - Scope: Consumes Agent 1's feedback report and applies targeted file fixes using `edit`/`write`.
  - Guidelines: Resolve all High, Medium, and Low severity issues without introducing regressions; preserve existing coding conventions; avoid modifying review scripts or temporary files.

### Phase 3: Core Orchestrator Script Implementation
- Create `.github/scripts/run-review-loop.sh`:
  - Executable (`chmod +x`).
  - Supports dual runtime: executes inside GitHub Actions or from local developer terminal with identical behavior.
  - PR detection: accepts PR number argument (`$1`) or auto-detects from current git branch.
  - Loop configuration: `MAX_LOOPS=5`, tracking pass counter.
  - Safety checks:
    - Clean git state check.
    - Aborts if Coding Agent produces no file diff (`git status --porcelain`).
    - Robust regex parsing for `RATING: ([1-5])/5`.
    - Cleanup of temporary diff and markdown files prior to staging and committing.
    - Posts clear PR comments on each iteration via `gh pr comment`.

### Phase 4: GitHub Actions Workflow Configuration
- Create `.github/workflows/pr-review-loop.yml`:
  - Trigger: `issue_comment` with `types: [created]`.
  - Condition: `github.event.issue.pull_request && contains(github.event.comment.body, '@pr-review')`.
  - Permissions: `contents: write`, `pull-requests: write`, `issues: write`.
  - Reaction: Post `eyes` reaction to the trigger comment.
  - Branch Checkout: Use `gh pr checkout ${{ github.event.issue.number }}`.
  - Dependency setup: Install Pi CLI and `@plannotator/pi-extension`.
  - Execution: Invoke `.github/scripts/run-review-loop.sh ${{ github.event.issue.number }}`.

### Phase 5: Push Baseline to Default Branch (`main`)
- Stage and commit the workflow, scripts, prompts, and ignore files.
- Push to GitHub remote `origin/main` so GitHub registers the workflow trigger.

### Phase 6: End-to-End (E2E) Verification on Buggy Test PR
- Create branch `test/e2e-pr-review-loop`.
- Create a test file (`src/utils/calculator.js`) with intentional flaws:
  - Hardcoded fake API secret.
  - Division by zero unhandled edge case.
  - Unused variables and dead code.
  - Missing type/null input checks.
- Open Pull Request via `gh pr create`.
- Trigger loop via `@pr-review` comment.
- Execute and monitor the loop end-to-end:
  - Verify Agent 1 posts review comment with rating < 5/5.
  - Verify Agent 2 fixes the code, commits, and pushes to PR branch.
  - Verify Agent 1 re-reviews and awards rating 5/5.
  - Verify Gatekeeper outputs completion comment and terminates loop cleanly.

### Phase 7: Comprehensive Documentation (`GUIDE.md`)
- Complete setup and manual testing guide:
  - Architecture diagram and operational flow.
  - Prerequisites and secret configuration (`ANTHROPIC_API_KEY`, etc.).
  - Copy-paste commands for manual triggering via GitHub and local CLI.
  - Customization instructions (thresholds, prompts, model switching).
  - Troubleshooting guide for common failure modes.

---

## Package Ecosystem Integration: Option A (`dev-loops` + `@henryqw/pi-pr`)

### Phase 1: Environment & Package Installation (COMPLETED)
- Installed verified packages from https://pi.dev/packages:
  - `dev-loops` (v1.0.9): Deterministic PR gate review, upsert verdicts, and thread reply-resolve.
  - `@henryqw/pi-pr` (v11.3.0): PR feedback lifecycle, comment sweeps, and CI fix skills.
- Health verification:
  - `dev-loops doctor`: 6/7 checks passed (GitHub CLI, auth, git repo, resolver, package layout).

### Phase 2: Workflow & Script Integration (COMPLETED)
- Updated `.github/scripts/run-review-loop.sh`:
  - Dynamically discovers `dev-loops` binary (in PATH, Pi agent npm bin, or local node_modules).
  - Uses `dev-loops gate upsert-verdict` to post official GitHub PR Reviews carrying verdict (`clean` vs `findings_present`).
  - Safely caps review body at 1900 chars and whitelist issue/PR references (`--allowed-refs`) to pass `dev-loops` security guards.
  - Integrated `dev-loops gate reply-resolve` to reply to open review threads and mark them resolved citing the fixing commit SHA.
- Updated `.github/workflows/pr-review-loop.yml`:
  - Added package installation commands: `pi install npm:dev-loops`, `pi install npm:@henryqw/pi-pr`.
  - Exported `$HOME/.pi/agent/npm/node_modules/.bin` to `$GITHUB_PATH`.

### Phase 3: Live End-to-End Test on Pull Request #2 (COMPLETED)
- Pushed buggy authentication feature `src/utils/authHelper.js` with hardcoded JWT secret, missing null checks, and dead code.
- Triggered loop on PR #2 (`aditya-deokar/local-code-review/pull/2`).
- **Pass 1:**
  - Agent 1 reviewed diff and identified all security, runtime, and dead code flaws; rated `1/5`.
  - Gatekeeper identified `findings_present`.
  - `dev-loops gate upsert-verdict` created official GitHub Review [#5789188126](https://github.com/aditya-deokar/local-code-review/pull/2#pullrequestreview-5789188126).
  - Agent 2 repaired `src/utils/authHelper.js`, created `tests/authHelper.test.js` with 22 tests passing (`node --test`), committed `7e10006`, and pushed to branch.
  - `dev-loops gate reply-resolve` executed with fixing commit SHA.
- **Pass 2:**
  - Agent 1 re-reviewed diff: found zero remaining issues; awarded `5/5` rating.
  - `dev-loops gate upsert-verdict` created official clean review [#5789263428](https://github.com/aditya-deokar/local-code-review/pull/2#pullrequestreview-5789263428) with verdict `clean`.
  - Gatekeeper posted final completion message: `✅ PR achieved a 5/5 rating! Loop complete.`
  - Loop cleanly terminated with exit code 0.

### Phase 4: Final Documentation & Verification (COMPLETED)
- Updated `GUIDE.md` with:
  - Architecture diagram detailing the dual-agent + `dev-loops` gatekeeper pattern.
  - Exact live PR #2 verification evidence (Reviews #5789188126 and #5789263428).
  - Full manual testing walkthrough and CLI commands.

