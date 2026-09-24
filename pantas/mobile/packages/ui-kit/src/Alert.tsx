import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type ColorName } from "./theme";

const TINTS: Partial<Record<ColorName, { bg: string; fg: string }>> = {
  danger: { bg: "#f8d7da", fg: "#842029" },
  success: { bg: "#d1e7dd", fg: "#0f5132" },
  warning: { bg: "#fff3cd", fg: "#664d03" },
  info: { bg: "#cff4fc", fg: "#055160" },
  secondary: { bg: "#e2e3e5", fg: "#41464b" },
};

export function Alert({ message, variant = "danger" }: { message: string; variant?: ColorName }) {
  const tint = TINTS[variant] ?? TINTS.secondary!;
  return (
    <View style={[styles.box, { backgroundColor: tint.bg }]}>
      <Text style={{ color: tint.fg }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing[2], borderRadius: radius.md },
});
