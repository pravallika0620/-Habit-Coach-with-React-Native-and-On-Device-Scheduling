import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';

// ─── In-memory store (replaces Cloudflare KV for Docker/local dev) ────────────
// Structure: { [habitName]: { totalCompletions: number, completionsByHour: Record<string, number> } }
export const habitStatsStore: Record<
  string,
  { totalCompletions: number; completionsByHour: Record<string, number> }
> = {};

// ─── Zod schemas ──────────────────────────────────────────────────────────────
export const trackSchema = z.object({
  habitName: z.string().min(1, 'habitName must be a non-empty string'),
  completionHour: z
    .number()
    .int('completionHour must be an integer')
    .min(0, 'completionHour must be >= 0')
    .max(23, 'completionHour must be <= 23'),
  timezone: z.string().optional(),
});

type TrackPayload = z.infer<typeof trackSchema>;

// ─── App ──────────────────────────────────────────────────────────────────────
const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use('*', logger());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── POST /track ──────────────────────────────────────────────────────────────
app.post('/track', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        issues: [{ message: 'Invalid JSON body' }],
      },
      400
    );
  }

  const result = trackSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      {
        success: false,
        issues: result.error.issues,
      },
      400
    );
  }

  const { habitName, completionHour }: TrackPayload = result.data;

  // Initialize habit stats if not present
  if (!habitStatsStore[habitName]) {
    habitStatsStore[habitName] = {
      totalCompletions: 0,
      completionsByHour: {},
    };
  }

  // Update stats
  habitStatsStore[habitName].totalCompletions += 1;
  const hourKey = String(completionHour);
  habitStatsStore[habitName].completionsByHour[hourKey] =
    (habitStatsStore[habitName].completionsByHour[hourKey] ?? 0) + 1;

  return c.json({
    success: true,
    message: 'Habit tracked successfully.',
  });
});

// ─── GET /stats/:habitName ────────────────────────────────────────────────────
app.get('/stats/:habitName', (c) => {
  const habitName = decodeURIComponent(c.req.param('habitName'));

  const stats = habitStatsStore[habitName];

  // Build completionsByHour with all 24 hours (0-23)
  const completionsByHour: Record<string, number> = {};
  for (let h = 0; h < 24; h++) {
    completionsByHour[String(h)] = stats?.completionsByHour[String(h)] ?? 0;
  }

  return c.json({
    habitName,
    totalCompletions: stats?.totalCompletions ?? 0,
    completionsByHour,
  });
});

export default app;
