import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Badge, Button, Card, ListItem, Screen, SegmentedControl, Spinner, colors } from "@pantas/ui-kit";
import { api, ApiError, type Job, type Offer } from "@pantas/api-client";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "JobDetail">;

export default function JobDetailScreen({ route }: Props) {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState<"1" | "2" | "3" | "4" | "5">("5");

  const load = useCallback(async () => {
    try {
      const [j, o] = await Promise.all([
        api.get<Job>(`/jobs/${jobId}`),
        api.get<Offer[]>(`/offers/for-job/${jobId}`),
      ]);
      setJob(j);
      setOffers(o);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load job");
    }
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  if (!job) {
    return (
      <Screen>
        {error ? <Alert message={error} /> : <Spinner />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>{job.type} job</Text>
        <Badge label={job.status} color="primary" />
        <Text>
          RM {(job.deliveryFeeMinor / 100).toFixed(2)} · {job.paymentMethod}
        </Text>
      </Card>

      {error && <Alert message={error} />}

      {job.status === "posted" && (
        <Card>
          <Text style={{ fontWeight: "700" }}>Counter-offers from runners</Text>
          {offers.filter((o) => o.status === "pending").length === 0 && (
            <Text style={{ color: colors.muted }}>No offers yet.</Text>
          )}
          {offers
            .filter((o) => o.status === "pending")
            .map((o) => (
              <ListItem
                key={o.id}
                title={`RM ${(o.proposedFeeMinor / 100).toFixed(2)}`}
                subtitle={o.message ?? undefined}
                right={
                  <Button
                    title="Accept"
                    variant="success"
                    size="sm"
                    onPress={() => act(() => api.post(`/offers/${o.id}/accept`))}
                  />
                }
              />
            ))}
        </Card>
      )}

      {job.status === "delivered" && (
        <Button title="Confirm receipt & settle" onPress={() => act(() => api.post(`/jobs/${jobId}/settle`))} fullWidth />
      )}

      {["draft", "posted", "claimed"].includes(job.status) && (
        <Button
          title="Cancel job"
          variant="outline-danger"
          onPress={() => act(() => api.post(`/jobs/${jobId}/cancel`, { reason: "purchaser cancelled" }))}
          fullWidth
        />
      )}

      {job.status === "settled" && job.runnerUserId && (
        <Card>
          <Text style={{ fontWeight: "700" }}>Rate this runner</Text>
          <SegmentedControl
            options={["1", "2", "3", "4", "5"].map((n) => ({ value: n as "1", label: `${n}★` }))}
            value={ratingScore}
            onChange={setRatingScore}
          />
          <Button
            title="Submit rating"
            variant="outline-primary"
            onPress={() =>
              act(() =>
                api.post("/ratings", {
                  jobId,
                  rateeUserId: job.runnerUserId,
                  score: Number(ratingScore),
                }),
              )
            }
          />
        </Card>
      )}
    </Screen>
  );
}
