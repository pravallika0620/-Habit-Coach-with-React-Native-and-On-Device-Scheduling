# Notification Scheduling Algorithm — ALGORITHM.md

## Overview

The core intelligence of Habit Coach is its **Optimal Window Algorithm** (`calculateOptimalWindow`). Instead of sending generic notifications at a fixed time, the app learns from the user's actual behavior and nudges them at the moment they are most likely to act.

All computation happens **entirely on-device** — no cloud inference, no privacy concerns.

---

## Function Signature

```typescript
function calculateOptimalWindow(
  timestamps: number[],  // Array of Unix timestamps (ms) of past completions
  targetTime: string     // Fallback time in "HH:MM" format, e.g. "09:00"
): number                // Returns: minutes past midnight for the optimal notification
```

---

## Pseudocode

```
FUNCTION calculateOptimalWindow(timestamps, targetTime):

  // ─── COLD START ───────────────────────────────────────────────────────────
  IF length(timestamps) < 5:
    RETURN parseHHMM(targetTime)  // minutes past midnight, e.g. "09:00" → 540
  END IF

  // ─── EXTRACT TIME OF DAY ──────────────────────────────────────────────────
  minutesOfDay ← []
  FOR EACH ts IN timestamps:
    d ← new Date(ts)
    minutesOfDay.append(d.getHours() * 60 + d.getMinutes())
  END FOR

  // ─── MEAN (μ) ─────────────────────────────────────────────────────────────
  mean ← SUM(minutesOfDay) / COUNT(minutesOfDay)

  // ─── POPULATION STANDARD DEVIATION (σ) ───────────────────────────────────
  variance ← SUM((m - mean)^2 FOR m IN minutesOfDay) / COUNT(minutesOfDay)
  stdDev   ← SQRT(variance)

  // ─── OPTIMAL WINDOW ───────────────────────────────────────────────────────
  optimalMinutes ← ROUND(mean - stdDev)

  // Clamp to valid range [0, 1439]
  RETURN CLAMP(optimalMinutes, 0, 1439)

END FUNCTION
```

---

## Statistical Approach

### Why mean and standard deviation?

Given a set of daily completion times, we model the user's behavior as approximately **normally distributed** around their habitual time. This gives us two key values:

| Statistic | Formula | Meaning |
|-----------|---------|---------|
| Mean (μ) | `Σt / n` | The average time the user completes the habit |
| Std Dev (σ) | `√(Σ(t-μ)² / n)` | How consistent the user is |

### The "Golden Window"

The notification fires at **μ − σ** (mean minus one standard deviation). This is the start of the user's "golden window" — the span `[μ − σ, μ + σ]` that statistically contains ~68% of their completion events.

**Why subtract σ instead of using μ directly?**

- Sending the notification exactly at μ means it arrives *just as the user would normally act* — too late to be a useful nudge.
- Sending at μ − σ gives the user a head-start, prompting them to prepare mentally while still being within their natural active window.
- A user with **low σ** (very consistent) gets a notification close to their usual time.
- A user with **high σ** (erratic schedule) gets an earlier nudge, giving them more time to act.

---

## Cold-Start Handling

**Threshold: 5 completions**

If the user has fewer than 5 data points, the algorithm falls back to `targetTime` (the manually configured reminder time).

**Rationale:**
- With < 5 samples, the statistical estimates are too noisy to be reliable.
- A single outlier could shift the mean dramatically.
- 5 is a practical minimum that ensures at least one "normal week" of daily habit data.

**User Experience:**
- The app shows a message: *"Complete this habit X more times to enable personalized scheduling."*
- This motivates the user to build early consistency.

---

## Timezone Handling

All timestamps are stored as **Unix milliseconds (UTC)** via JavaScript's `Date.getTime()`. When extracting time-of-day values, `Date.getHours()` and `Date.getMinutes()` use the **device's local timezone** automatically.

This ensures the algorithm reflects the user's *perceived* local time, not UTC. For example, a user who always meditates at 7:00 AM local time will have consistent local timestamps regardless of timezone changes.

---

## Edge Cases

| Case | Handling |
|------|----------|
| < 5 completions | Fall back to `targetTime` |
| All completions at same time | `σ = 0`, notification fires exactly at μ |
| High variance (σ > μ) | Result clamped to 0 (i.e. midnight) |
| Result > 1439 minutes | Clamped to 1439 (23:59) |
| Completions near midnight | Time-of-day values wrap correctly since we use local hours; midnight-crossing patterns may skew μ but are bounded by the clamp |
| Invalid `targetTime` format | `targetTimeToMinutes` returns 0 (midnight) as a safe default |

---

## Notification Lifecycle

```
[User creates habit]
        │
        ▼
scheduleHabitNotification(habit)
  └─ calculateOptimalWindow([], targetTime)  → uses targetTime (cold start)
  └─ cancelScheduledNotificationAsync(oldId)
  └─ scheduleNotificationAsync(nextDate)     → stores new notificationId
        │
        ▼
[User completes habit]
        │
        ▼
addCompletion(habitId, timestamp)
        │
        ▼
scheduleHabitNotification(updatedHabit)
  └─ calculateOptimalWindow(timestamps, targetTime)  → algorithm kicks in at ≥5
  └─ cancelScheduledNotificationAsync(oldId)         → cancel previous
  └─ scheduleNotificationAsync(newDate)              → reschedule with new window
```

The **cancel → reschedule** pattern ensures only one notification is ever pending per habit, preventing notification spam as the algorithm refines its estimate.

---

## Example Walkthrough

**Habit:** Morning Run, `targetTime = "07:00"`

| Day | Completion Time | Minutes |
|-----|----------------|---------|
| 1   | 07:10          | 430     |
| 2   | 07:20          | 440     |
| 3   | 07:00          | 420     |
| 4   | 07:30          | 450     |
| 5   | 07:15          | 435     |

- **Mean (μ):** (430 + 440 + 420 + 450 + 435) / 5 = **435 min → 07:15**
- **Variance:** ((430-435)² + (440-435)² + (420-435)² + (450-435)² + (435-435)²) / 5  
  = (25 + 25 + 225 + 225 + 0) / 5 = **100**
- **Std Dev (σ):** √100 = **10 min**
- **Optimal notification:** 435 − 10 = **425 min → 07:05**

The app sends a notification at **07:05**, giving the user a gentle nudge 10 minutes before their average run time. 🏃
