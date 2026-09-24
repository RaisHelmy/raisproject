import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors, spacing } from "./theme";

export function Spinner() {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing[4], alignItems: "center" },
});
