import { useState } from "react";
import { Text, View } from "react-native";
import { Alert, Button, Screen, TextField, colors } from "@pantas/ui-kit";
import { ApiError } from "@pantas/api-client";
import { useAuth } from "../auth/AuthContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(phone, password, "vendor");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>Pantas Vendor</Text>
      <Text style={{ color: colors.muted }}>Log in to your vendor account</Text>
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Alert message={error} />}
      <Button title={busy ? "Logging in…" : "Log in"} onPress={onSubmit} disabled={busy} fullWidth />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
        <Text>No account?</Text>
        <Text style={{ color: colors.primary, fontWeight: "600" }} onPress={() => navigation.navigate("Register")}>
          Register
        </Text>
      </View>
    </Screen>
  );
}
