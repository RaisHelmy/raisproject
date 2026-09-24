import { useCallback, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useFocusEffect, type CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Alert, Badge, Button, Card, ConsentModal, ListItem, Screen, Spinner, TextField, colors } from "@pantas/ui-kit";
import { api, ApiError, CONSENT_TEXTS, type Job } from "@pantas/api-client";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Feed">,
  NativeStackScreenProps<RootStackParamList>
>;

export default function FeedScreen({ navigation }: Props) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tollAckJobId, setTollAckJobId] = useState<string | null>(null);
  const [seeAnonymousCod, setSeeAnonymousCod] = useState(false);
  const [showCodOptInModal, setShowCodOptInModal] = useState(false);
  const [offerAmounts, setOfferAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setJobs(await api.get<Job[]>("/jobs/feed"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load feed");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function confirmClaim(jobId: string) {
    setError(null);
    try {
      await api.post(`/jobs/${jobId}/claim`, { tollAcknowledgementVersion: "runner-toll-v1" });
      setTollAckJobId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not claim job");
    }
  }

  async function submitOffer(jobId: string) {
    setError(null);
    const amount = offerAmounts[jobId];
    if (!amount) return;
    try {
      await api.post("/offers", {
        jobId,
        proposedFeeMinor: Math.round(parseFloat(amount) * 100),
        tollAcknowledgementVersion: "runner-toll-v1",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit offer");
    }
  }

  async function onToggleAnonymousCod(checked: boolean) {
    if (checked) {
      setShowCodOptInModal(true);
      return;
    }
    await api.post("/auth/cod-preference", { autoRejectAnonymousCod: true });
    setSeeAnonymousCod(false);
    await load();
  }

  async function confirmCodOptIn() {
    await api.post("/auth/cod-preference", {
      autoRejectAnonymousCod: false,
      consentVersion: "runner-anonymous-cod-v1",
    });
    setSeeAnonymousCod(true);
    setShowCodOptInModal(false);
    await load();
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ flexShrink: 1 }}>Show anonymous cash-on-delivery jobs</Text>
        <Switch value={seeAnonymousCod} onValueChange={onToggleAnonymousCod} />
      </View>
      {error && <Alert message={error} />}
      {jobs === null && <Spinner />}
      {jobs?.length === 0 && <Text style={{ color: colors.muted }}>Nothing open right now.</Text>}
      {jobs?.map((j) => (
        <Card key={j.id}>
          <ListItem
            title={j.type}
            subtitle={`${j.paymentMethod} · RM ${(j.deliveryFeeMinor / 100).toFixed(2)}`}
            onPress={() => navigation.navigate("JobDetail", { jobId: j.id })}
          />
          <TextField
            label="Counter-offer (RM)"
            value={offerAmounts[j.id] ?? ""}
            onChangeText={(v) => setOfferAmounts((s) => ({ ...s, [j.id]: v }))}
            keyboardType="decimal-pad"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Counter-offer" variant="outline-primary" size="sm" onPress={() => submitOffer(j.id)} />
            <Button title="Claim" size="sm" onPress={() => setTollAckJobId(j.id)} />
          </View>
        </Card>
      ))}

      <ConsentModal
        visible={!!tollAckJobId}
        title="Before you claim"
        text={CONSENT_TEXTS["runner-toll-v1"]}
        onCancel={() => setTollAckJobId(null)}
        onConfirm={() => tollAckJobId && confirmClaim(tollAckJobId)}
        confirmLabel="I understand — claim job"
      />
      <ConsentModal
        visible={showCodOptInModal}
        title="Opting in to anonymous COD jobs"
        text={CONSENT_TEXTS["runner-anonymous-cod-v1"]}
        onCancel={() => setShowCodOptInModal(false)}
        onConfirm={confirmCodOptIn}
        confirmLabel="I understand — opt in"
      />
    </Screen>
  );
}
