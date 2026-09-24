import { createGuest, listGuests } from "../db/guests";
import type { AppDatabase } from "./db";

/**
 * Resolves a guest id for a reservation/waitlist entry: uses the given guestId
 * if present, otherwise finds-or-creates a guest by phone/email/name.
 */
export async function resolveGuestId(
  db: AppDatabase,
  tenantId: string,
  input: { guestId?: string; guestName?: string; guestPhone?: string; guestEmail?: string },
): Promise<string | null> {
  if (input.guestId) return input.guestId;
  if (!input.guestName && !input.guestPhone && !input.guestEmail) return null;

  const search = input.guestPhone ?? input.guestEmail ?? input.guestName;
  if (search) {
    const { items } = await listGuests(db, tenantId, { page: 1, pageSize: 1, search });
    if (items.length > 0 && items[0]) return items[0].id;
  }

  const guest = await createGuest(db, tenantId, {
    name: input.guestName ?? input.guestPhone ?? input.guestEmail ?? "Guest",
    phone: input.guestPhone,
    email: input.guestEmail,
  });
  return guest.id;
}
