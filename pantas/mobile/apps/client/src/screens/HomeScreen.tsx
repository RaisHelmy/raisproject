import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect, type CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConsentModal,
  ListItem,
  Screen,
  SegmentedControl,
  Spinner,
  TextField,
  colors,
} from "@pantas/ui-kit";
import { api, ApiError, CONSENT_TEXTS, type Job, type JobType } from "@pantas/api-client";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "delivery", label: "Delivery" },
  { value: "food_order", label: "Food" },
  { value: "item_order", label: "Item" },
  { value: "fetch", label: "Fetch" },
  { value: "ride", label: "Ride" },
];

const STATUS_COLOR: Record<string, keyof typeof colors> = {
  posted: "info",
  claimed: "primary",
  in_transit: "primary",
  delivered: "success",
  settled: "success",
  cancelled: "secondary",
  disputed: "danger",
};

export default function HomeScreen({ navigation }: Props) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [type, setType] = useState<JobType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gateway">("cash");
  const [feeRinggit, setFeeRinggit] = useState("10.00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCodModal, setShowCodModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs(await api.get<Job[]>("/jobs/mine"));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function createJob() {
    setError(null);
    setBusy(true);
    try {
      const deliveryFeeMinor = Math.round(parseFloat(feeRinggit) * 100);
      await api.post("/jobs", {
        type,
        paymentMethod,
        deliveryFeeMinor,
        codConsentVersion: paymentMethod === "cash" ? "cod-checkout-v1" : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post job");
    } finally {
      setBusy(false);
    }
  }

  function onPost() {
    if (paymentMethod === "cash") setShowCodModal(true);
    else createJob();
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Post a job</Text>
        <SegmentedControl options={JOB_TYPES} value={type} onChange={setType} />
        <SegmentedControl
          options={[
            { value: "cash", label: "Cash" },
            { value: "gateway", label: "Card / e-wallet" },
          ]}
          value={paymentMethod}
          onChange={setPaymentMethod}
        />
        <TextField
          label="Fee offered (RM)"
          value={feeRinggit}
          onChangeText={setFeeRinggit}
          keyboardType="decimal-pad"
        />
        {error && <Alert message={error} />}
        <Button title={busy ? "Posting…" : "Post job"} onPress={onPost} disabled={busy} fullWidth />
      </Card>

      <Text style={{ fontSize: 18, fontWeight: "700" }}>My jobs</Text>
      {jobs === null && <Spinner />}
      {jobs?.length === 0 && <Text style={{ color: colors.muted }}>No jobs yet.</Text>}
      {jobs?.map((j) => (
        <ListItem
          key={j.id}
          title={j.type}
          subtitle={`RM ${(j.deliveryFeeMinor / 100).toFixed(2)}`}
          right={<Badge label={j.status} color={STATUS_COLOR[j.status] ?? "secondary"} />}
          onPress={() => navigation.navigate("JobDetail", { jobId: j.id })}
        />
      ))}

      <ConsentModal
        visible={showCodModal}
        title="Paying cash on delivery"
        text={CONSENT_TEXTS["cod-checkout-v1"]}
        onCancel={() => setShowCodModal(false)}
        onConfirm={() => {
          setShowCodModal(false);
          createJob();
        }}
        confirmLabel="I understand — post job"
      />
    </Screen>
  );
}
