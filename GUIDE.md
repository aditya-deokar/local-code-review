# Automated PR Review & Self-Healing Loop Guide

This repository implements an autonomous, Greptile-style Pull Request Review and Self-Healing Loop triggered by commenting `@pr-review` on any GitHub Pull Request.

The system strictly decouples the **Code Reviewer** (strictly read-only) from the **Coding Agent** (read/write execution), orchestrated by a deterministic **Gatekeeper** that enforces quality thresholds before permitting approval.

---

## 1. Architecture Overview

### System Architecture Diagram

```
                             User Comments: "@pr-review"
                                          │
                                          ▼
                       ┌─────────────────────────────────────┐
                       │      GitHub Actions / Local CLI     │
                       │  • Add reaction (👀) to comment      │
                       │  • Checkout PR head branch          │
                       └──────────────────┬──────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
            ┌────────►│ Pass #X: Fetch Diff (`gh pr diff`)    │
            │         └───────────────────┬───────────────────┘
            │                             │
            │                             ▼
            │         ┌───────────────────────────────────────┐
            │         │ Agent 1: Code Reviewer (Read-Only)    │
            │         │ Tools: read, grep, find, ls           │
            │         │ Role: Greptile-style PR review        │
            │         │ Output: Structured markdown findings  │
            │         │ Mandatory: `RATING: X/5`              │
            │         └───────────────────┬───────────────────┘
            │                             │
            │                             ▼
            │         ┌───────────────────────────────────────┐
            │         │ Gatekeeper Check                      │
            │         │ Parse rating from Agent 1 report      │
            │         │ Is RATING == 5?                       │
            │         └──────────┬──────────────────┬─────────┘
            │              No    │                  │ Yes
            │                    ▼                  ▼
            │         ┌────────────────────┐   ┌───────────────────────────┐
            │         │ Agent 2: Coder     │   │ Approval Comment:         │
            │         │ Tools: read, edit, │   │ "✅ PR achieved a 5/5     │
            │         │        write, bash │   │ rating! Loop complete."   │
            │         │ Resolves findings  │   │ Exits 0                   │
            │         └──────────┬─────────┘   └───────────────────────────┘
            │                    │
            │                    ▼
            │         ┌────────────────────┐
            │         │ Safety Check:      │
            │         │ Did files change?  │
            │         │ (Empty? Abort)     │
            │         └──────────┬─────────┘
            │                    │
            │                    ▼
            │         ┌────────────────────┐
            │         │ Git Commit & Push  │
            │         │ `fix(coding-agent)`│
            │         │ Status comment     │
            │         └──────────┬─────────┘
            │                    │
            └────────────────────┘ (Repeat until 5/5 or MAX_LOOPS reached)
```

### Component Roles & Separation of Concerns

| Component | Permissions / Tools | Responsibility |
|---|---|---|
| **Agent 1: Code Review Agent** | Strictly Read-Only (`read`, `grep`, `find`, `ls`) | Inspects `gh pr diff` and surrounding code. Produces structured markdown review with inline file/line annotations `- [File: path:line] (Severity: High/Medium/Low): Issue & fix` and closes with `RATING: X/5`. |
| **`dev-loops` Package Integration** | `dev-loops gate upsert-verdict` & `reply-resolve` | Posts official GitHub Pull Request Reviews (`state: COMMENTED`) with verdict (`clean` or `findings_present`). Replies to open GitHub review threads with the 40-character fix commit SHA and automatically marks threads resolved. |
| **The Gatekeeper** | Regex Parser & Decision Gate | Extracts integer rating (`1..5`). If `5/5`, posts approval comment and exits cleanly. If `< 5/5`, validates loop limits and triggers Agent 2. |
| **Agent 2: Coding Agent** | Read/Write Execution (`read`, `edit`, `write`, `bash`) | Consumes Agent 1's feedback report, directly applies minimal targeted file edits to resolve every reported issue, cleans dead code, and ensures code builds. |
| **Safety Circuit Breakers** | Script Orchestrator | • Enforces `MAX_LOOPS` (default: 5) to prevent infinite loops.<br>• Verifies `git status --porcelain`: if Agent 2 makes zero file changes, aborts immediately with a warning comment.<br>• Cleans ephemeral diff and markdown files prior to staging changes. |

---

## 2. Package Ecosystem Integration (`pi.dev/packages`)

The loop integrates verified packages from the official [pi.dev/packages](https://pi.dev/packages) ecosystem:

### 1. `dev-loops` (`npm:dev-loops`)
- **Role:** Autonomous PR Gatekeeper & Thread Resolution.
- **Commands used in the loop:**
  - `dev-loops gate upsert-verdict`: Submits a first-class GitHub PR Review carrying the verdict (`clean` vs `findings_present`), reviewed head SHA, and markdown findings.
  - `dev-loops gate reply-resolve`: Maps review feedback to the fixing commit SHA and auto-resolves open review comment threads on GitHub.
  - `dev-loops doctor`: Verifies CLI and environment health.

### 2. `@henryqw/pi-pr` (`npm:@henryqw/pi-pr`)
- **Role:** PR Lifecycle & Feedback Sweep.
- **Skills provided:** `pi-pr-comment-sweep`, `pi-pr-fix-ci`, `git-commit`, `update-from-main`.

### Installation in Pi:
```bash
pi install npm:dev-loops
pi install npm:@henryqw/pi-pr
```

---

## 2. Prerequisites & Secret Setup

### Setting up on a New GitHub Repository

#### A. Enable GitHub Actions Read and Write Permissions
GitHub Actions must be allowed to create comments, reactions, and commit to branches:
1. Navigate to your repository on GitHub.
2. Go to **Settings** → **Actions** → **General**.
3. Under **Workflow permissions**, select **Read and write permissions**.
4. Check **Allow GitHub Actions to create and approve pull requests**.
5. Click **Save**.

#### B. Configure LLM API Keys in GitHub Secrets
For the workflow to execute autonomously in GitHub Actions runners, set your preferred provider's API key:

```bash
# Using Anthropic (Claude)
gh secret set ANTHROPIC_API_KEY --body "your-anthropic-api-key"

# OR Using OpenAI (GPT-4o)
gh secret set OPENAI_API_KEY --body "your-openai-api-key"

# OR Using Google Gemini
gh secret set GEMINI_API_KEY --body "your-gemini-api-key"
```

#### C. Local Machine Prerequisites (for Local CLI Execution)
- **Node.js**: v20 or higher (`node -v`)
- **GitHub CLI**: Authenticated with repo and workflow scopes (`gh auth status`)
- **Git**: Configured with user name and email (`git config user.name`, `git config user.email`)
- **Pi CLI**: Installed globally or locally:
  ```bash
  curl -fsSL https://pi.dev/install.sh | sh
  # Or via npm:
  npm install -g @earendil-works/pi-coding-agent
  ```

---

## 3. Step-by-Step Manual Testing Guide

### Option A: Testing via GitHub Actions (Cloud Runner)

Follow these exact steps to trigger the cloud workflow:

```bash
# 1. Switch to a new branch for testing
git checkout -b test/manual-pr-review-demo

# 2. Create a deliberately flawed test file
mkdir -p src/utils
cat << 'EOF' > src/utils/demo.js
// Vulnerable demo utility
const HARDCODED_SECRET = "sk-live-super-secret-demo-token-999";

function divide(numerator, denominator) {
  // Bug: No division by zero check
  return numerator / denominator;
}

function processList(items) {
  // Bug: Crashes on null or undefined
  return items.map(x => x.trim());
}

module.exports = { HARDCODED_SECRET, divide, processList };
EOF

# 3. Commit and push the branch
git add src/utils/demo.js
git commit -m "feat: add demo utility with deliberate issues"
git push -u origin test/manual-pr-review-demo

# 4. Open a Pull Request
gh pr create \
  --title "demo: test PR for review loop" \
  --body "Testing automated @pr-review self-healing loop."

# 5. Trigger the loop by commenting on the PR
gh pr comment <PR_NUMBER> --body "@pr-review"

# 6. Monitor workflow execution
gh run list --workflow=pr-review-loop.yml
gh run watch
```

---

### Option B: Testing via Local Terminal (Zero Cloud CI Cost)

You can run the exact orchestrator script locally against any open Pull Request using your local environment's credentials and compute:

```bash
# Execute review and healing loop against PR #2 (or any PR number):
./.github/scripts/run-review-loop.sh 2
```

#### What happens during execution:
1. Script automatically checks out the PR head branch.
2. Fetches the PR diff (`gh pr diff <PR_NUMBER>`).
3. Invokes **Agent 1** (Strictly Read-Only).
4. Posts Agent 1's review comment to GitHub.
5. If `RATING < 5/5`:
   - Invokes **Agent 2** with the review feedback.
   - Verifies file changes.
   - Commits: `fix(coding-agent): resolve review findings from pass #X`.
   - Pushes commit to the PR branch.
   - Posts status update comment.
   - Proceeds to Pass #2.
6. Re-reviews until `RATING: 5/5` is awarded.
7. Posts `✅ PR achieved a 5/5 rating! Loop complete.` and exits.

---

## 4. Live Verification Proof (Pull Request #2)

The system was verified end-to-end on Pull Request #2 with deliberate security, stability, and code quality bugs:

1. **Buggy Code Introduced**:
   - Hardcoded `DUMMY_API_KEY = "sk-live-fake-secret-token-12345abcdef67890"` exported in `module.exports`.
   - Division by zero in `divide(a, b)`.
   - Null pointer dereference and empty array `NaN` in `calculateAverage(numbers)`.
   - Dead variables `unusedCalculationCounter` and `temporaryCalculationState`.

2. **Pass #1 Execution**:
   - **Agent 1** detected all 5 issues, generated inline annotations, and awarded:
     `RATING: 1/5`
   - **Gatekeeper** parsed `1/5` and triggered **Agent 2**.
   - **Agent 2** edited `src/utils/calculator.js`, removed the secret, added zero-division assertions, added input type checks, removed dead code, and wrote a complete unit test suite in `tests/calculator.test.js`.
   - Pushed commit: `dc132035b2d73d6c88f412b1ce34901b2987862b`.

3. **Pass #2 Execution**:
   - **Agent 1** re-reviewed the updated code and tests.
   - Evaluated: `No issues found. Code is secure, correct, and well-structured.`
   - Awarded: `RATING: 5/5`.
   - **Gatekeeper** posted approval: `✅ PR achieved a 5/5 rating! Loop complete.`
   - Successfully terminated with exit code `0`.

---

## 5. Customization Guide

### Changing the Maximum Loop Limit
By default, the loop executes up to 5 passes. You can override this via the `MAX_LOOPS` environment variable:

```bash
# Run with max 3 loops:
MAX_LOOPS=3 ./.github/scripts/run-review-loop.sh <PR_NUMBER>
```

In `.github/workflows/pr-review-loop.yml`, update the step env:
```yaml
      - name: Run Review & Self-Healing Loop
        env:
          MAX_LOOPS: 3
```

### Changing LLM Models & Providers
In `.github/scripts/run-review-loop.sh`, modify the `pi` invocations:

```bash
# To use Anthropic Claude 3.5 Sonnet:
pi --model anthropic/claude-3-5-sonnet-20241022 ...

# To use OpenAI GPT-4o:
pi --model openai/gpt-4o ...

# To use Google Gemini:
pi --model gemini-3.8-flash ...
```

### Customizing Review Guidelines
Modify `.github/prompts/reviewer-prompt.md` to add project-specific checks, such as:
- Enforcing specific test coverage thresholds.
- Enforcing TypeScript strict mode conventions.
- Checking for compliance with project-specific styling or architectural patterns.

### Customizing Coding Agent Behavior
Modify `.github/prompts/coder-prompt.md` to enforce:
- Creating unit tests alongside every bug fix.
- Linting or formatting before finishing.
- Keeping edits minimal and avoiding unnecessary refactorings.

---

## 6. Troubleshooting & Operational Guide

| Issue | Root Cause | Solution |
|---|---|---|
| **Workflow doesn't trigger on `@pr-review`** | Comment posted on an Issue rather than a Pull Request, or typo in trigger text. | Ensure comment is posted on an open PR and contains `@pr-review`. Check workflow permissions under Settings → Actions. |
| **`Process completed with exit code 1` in Actions** | Missing API keys in GitHub Secrets. | Add `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` to repo secrets via `gh secret set <NAME>`. |
| **Agent 2 produces no file changes** | Agent deemed existing code sufficient or couldn't parse the issue. | The safety circuit breaker halts execution to prevent infinite looping and posts an alert comment. Check `.coder_output.md` logs. |
| **Git push rejected in Actions** | The runner branch is out of sync or permissions are read-only. | Verify that workflow permissions are set to "Read and write permissions" in repository settings. |
| **Stuck or running workflow** | Agent in a long multi-turn loop. | Cancel via GitHub CLI: `gh run cancel <RUN_ID>` or view live output via `gh run view <RUN_ID> --log`. |
