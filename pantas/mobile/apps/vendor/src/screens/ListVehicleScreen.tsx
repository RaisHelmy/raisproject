import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Button, Card, ListItem, Screen, SegmentedControl, TextField, colors } from "@pantas/ui-kit";
import { api, ApiError, type RentalListing, type Vehicle } from "@pantas/api-client";

/**
 * Trevo-style P2P rental: any user (vendor included) can register a
 * vehicle and list it for rent to runners or other vendors. Deposit is
 * declared only — collected directly between owner and renter, never held
 * by Pantas (CLAUDE.md "Vehicle rental (peer-to-peer)").
 */
export default function ListVehicleScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [listings, setListings] = useState<RentalListing[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [dailyRateRinggit, setDailyRateRinggit] = useState("80.00");
  const [depositRinggit, setDepositRinggit] = useState("300.00");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, l] = await Promise.all([
        api.get<Vehicle[]>("/vehicles"),
        api.get<RentalListing[]>("/rentals/listings"),
      ]);
      setVehicles(v);
      setListings(l);
      if (v[0]) setVehicleId(v[0].id);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function registerVehicle() {
    setError(null);
    try {
      await api.post("/vehicles", { vehicleType: "car", brand, model, plateNumber });
      setBrand("");
      setModel("");
      setPlateNumber("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register vehicle");
    }
  }

  async function createListing() {
    setError(null);
    if (!vehicleId) {
      setError("Register a vehicle first");
      return;
    }
    try {
      await api.post("/rentals/listings", {
        vehicleId,
        dailyRateMinor: Math.round(parseFloat(dailyRateRinggit) * 100),
        declaredDepositMinor: depositRinggit ? Math.round(parseFloat(depositRinggit) * 100) : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create listing");
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>1. Register the vehicle</Text>
        <TextField label="Brand" value={brand} onChangeText={setBrand} />
        <TextField label="Model" value={model} onChangeText={setModel} />
        <TextField label="Plate number" value={plateNumber} onChangeText={setPlateNumber} autoCapitalize="characters" />
        <Button title="Register vehicle" variant="outline-primary" onPress={registerVehicle} />
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>2. List it for rent</Text>
        {vehicles.length > 0 && (
          <SegmentedControl
            options={vehicles.map((v) => ({ value: v.id, label: `${v.brand} ${v.model}` }))}
            value={vehicleId}
            onChange={setVehicleId}
          />
        )}
        <TextField label="Daily rate (RM)" value={dailyRateRinggit} onChangeText={setDailyRateRinggit} keyboardType="decimal-pad" />
        <TextField
          label="Deposit you'll collect directly from the renter (RM)"
          value={depositRinggit}
          onChangeText={setDepositRinggit}
          keyboardType="decimal-pad"
          helpText="Pantas never holds this — attestation only."
        />
        {error && <Alert message={error} />}
        <Button title="List for rent" onPress={createListing} fullWidth />
      </Card>

      <Text style={{ fontSize: 18, fontWeight: "700" }}>My listings</Text>
      {listings.length === 0 && <Text style={{ color: colors.muted }}>None yet.</Text>}
      {listings.map((l) => (
        <ListItem
          key={l.id}
          title={`RM ${(l.dailyRateMinor / 100).toFixed(2)}/day`}
          subtitle={l.declaredDepositMinor ? `deposit RM ${(l.declaredDepositMinor / 100).toFixed(2)}` : undefined}
        />
      ))}
    </Screen>
  );
}
