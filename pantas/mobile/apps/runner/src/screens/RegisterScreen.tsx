import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Alert, Button, ConsentModal, Screen, TextField, colors } from "@pantas/ui-kit";
import { ApiError, CONSENT_TEXTS } from "@pantas/api-client";
import { useAuth } from "../auth/AuthContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onToggleAnonymous(value: boolean) {
    if (value) setShowConsent(true);
    else setAnonymousMode(false);
  }

  async function submit(withAnonymous: boolean) {
    setError(null);
    setBusy(true);
    try {
      await register({
        realName,
        phone,
        password,
        role: "runner",
        anonymousMode: withAnonymous,
        consentVersion: withAnonymous ? "anonymity-v1" : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Register as a runner</Text>
      <Text style={{ fontSize: 13, color: colors.muted }}>
        Onboarding is deliberately minimal — a few fields and you can start working today. Admin
        verifies afterwards.
      </Text>
      <TextField label="Full name" value={realName} onChangeText={setRealName} />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text>Operate anonymously toward other users</Text>
        <Switch value={anonymousMode} onValueChange={onToggleAnonymous} />
      </View>
      {anonymousMode && (
        <Text style={{ fontSize: 12, color: colors.muted }}>
          You'll stay unverified, with no priority window, no vouchers, and excluded from COD/high-value
          jobs by default.
        </Text>
      )}

      {error && <Alert message={error} />}
      <Button title={busy ? "Registering…" : "Register"} onPress={() => submit(anonymousMode)} disabled={busy} fullWidth />
      <Text style={{ textAlign: "center", color: colors.primary }} onPress={() => navigation.navigate("Login")}>
        Already have an account? Log in
      </Text>

      <ConsentModal
        visible={showConsent}
        title="Before you go anonymous"
        text={CONSENT_TEXTS["anonymity-v1"]}
        onCancel={() => setShowConsent(false)}
        onConfirm={() => {
          setAnonymousMode(true);
          setShowConsent(false);
        }}
      />
    </Screen>
  );
}
