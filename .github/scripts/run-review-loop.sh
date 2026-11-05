#!/usr/bin/env bash
# ==============================================================================
# Automated PR Review & Self-Healing Loop (Greptile-Style Two-Agent Architecture)
# ==============================================================================
# Usage:
#   ./.github/scripts/run-review-loop.sh <PR_NUMBER>
# Or inside GitHub Actions with ${{ github.event.issue.number }}
# ==============================================================================

set -euo pipefail

# ANSI color helpers for terminal readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

# Determine PR Number
PR_NUMBER="${1:-}"
if [ -z "$PR_NUMBER" ]; then
  log_info "No PR number passed as argument. Attempting auto-detection via gh CLI..."
  PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null || echo "")
fi

if [ -z "$PR_NUMBER" ]; then
  log_error "Failed to detect PR number. Usage: $0 <PR_NUMBER>"
  exit 1
fi

# Detect repository slug (owner/repo)
REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
log_info "Repository: ${REPO_SLUG:-unknown}, Pull Request #${PR_NUMBER}"

# Locate dev-loops CLI (from npm:dev-loops package)
DEV_LOOPS_CMD=""
if command -v dev-loops >/dev/null 2>&1; then
  DEV_LOOPS_CMD="dev-loops"
elif [ -f "$HOME/.pi/agent/npm/node_modules/.bin/dev-loops" ]; then
  DEV_LOOPS_CMD="$HOME/.pi/agent/npm/node_modules/.bin/dev-loops"
elif [ -f "$HOME/.pi/agent/npm/node_modules/dev-loops/cli/index.mjs" ]; then
  DEV_LOOPS_CMD="node $HOME/.pi/agent/npm/node_modules/dev-loops/cli/index.mjs"
elif [ -f "${REPO_ROOT}/node_modules/.bin/dev-loops" ]; then
  DEV_LOOPS_CMD="${REPO_ROOT}/node_modules/.bin/dev-loops"
fi

if [ -n "$DEV_LOOPS_CMD" ]; then
  log_info "Found dev-loops package CLI: ${DEV_LOOPS_CMD}"
else
  log_info "dev-loops CLI not detected; will use standard gh CLI fallback for reviews and comments."
fi

# Configuration
MAX_LOOPS="${MAX_LOOPS:-5}"
PASS=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REVIEWER_PROMPT_FILE="${REPO_ROOT}/.github/prompts/reviewer-prompt.md"
CODER_PROMPT_FILE="${REPO_ROOT}/.github/prompts/coder-prompt.md"

cd "${REPO_ROOT}"

# Validate prompts exist
if [ ! -f "$REVIEWER_PROMPT_FILE" ]; then
  log_error "Reviewer prompt file not found at: $REVIEWER_PROMPT_FILE"
  exit 1
fi

if [ ! -f "$CODER_PROMPT_FILE" ]; then
  log_error "Coder prompt file not found at: $CODER_PROMPT_FILE"
  exit 1
fi

# Ensure git credentials are configured (important in GitHub Actions CI)
if ! git config user.name >/dev/null 2>&1; then
  git config user.name "github-actions[bot]"
fi
if ! git config user.email >/dev/null 2>&1; then
  git config user.email "github-actions[bot]@users.noreply.github.com"
fi

# Cleanup helper for temporary files
cleanup_temp_files() {
  rm -f "${REPO_ROOT}/.pr_review.diff" \
        "${REPO_ROOT}/.review_output.md" \
        "${REPO_ROOT}/.coder_output.md" \
        "${REPO_ROOT}/.pr_comment_payload.md" \
        "${REPO_ROOT}/.temp_*" 2>/dev/null || true
}

# Ensure clean slate at start
cleanup_temp_files

# Make sure we are on the PR's head branch
log_info "Checking out head branch for PR #${PR_NUMBER}..."
gh pr checkout "$PR_NUMBER"

# ==============================================================================
# MAIN REVIEW & SELF-HEALING LOOP
# ==============================================================================
while [ "$PASS" -le "$MAX_LOOPS" ]; do
  echo ""
  log_info "============================================================"
  log_info ">>> EXECUTING REVIEW PASS #${PASS} of ${MAX_LOOPS}"
  log_info "============================================================"

  # 1. Fetch current PR diff
  log_info "Fetching PR diff via 'gh pr diff ${PR_NUMBER}'..."
  gh pr diff "$PR_NUMBER" > "${REPO_ROOT}/.pr_review.diff" 2>/dev/null || true

  # Fallback to local git diff against origin/main if gh diff is empty
  if [ ! -s "${REPO_ROOT}/.pr_review.diff" ]; then
    log_info "Fetching local diff against origin/main..."
    git diff origin/main...HEAD > "${REPO_ROOT}/.pr_review.diff" || true
  fi

  DIFF_SIZE=$(wc -c < "${REPO_ROOT}/.pr_review.diff" | tr -d ' ')
  log_info "PR diff size: ${DIFF_SIZE} bytes"

  # 2. Run Agent 1: The Code Review Agent (Strictly Read-Only)
  log_info "Invoking Agent 1 (Code Reviewer, read-only mode)..."
  AGENT1_PROMPT="You are performing Pass #${PASS} of the review for Pull Request #${PR_NUMBER}.
The git diff is saved in .pr_review.diff.
Inspect this diff using your 'read' tool and read any surrounding files in the repository as needed to evaluate context.
Perform a thorough Greptile-style review according to your system prompt.
Be specific with file and line references.
Your output must end with the exact line: RATING: X/5 (where X is an integer from 1 to 5)."

  pi --no-session --approve --tools read,grep,find,ls \
     --append-system-prompt "$REVIEWER_PROMPT_FILE" \
     -p "$AGENT1_PROMPT" > "${REPO_ROOT}/.review_output.md"

  # Check that Agent 1 produced output
  if [ ! -s "${REPO_ROOT}/.review_output.md" ]; then
    log_error "Agent 1 generated an empty review output."
    exit 1
  fi

  # 3. Post review comment to GitHub PR
  HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
  log_info "Current HEAD SHA: ${HEAD_SHA}"

  # Gatekeeper Check: Parse RATING from Agent 1's output
  # Matches lines like 'RATING: 5/5', '**RATING: 5/5**', 'Rating: 3/5'
  PARSED_RATING=$(grep -ioE 'RATING:?[[:space:]]*[1-5][[:space:]]*/[[:space:]]*5' "${REPO_ROOT}/.review_output.md" | tail -n 1 | grep -oE '[1-5]' | head -n 1 || echo "")

  if [ -z "$PARSED_RATING" ]; then
    log_warn "Gatekeeper could not parse rating from Agent 1 output. Defaulting to 1/5."
    PARSED_RATING="1"
  fi

  log_info "Gatekeeper Check: Parsed Rating is [${PARSED_RATING}/5]"

  if [ "$PARSED_RATING" -eq 5 ]; then
    VERDICT="clean"
  else
    VERDICT="findings_present"
  fi

  # Post review using dev-loops package if available, else fallback to gh pr comment
  POSTED_VIA_DEVLOOPS=false
  if [ -n "$DEV_LOOPS_CMD" ] && [ -n "$REPO_SLUG" ] && [ -n "$HEAD_SHA" ]; then
    log_info "Posting official PR review via 'dev-loops gate upsert-verdict' (verdict: ${VERDICT})..."
    if $DEV_LOOPS_CMD gate upsert-verdict \
         --repo "$REPO_SLUG" \
         --pr "$PR_NUMBER" \
         --head-sha "$HEAD_SHA" \
         --verdict "$VERDICT" \
         --findings-file "${REPO_ROOT}/.review_output.md" \
         --gate review \
         --execution-mode inline_single_agent \
         --inline-reason "pi dev-loops pass #${PASS}"; then
      POSTED_VIA_DEVLOOPS=true
      log_success "Posted PR review via dev-loops for Pass #${PASS}."
    else
      log_warn "dev-loops gate upsert-verdict failed. Falling back to gh pr comment."
    fi
  fi

  if [ "$POSTED_VIA_DEVLOOPS" = false ]; then
    log_info "Posting Agent 1 review comment to PR #${PR_NUMBER} via gh pr comment..."
    {
      echo "## 🕵️ Code Review Report (Pass #${PASS})"
      echo ""
      cat "${REPO_ROOT}/.review_output.md"
    } > "${REPO_ROOT}/.pr_comment_payload.md"
    gh pr comment "$PR_NUMBER" --body-file "${REPO_ROOT}/.pr_comment_payload.md"
    log_success "Posted review comment for Pass #${PASS}."
  fi

  if [ "$PARSED_RATING" -eq 5 ]; then
    log_success "PR achieved a 5/5 rating on Pass #${PASS}! Loop complete."
    gh pr comment "$PR_NUMBER" --body "✅ PR achieved a 5/5 rating! Loop complete."
    cleanup_temp_files
    exit 0
  fi

  # Check if maximum iterations reached
  if [ "$PASS" -ge "$MAX_LOOPS" ]; then
    log_warn "Maximum review loops (${MAX_LOOPS}) reached without achieving 5/5 rating."
    gh pr comment "$PR_NUMBER" --body "⚠️ **Review Loop Limit Reached**: Completed ${MAX_LOOPS} passes without reaching a 5/5 rating (Current rating: ${PARSED_RATING}/5). Please review remaining items manually."
    cleanup_temp_files
    exit 1
  fi

  # 5. Run Agent 2: The Coding Agent (Read/Write Execution)
  log_info "Rating is ${PARSED_RATING}/5 (< 5). Handing feedback to Agent 2 (Coding Agent)..."

  AGENT2_INPUT=$(cat "${REPO_ROOT}/.review_output.md")
  AGENT2_PROMPT="You are executing Pass #${PASS} of the automated self-healing loop for PR #${PR_NUMBER}.
Agent 1 (Code Reviewer) provided the following feedback:

${AGENT2_INPUT}

Your task:
1. Carefully inspect the affected files mentioned in the review.
2. Fix all High, Medium, and Low severity issues reported by Agent 1.
3. Clean up any dead code, resolve security risks, and ensure robust error handling.
4. Do NOT touch .github/ workflows or prompts.
5. Apply all fixes directly to the codebase now."

  pi --no-session --approve --tools read,edit,write,bash \
     --append-system-prompt "$CODER_PROMPT_FILE" \
     -p "$AGENT2_PROMPT" > "${REPO_ROOT}/.coder_output.md"

  # 6. Clean temporary files before inspecting git changes
  cleanup_temp_files

  # 7. Safety Check: Verify that Agent 2 actually modified files
  GIT_CHANGES=$(git status --porcelain)
  if [ -z "$GIT_CHANGES" ]; then
    log_warn "Agent 2 produced no file changes in response to Pass #${PASS} review."
    gh pr comment "$PR_NUMBER" --body "⚠️ **Self-Healing Loop Aborted**: Agent 2 produced no file changes to address review feedback from Pass #${PASS}. Aborting to prevent infinite loop."
    exit 1
  fi

  log_info "Agent 2 made the following file changes:"
  echo "$GIT_CHANGES"

  # 8. Stage, Commit, and Push
  log_info "Committing and pushing changes for Pass #${PASS}..."
  git add -A
  git commit -m "fix(coding-agent): resolve review findings from pass #${PASS}"
  FIX_COMMIT_SHA=$(git rev-parse HEAD)
  log_info "Created fix commit: ${FIX_COMMIT_SHA}"

  # Push to the PR head branch
  git push origin HEAD

  # 9. Resolve review threads via dev-loops if available
  if [ -n "$DEV_LOOPS_CMD" ] && [ -n "$REPO_SLUG" ]; then
    log_info "Resolving open PR review threads via 'dev-loops gate reply-resolve'..."
    $DEV_LOOPS_CMD gate reply-resolve \
      --repo "$REPO_SLUG" \
      --pr "$PR_NUMBER" \
      --message "Resolved in commit ${FIX_COMMIT_SHA} during self-healing Pass #${PASS}." \
      --disposition fixed \
      --resolve || true
  fi

  # 10. Post status comment on PR
  gh pr comment "$PR_NUMBER" --body "🤖 **Coding Agent (Pass #${PASS})**: Applied fixes (commit \`${FIX_COMMIT_SHA:0:7}\`) and pushed to branch. Next review pass triggered..."
  log_success "Pushed fixes and commented on PR #${PR_NUMBER}."

  # Wait briefly for remote git and GitHub cache to sync
  log_info "Pausing 4 seconds for remote repository synchronization..."
  sleep 4

  PASS=$((PASS + 1))
done

log_warn "Loop ended after ${MAX_LOOPS} passes."
exit 1
