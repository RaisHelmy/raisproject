import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Badge, Button, Card, ListItem, Screen, TextField, colors } from "@pantas/ui-kit";
import { api, ApiError, type VendorContract, type VendorContractOffer } from "@pantas/api-client";

export default function ContractsScreen() {
  const [contracts, setContracts] = useState<VendorContract[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [offers, setOffers] = useState<VendorContractOffer[]>([]);
  const [counterRinggit, setCounterRinggit] = useState("8.00");
  const [error, setError] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    try {
      setContracts(await api.get<VendorContract[]>("/vendor-contracts"));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContracts();
    }, [loadContracts]),
  );

  async function loadOffers(contractId: string) {
    setSelected(contractId);
    try {
      setOffers(await api.get<VendorContractOffer[]>(`/vendor-contracts/${contractId}/offers`));
    } catch (err) {
      console.error(err);
    }
  }

  async function submitCounter() {
    if (!selected) return;
    setError(null);
    try {
      await api.post(`/vendor-contracts/${selected}/offers`, {
        proposedPricePerMealMinor: Math.round(parseFloat(counterRinggit) * 100),
      });
      await loadOffers(selected);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit counter-offer");
    }
  }

  async function accept(offerId: string) {
    try {
      await api.post(`/vendor-contracts/offers/${offerId}/accept`);
      if (selected) await loadOffers(selected);
      await loadContracts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept offer");
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Catering contracts</Text>
      {contracts.map((c) => (
        <ListItem
          key={c.id}
          title={`RM ${(c.pricePerMealMinor / 100).toFixed(2)}/meal @ ${c.mealTime}`}
          right={<Badge label={c.status} color="secondary" />}
          onPress={() => loadOffers(c.id)}
        />
      ))}

      {selected && (
        <Card>
          <Text style={{ fontWeight: "700" }}>Negotiation</Text>
          {error && <Alert message={error} />}
          {offers.map((o) => (
            <ListItem
              key={o.id}
              title={`RM ${(o.proposedPricePerMealMinor / 100).toFixed(2)} from ${o.proposedByRole}`}
              right={
                o.status === "pending" ? (
                  <Button title="Accept" variant="success" size="sm" onPress={() => accept(o.id)} />
                ) : (
                  <Badge label={o.status} color="secondary" />
                )
              }
            />
          ))}
          <TextField label="Counter (RM)" value={counterRinggit} onChangeText={setCounterRinggit} keyboardType="decimal-pad" />
          <Button title="Counter-offer" variant="outline-primary" onPress={submitCounter} />
        </Card>
      )}
    </Screen>
  );
}
