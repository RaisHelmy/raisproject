import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type ColorName } from "./theme";

export function Badge({ label, color = "secondary" }: { label: string; color?: ColorName }) {
  const bg = colors[color];
  const fg = color === "warning" || color === "light" ? colors.dark : colors.white;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingVertical: spacing[1] / 2,
    paddingHorizontal: spacing[2],
    borderRadius: radius.pill,
  },
  text: { fontSize: 12, fontWeight: "700" },
});
