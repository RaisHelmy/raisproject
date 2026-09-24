import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export interface FeedbackScores {
  ambiance?: number;
  service?: number;
  value?: number;
  food?: number;
}

export interface Feedback {
  id: string;
  tenant_id: string;
  outlet_id: string;
  reservation_id: string | null;
  guest_id: string | null;
  scores: FeedbackScores | null;
  comment: string | null;
  is_private: boolean;
  routed_to_public: boolean;
  created_at: number;
}

function rowToFeedback(row: any): Feedback {
  return {
    ...row,
    scores: row.scores ? JSON.parse(row.scores) : null,
    is_private: !!row.is_private,
    routed_to_public: !!row.routed_to_public,
  };
}

function averageScore(scores: FeedbackScores): number | null {
  const values = Object.values(scores).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Private-feedback routing (CLAUDE.md §8.9): low scores stay private (ops gets
 * alerted, guest isn't funneled to a public review); high scores are routed to
 * public review sites. Threshold: average score < 4 out of 5 stays private.
 */
export async function createFeedback(
  db: AppDatabase,
  tenantId: string,
  input: {
    outletId: string;
    reservationId?: string | null;
    guestId?: string | null;
    scores: FeedbackScores;
    comment?: string;
  },
): Promise<Feedback> {
  const id = newId();
  const created_at = now();
  const avg = averageScore(input.scores);
  const routedToPublic = avg !== null && avg >= 4;
  const isPrivate = !routedToPublic;

  await db
    .prepare(
      `INSERT INTO feedback (id, tenant_id, outlet_id, reservation_id, guest_id, scores, comment, is_private, routed_to_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      input.outletId,
      input.reservationId ?? null,
      input.guestId ?? null,
      JSON.stringify(input.scores),
      input.comment ?? null,
      isPrivate ? 1 : 0,
      routedToPublic ? 1 : 0,
      created_at,
    )
    .run();

  return {
    id,
    tenant_id: tenantId,
    outlet_id: input.outletId,
    reservation_id: input.reservationId ?? null,
    guest_id: input.guestId ?? null,
    scores: input.scores,
    comment: input.comment ?? null,
    is_private: isPrivate,
    routed_to_public: routedToPublic,
    created_at,
  };
}

export async function listFeedback(db: AppDatabase, tenantId: string, outletId: string): Promise<Feedback[]> {
  const { results } = await db
    .prepare(`SELECT * FROM feedback WHERE tenant_id = ? AND outlet_id = ? ORDER BY created_at DESC`)
    .bind(tenantId, outletId)
    .all();
  return (results ?? []).map(rowToFeedback);
}

export async function feedbackAlreadyExists(
  db: AppDatabase,
  tenantId: string,
  reservationId: string,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT id FROM feedback WHERE tenant_id = ? AND reservation_id = ? LIMIT 1`)
    .bind(tenantId, reservationId)
    .first();
  return !!row;
}
