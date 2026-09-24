import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "./theme";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Mobile-idiomatic stand-in for Bootstrap's <select> (form-select) — a
 * native dropdown menu feels foreign in a Grab/Lalamove-style flow, where
 * short choice lists are almost always inline chips/segments instead.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing[1] },
  segment: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: { color: colors.bodyColor, fontSize: 14 },
  textActive: { color: colors.white, fontWeight: "600" },
});
