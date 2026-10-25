# Career ladder (pure logic, no UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Aaron's rocket-ladder career as pure, tested logic: oldest rocket first, one flight ~ one unlock, AUTO shrinks the skill bonus, free revert.

**Architecture:** `data/ladder_meta.js` (year, class, price per roster id) feeds `career_ladder/*` (pure functions over a plain save object, injected storage). Nothing touches `flight.js`, CSS or markup; the f5.9 UI worker mounts the exports.

**Tech Stack:** plain ES modules, `node tests/*.mjs` (no deps).

## Global Constraints
- Never edit `/workspace/orbit-rush`; work in `/workspace/orbit-rush-wt-career-ladder`, branch `gamebot-missions/career-ladder`. Never push main / force-push.
- No real rocket, company or agency names anywhere (only `brand/sx.js` may); years are plain numbers.
- No CSS, no markup, no `flight.js` edits. Old contract career (`fun/ladder.js`, `missions/campaign/*`) stays untouched.
- Flight events: `onFlightEvent({type:'goal'|'end'|'recover'|'crash', rocketId, met, ...})`.
- Money is integer $K. Fee = 5 % of rocket price, failed flight = 3x fee total, goal pays once.

## Files
- Create `data/ladder_meta.js`: META[id] = { year, cls, price, leo }.
- Create `career_ladder/ladder.js`: order, rank, next in line, goals per class.
- Create `career_ladder/economy.js`: fee, fail fee, payout, stipend, tuning constants.
- Create `career_ladder/auto_tracker.js`: AUTO fraction from per-tick snapshots, stage snapshots.
- Create `career_ladder/state.js`: blank/migrate/sanitize/load/save, buy.
- Create `career_ladder/session.js`: startFlight, onFlightEvent, revertToLaunch, revertToStage.
- Create `career_ladder/strip.js`: stat strip values + labels from a flight state object.
- Create `career_ladder/index.js`, `career_ladder/API.md`, `tests/career_ladder.mjs`.

## Tasks (each: failing test, run (red), minimal code, run (green), commit)
1. **Meta + ladder order**: every roster id resolves; year sort; ties by class then payload; ids neutral.
2. **Economy**: fee 5 %, fail 3x, payout = base + bonus*(1-auto), all-AUTO still pays base, price curve monotone.
3. **AUTO tracker**: fraction, pad time ignored, dt cap, reset, stage snapshot restore.
4. **State + save**: blank owns oldest 2, v1 migrate, whitelist, corrupt -> blank, buy next only.
5. **Session**: launch charges fee, goal pays once, fail 3x, scrub refunds, revert free + resets tracker, stage revert free, stipend.
6. **Strip**: Ap/Pe/dv/TWR/g/accel values + short labels.
7. **Simulation**: fresh career to the end at full-manual and all-AUTO; flights per unlock; farming check.
8. **Docs + board/chat lines + full suite + banned-name scan + push + PR.**
