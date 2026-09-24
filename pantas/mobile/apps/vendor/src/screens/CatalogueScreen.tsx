import { useState } from "react";
import { Text } from "react-native";
import { Alert, Button, Card, ListItem, Screen, TextField } from "@pantas/ui-kit";
import { api, ApiError, type Product } from "@pantas/api-client";

export default function CatalogueScreen() {
  const [vendorId, setVendorId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [priceRinggit, setPriceRinggit] = useState("5.00");
  const [error, setError] = useState<string | null>(null);

  async function load(id: string) {
    try {
      setProducts(await api.get<Product[]>(`/products/for-vendor/${id}`));
    } catch (err) {
      console.error(err);
    }
  }

  async function onCreate() {
    setError(null);
    if (!vendorId) {
      setError("Enter your vendor id first (see Profile tab)");
      return;
    }
    try {
      await api.post("/products", { vendorId, name, priceMinor: Math.round(parseFloat(priceRinggit) * 100) });
      setName("");
      await load(vendorId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add product");
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Menu / catalogue</Text>
        <TextField label="Vendor id" value={vendorId} onChangeText={setVendorId} />
        <Button title="Load items" variant="outline-secondary" size="sm" onPress={() => load(vendorId)} />
        <TextField label="Item name" value={name} onChangeText={setName} />
        <TextField label="Price (RM)" value={priceRinggit} onChangeText={setPriceRinggit} keyboardType="decimal-pad" />
        {error && <Alert message={error} />}
        <Button title="Add item" onPress={onCreate} fullWidth />
      </Card>

      {products.map((p) => (
        <ListItem key={p.id} title={p.name} subtitle={`RM ${(p.priceMinor / 100).toFixed(2)}`} />
      ))}
    </Screen>
  );
}
