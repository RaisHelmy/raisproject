import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { colors, spacing } from "./theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        scrollEnabled={scroll}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bodyBg },
  body: { flex: 1 },
  content: { padding: spacing[3], gap: spacing[3] },
});
