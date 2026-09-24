const DEFAULT_TURN_MINUTES = 90;

/**
 * turn_time_by_party_size is stored as JSON like {"default":90,"1-2":60,"5-8":120}.
 * Range keys are inclusive "min-max" party-size buckets.
 */
export function turnTimeForPartySize(
  json: Record<string, number> | null | undefined,
  partySize: number,
): number {
  if (!json) return DEFAULT_TURN_MINUTES;
  for (const [key, minutes] of Object.entries(json)) {
    if (key === "default") continue;
    const [minStr, maxStr] = key.split("-");
    const min = Number(minStr);
    const max = Number(maxStr ?? minStr);
    if (!Number.isNaN(min) && !Number.isNaN(max) && partySize >= min && partySize <= max) {
      return minutes;
    }
  }
  return json.default ?? DEFAULT_TURN_MINUTES;
}
