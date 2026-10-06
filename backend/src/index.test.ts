import { describe, it, expect, beforeEach } from 'vitest';

// We import app directly to test without a live server
// Vitest runs in Node; we use Hono's built-in test helpers
let app: typeof import('../src/index').default;

// Re-import fresh app state for each test suite to reset in-memory store
describe('POST /track', () => {
  beforeEach(async () => {
    // Dynamic import to get a fresh module each time if needed
    // For simplicity, we use the same app instance (state accumulates within suite)
    const mod = await import('../src/index');
    app = mod.default;
  });

  it('returns 200 and success message for valid payload', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Reading', completionHour: 8 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.message).toBe('Habit tracked successfully.');
  });

  it('returns 400 when habitName is missing', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completionHour: 8 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('returns 400 when completionHour is out of range (> 23)', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Reading', completionHour: 99 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('returns 400 when completionHour is negative', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Reading', completionHour: -1 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('returns 400 when completionHour is not an integer', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Reading', completionHour: 8.5 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when habitName is empty string', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: '', completionHour: 8 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('accepts optional timezone field', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        habitName: 'Meditation',
        completionHour: 6,
        timezone: 'Asia/Kolkata',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('accepts boundary value completionHour=0', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Sleep', completionHour: 0 }),
    });
    expect(res.status).toBe(200);
  });

  it('accepts boundary value completionHour=23', async () => {
    const res = await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Night Reading', completionHour: 23 }),
    });
    expect(res.status).toBe(200);
  });
});

describe('GET /stats/:habitName', () => {
  it('returns 200 with correct schema for existing habit', async () => {
    const mod = await import('../src/index');
    app = mod.default;

    // Track a few completions first
    await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Exercise', completionHour: 7 }),
    });
    await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Exercise', completionHour: 7 }),
    });
    await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName: 'Exercise', completionHour: 8 }),
    });

    const res = await app.request('/stats/Exercise');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body.habitName).toBe('Exercise');
    expect(typeof body.totalCompletions).toBe('number');
    expect(body.totalCompletions).toBeGreaterThanOrEqual(3);
    expect(typeof body.completionsByHour).toBe('object');

    // Verify all 24 hours are present in the response
    const byHour = body.completionsByHour as Record<string, number>;
    for (let h = 0; h < 24; h++) {
      expect(byHour[String(h)]).toBeDefined();
    }
  });

  it('returns 200 with zero completions for unknown habit', async () => {
    const mod = await import('../src/index');
    app = mod.default;

    const res = await app.request('/stats/UnknownHabitXYZ123');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body.habitName).toBe('UnknownHabitXYZ123');
    expect(body.totalCompletions).toBe(0);

    const byHour = body.completionsByHour as Record<string, number>;
    for (let h = 0; h < 24; h++) {
      expect(byHour[String(h)]).toBe(0);
    }
  });

  it('completionsByHour reflects tracked hours correctly', async () => {
    const mod = await import('../src/index');
    app = mod.default;

    const habitName = 'Piano' + Date.now(); // unique name to avoid state pollution
    await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName, completionHour: 15 }),
    });
    await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName, completionHour: 15 }),
    });
    await app.request('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName, completionHour: 16 }),
    });

    const res = await app.request(`/stats/${habitName}`);
    const body = await res.json() as Record<string, unknown>;

    const byHour = body.completionsByHour as Record<string, number>;
    expect(byHour['15']).toBe(2);
    expect(byHour['16']).toBe(1);
    expect(body.totalCompletions).toBe(3);
  });

  it('handles URL-encoded habit names', async () => {
    const mod = await import('../src/index');
    app = mod.default;

    const res = await app.request('/stats/Morning%20Run');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.habitName).toBe('Morning Run');
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const mod = await import('../src/index');
    app = mod.default;

    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});
