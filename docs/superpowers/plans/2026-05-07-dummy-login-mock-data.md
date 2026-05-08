# Dummy Login Mock Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users open the dashboard with hardcoded demo credentials and realistic mock portfolio/dividend data.

**Architecture:** Keep the existing auth and dashboard routes, but add a session mode so demo login can satisfy the auth gate without touching Robinhood. Demo-mode routes return deterministic backend mock data through the same response shapes the React app already consumes.

**Tech Stack:** Flask, Python unittest, React, Vitest, React Testing Library.

---

### Task 1: Backend Demo Session

**Files:**
- Modify: `Server/main.py`
- Create: `Server/demo_data.py`
- Test: `Server/tests/test_dashboard_data.py`

- [ ] Write failing API tests for `demo@example.com` / `demo-password` login, auth status, dashboard data, yearly dividends, and logout.
- [ ] Run the focused backend tests and confirm they fail because demo behavior is missing.
- [ ] Add `Server/demo_data.py` with deterministic dashboard, holdings, portfolio, quote, dividend, projection, and yearly dividend helpers.
- [ ] Update `Server/main.py` to recognize demo credentials, track `session_mode`, skip Robinhood logout in demo mode, and route demo API calls to demo helpers.
- [ ] Re-run focused backend tests and confirm they pass.

### Task 2: Frontend Demo Button

**Files:**
- Modify: `RH_Dashboard/src/Components/LoginPage.jsx`
- Modify: `RH_Dashboard/src/LoginPage.test.jsx`
- Modify: `RH_Dashboard/src/App.css`

- [ ] Write a failing test that clicking "Try demo dashboard" calls `onLogin` with the demo credentials.
- [ ] Run the focused frontend test and confirm it fails because the button is missing.
- [ ] Add a secondary demo button under the primary sign-in button, disabled while submitting, with a small note explaining it uses sample data.
- [ ] Re-run the focused frontend test and confirm it passes.

### Task 3: Verification

**Files:**
- Review all modified files.

- [ ] Run the focused backend and frontend tests.
- [ ] Run the broader existing API/App test set if the focused tests pass.
- [ ] Review `git diff` for accidental unrelated edits.
