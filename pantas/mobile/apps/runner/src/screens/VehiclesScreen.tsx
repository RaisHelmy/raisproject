import { useCallback, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Badge, Button, Card, ListItem, Screen, SegmentedControl, TextField, colors } from "@pantas/ui-kit";
import { api, ApiError, type CarSegment, type Vehicle, type VehicleType } from "@pantas/api-client";

const SEGMENTS: { value: CarSegment; label: string }[] = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "mpv", label: "MPV" },
  { value: "pickup", label: "Pickup" },
  { value: "van", label: "Van" },
];

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [segment, setSegment] = useState<CarSegment>("sedan");
  const [leatherSeats, setLeatherSeats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setVehicles(await api.get<Vehicle[]>("/vehicles"));
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
      const body: Record<string, unknown> = { vehicleType, brand, model, plateNumber };
      if (vehicleType === "car") Object.assign(body, { segment, leatherSeats });
      await api.post("/vehicles", body);
      setBrand("");
      setModel("");
      setPlateNumber("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register vehicle");
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Register a vehicle</Text>
        <SegmentedControl
          options={[
            { value: "car", label: "Car" },
            { value: "motorcycle", label: "Motorcycle" },
          ]}
          value={vehicleType}
          onChange={setVehicleType}
        />
        <TextField label="Brand" value={brand} onChangeText={setBrand} />
        <TextField label="Model" value={model} onChangeText={setModel} />
        <TextField label="Plate number" value={plateNumber} onChangeText={setPlateNumber} autoCapitalize="characters" />
        {vehicleType === "car" && (
          <>
            <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text>Leather seats</Text>
              <Switch value={leatherSeats} onValueChange={setLeatherSeats} />
            </View>
          </>
        )}
        {error && <Alert message={error} />}
        <Button title="Register" onPress={onCreate} fullWidth />
      </Card>

      <Text style={{ fontSize: 18, fontWeight: "700" }}>My vehicles</Text>
      {vehicles.length === 0 && <Text style={{ color: colors.muted }}>None yet.</Text>}
      {vehicles.map((v) => (
        <ListItem
          key={v.id}
          title={`${v.brand} ${v.model}`}
          subtitle={v.segment ?? v.vehicleType}
          right={v.leatherSeats ? <Badge label="leather" color="light" /> : undefined}
        />
      ))}
    </Screen>
  );
}
