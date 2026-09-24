import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Badge, ListItem, Screen, colors } from "@pantas/ui-kit";
import { api, type PayoutBatch } from "@pantas/api-client";

export default function PayoutsScreen() {
  const [batches, setBatches] = useState<PayoutBatch[]>([]);

  useEffect(() => {
    api.get<PayoutBatch[]>("/payouts/mine").then(setBatches).catch(console.error);
  }, []);

  return (
    <Screen>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Weekly payouts</Text>
      {batches.length === 0 && <Text style={{ color: colors.muted }}>No payout batches yet.</Text>}
      {batches.map((b) => (
        <ListItem
          key={b.id}
          title={`${b.periodStart.slice(0, 10)} – ${b.periodEnd.slice(0, 10)}`}
          subtitle={`RM ${(b.totalPayableMinor / 100).toFixed(2)} · fees RM ${(b.totalFeesDeductedMinor / 100).toFixed(2)}`}
          right={<Badge label={b.status} color="secondary" />}
        />
      ))}
    </Screen>
  );
}
