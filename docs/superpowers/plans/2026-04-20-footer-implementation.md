# Footer Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise Chinese footer to VitePress pages while hiding it on the homepage and keeping it visible on all non-home pages.

**Architecture:** Use VitePress native `themeConfig.footer` for content and keep behavior changes minimal. Implement homepage-only hiding with a targeted theme stylesheet rule that applies only to the home layout container. Reuse existing config/test files to avoid introducing new runtime components.

**Tech Stack:** VitePress, JavaScript (ESM), CSS, Node test runner (`node:test`)

---

## File Structure Map

- Modify: `.vitepress/config.mjs` — add native footer configuration text and GitHub link.
- Modify: `.vitepress/theme/styles.css` — add homepage-only footer hiding rule.
- Modify: `tests/vitepress/config.test.mjs` — assert footer config exists and contains expected message/copyright.

### Task 1: Add Native Footer Config in VitePress

**Files:**
- Modify: `.vitepress/config.mjs`
- Test: `tests/vitepress/config.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('config includes Chinese footer content', () => {
  assert.ok(config.themeConfig.footer);
  assert.match(config.themeConfig.footer.message, /Notes-Atlas/);
  assert.match(config.themeConfig.footer.copyright, /©\s*2026/);
  assert.match(config.themeConfig.footer.copyright, /GitHub/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vitepress/config.test.mjs`  
Expected: FAIL because `themeConfig.footer` is missing.

- [ ] **Step 3: Write minimal implementation**

```js
// .vitepress/config.mjs (themeConfig excerpt)
themeConfig: {
  // ...existing fields
  footer: {
    message: 'Notes-Atlas',
    copyright:
      '© 2026 Notes-Atlas · <a href="https://github.com/doublenuo/Notes-Atlas" target="_blank" rel="noreferrer">GitHub</a>'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/vitepress/config.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .vitepress/config.mjs tests/vitepress/config.test.mjs
git commit -m "feat: add concise vitepress footer configuration"
```

### Task 2: Hide Footer on Homepage Only

**Files:**
- Modify: `.vitepress/theme/styles.css`
- Test: `tests/vitepress/config.test.mjs` (keep existing config tests green as regression guard)

- [ ] **Step 1: Write the failing assertion-driven check**

Add a regression test comment block in `tests/vitepress/config.test.mjs` to lock intended behavior source-of-truth:

```js
test('homepage footer hide rule is defined in theme stylesheet', async () => {
  const fs = await import('node:fs/promises');
  const css = await fs.readFile('.vitepress/theme/styles.css', 'utf8');
  assert.match(css, /\.VPHome\s+\.VPFooter/);
  assert.match(css, /display:\s*none/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vitepress/config.test.mjs`  
Expected: FAIL because hide rule is not yet present.

- [ ] **Step 3: Write minimal implementation**

```css
/* .vitepress/theme/styles.css */
.VPHome .VPFooter {
  display: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/vitepress/config.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .vitepress/theme/styles.css tests/vitepress/config.test.mjs
git commit -m "feat: hide footer on homepage only"
```

### Task 3: End-to-End Verification and Finalization

**Files:**
- Modify: none expected (verification-only task unless issues appear)
- Test: `tests/vitepress/*.test.mjs`

- [ ] **Step 1: Run focused tests**

Run: `node --test tests/vitepress/config.test.mjs`  
Expected: PASS.

- [ ] **Step 2: Run full local test set**

Run: `npm run -s test`  
Expected: PASS for all VitePress tests.

- [ ] **Step 3: Run static build verification**

Run: `npm run -s docs:build`  
Expected: Build completes without dead-link or config errors.

- [ ] **Step 4: Manual functional check**

Run: `npm run docs:dev` and verify in browser:

1. `/` homepage has **no footer**.
2. `/study/` (or another non-home page) shows footer.
3. Footer text is Chinese concise style and GitHub link opens the repo.

- [ ] **Step 5: Commit (if no extra code changes, skip commit)**

```bash
git status --short
# If verification caused no file changes, do not create empty commit.
```

## Spec Coverage Check

- 简洁中文版权 footer：Task 1
- 首页不显示，其他页面显示：Task 2 + Task 3 manual check
- 低改动/低维护：Task 1 使用原生配置，Task 2 使用单条样式规则
- 不引入新依赖：All tasks use existing toolchain/files

## Placeholder Scan

- No TBD/TODO placeholders.
- Every task includes concrete file paths, test code or command, and expected outcomes.

## Type/Name Consistency Check

- Footer config path consistently uses `config.themeConfig.footer`.
- Homepage-hide selector consistently uses `.VPHome .VPFooter`.
- Test commands consistently use existing Node test runner and npm scripts.

