import { useCallback, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Badge, Button, Card, ListItem, Screen, SegmentedControl, TextField, colors } from "@pantas/ui-kit";
import { api, ApiError } from "@pantas/api-client";

interface Schedule {
  id: string;
  jobType: string;
  timeOfDay: string;
  status: string;
  deliveryFeeMinor: number;
}

const DAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function SchedulesScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [days, setDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [timeOfDay, setTimeOfDay] = useState("08:30");
  const [poolPreferred, setPoolPreferred] = useState(true);
  const [feeRinggit, setFeeRinggit] = useState("12.00");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSchedules(await api.get<Schedule[]>("/schedules/mine"));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function toggleDay(day: string) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  }

  async function onCreate() {
    setError(null);
    try {
      await api.post("/schedules", {
        jobType: "ride",
        daysOfWeek: days,
        timeOfDay,
        poolPreferred,
        deliveryFeeMinor: Math.round(parseFloat(feeRinggit) * 100),
        paymentMethod: "cash",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create schedule");
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Recurring ride (to work & back)</Text>
        <SegmentedControl
          options={DAY_CODES.map((d) => ({ value: d, label: d }))}
          value={days[days.length - 1] ?? "mon"}
          onChange={toggleDay}
        />
        <Text style={{ fontSize: 12, color: colors.muted }}>Selected: {days.join(", ") || "none"}</Text>
        <TextField label="Time (HH:MM)" value={timeOfDay} onChangeText={setTimeOfDay} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text>Prefer pooled (shared) rides</Text>
          <Switch value={poolPreferred} onValueChange={setPoolPreferred} />
        </View>
        <TextField label="Fee per ride (RM)" value={feeRinggit} onChangeText={setFeeRinggit} keyboardType="decimal-pad" />
        {error && <Alert message={error} />}
        <Button title="Create schedule" onPress={onCreate} fullWidth />
      </Card>

      <Text style={{ fontSize: 18, fontWeight: "700" }}>My schedules</Text>
      {schedules.length === 0 && <Text style={{ color: colors.muted }}>None yet.</Text>}
      {schedules.map((s) => (
        <ListItem
          key={s.id}
          title={`${s.jobType} at ${s.timeOfDay}`}
          subtitle={`RM ${(s.deliveryFeeMinor / 100).toFixed(2)}`}
          right={<Badge label={s.status} color="secondary" />}
        />
      ))}
    </Screen>
  );
}
