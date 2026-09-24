import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Badge, Button, Card, Screen, Spinner, TextField } from "@pantas/ui-kit";
import { api, ApiError, type Job } from "@pantas/api-client";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "JobDetail">;

const NEXT_STEP: Record<string, { label: string; path: string } | undefined> = {
  claimed: { label: "Mark picked up", path: "picked-up" },
  picked_up: { label: "Mark in transit", path: "in-transit" },
  in_transit: { label: "Mark delivered", path: "delivered" },
};

export default function JobDetailScreen({ route }: Props) {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sosSent, setSosSent] = useState(false);
  const [nonPaymentAmount, setNonPaymentAmount] = useState("");
  const [nonPaymentResult, setNonPaymentResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setJob(await api.get<Job>(`/jobs/${jobId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load job");
    }
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function advance() {
    if (!job) return;
    const step = NEXT_STEP[job.status];
    if (!step) return;
    setError(null);
    try {
      await api.post(`/jobs/${jobId}/${step.path}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update job");
    }
  }

  async function triggerSos() {
    try {
      await api.post("/sos/trigger", { jobId });
      setSosSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not trigger SOS");
    }
  }

  async function reportNonPayment() {
    if (!nonPaymentAmount) return;
    setError(null);
    setNonPaymentResult(null);
    try {
      const result = await api.post<{ suspended: boolean }>(`/jobs/${jobId}/report-non-payment`, {
        amountMinor: Math.round(parseFloat(nonPaymentAmount) * 100),
      });
      setNonPaymentResult(
        result.suspended
          ? "Reported. This purchaser has been auto-suspended for repeated non-payment."
          : "Reported — tracked against the purchaser's account.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not report non-payment");
    }
  }

  if (!job) {
    return <Screen>{error ? <Alert message={error} /> : <Spinner />}</Screen>;
  }
  const step = NEXT_STEP[job.status];

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>{job.type} job</Text>
        <Badge label={job.status} color="primary" />
        <Text>RM {(job.deliveryFeeMinor / 100).toFixed(2)}</Text>
      </Card>
      {error && <Alert message={error} />}
      {step && <Button title={step.label} onPress={advance} fullWidth />}
      <Button title={sosSent ? "SOS sent — admin notified" : "🆘 Emergency SOS"} variant="danger" onPress={triggerSos} disabled={sosSent} fullWidth />
      {job.paymentMethod === "cash" && ["delivered", "settled"].includes(job.status) && (
        <Card>
          <Text style={{ fontWeight: "700" }}>Not paid?</Text>
          <TextField
            label="Amount not paid (RM)"
            value={nonPaymentAmount}
            onChangeText={setNonPaymentAmount}
            keyboardType="decimal-pad"
            placeholder={(job.deliveryFeeMinor / 100).toFixed(2)}
          />
          {nonPaymentResult && <Alert message={nonPaymentResult} variant="warning" />}
          <Button title="Report non-payment" variant="outline-danger" onPress={reportNonPayment} fullWidth />
        </Card>
      )}
    </Screen>
  );
}
