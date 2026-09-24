import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Badge, Button, Card, ListItem, Screen, TextField, colors } from "@pantas/ui-kit";
import { api, ApiError, type Vendor } from "@pantas/api-client";

export default function ProfileScreen() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setVendors(await api.get<Vendor[]>("/vendors"));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onCreate() {
    setError(null);
    try {
      await api.post("/vendors", { businessName });
      setBusinessName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create vendor profile");
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Register your business</Text>
        <TextField label="Business name" value={businessName} onChangeText={setBusinessName} />
        {error && <Alert message={error} />}
        <Button title="Create" onPress={onCreate} fullWidth />
      </Card>

      <Text style={{ fontSize: 18, fontWeight: "700" }}>Your vendor profiles</Text>
      {vendors.length === 0 && <Text style={{ color: colors.muted }}>None yet.</Text>}
      {vendors.map((v) => (
        <ListItem key={v.id} title={v.businessName} subtitle={`id: ${v.id}`} right={<Badge label={v.status} color="secondary" />} />
      ))}
    </Screen>
  );
}
