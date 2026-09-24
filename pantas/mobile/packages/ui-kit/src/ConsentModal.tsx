import { Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, radius, spacing } from "./theme";

/**
 * The one blocking-modal-with-"I understand" pattern CLAUDE.md requires
 * everywhere (anonymity opt-in, toll acknowledgement, COD checkout,
 * anonymous-COD opt-in) — one component so every app uses it identically.
 */
export function ConsentModal({
  visible,
  title,
  text,
  onCancel,
  onConfirm,
  confirmLabel = "I understand — continue",
}: {
  visible: boolean;
  title: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{text}</Text>
          <View style={styles.actions}>
            <Button title="Cancel" variant="outline-secondary" onPress={onCancel} />
            <Button title={confirmLabel} variant="primary" onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing[3],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[3],
    gap: spacing[3],
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.bodyColor },
  body: { fontSize: 14, color: colors.bodyColor, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing[2] },
});
