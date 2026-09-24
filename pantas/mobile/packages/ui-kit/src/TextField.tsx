import type { KeyboardTypeOptions } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "./theme";

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  helpText?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  helpText,
  autoCapitalize = "sentences",
}: TextFieldProps) {
  return (
    <View style={styles.group}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      {helpText && <Text style={styles.help}>{helpText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[1] },
  label: { fontSize: 14, fontWeight: "600", color: colors.bodyColor },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    fontSize: 16,
    color: colors.bodyColor,
    backgroundColor: colors.white,
  },
  help: { fontSize: 12, color: colors.muted },
});
