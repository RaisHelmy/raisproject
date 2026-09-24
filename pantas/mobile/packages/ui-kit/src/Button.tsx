import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, type ColorName } from "./theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "outline-primary"
  | "outline-secondary"
  | "outline-danger";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_BASE_COLOR: Record<ButtonVariant, ColorName> = {
  primary: "primary",
  secondary: "secondary",
  success: "success",
  danger: "danger",
  warning: "warning",
  "outline-primary": "primary",
  "outline-secondary": "secondary",
  "outline-danger": "danger",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  fullWidth,
}: ButtonProps) {
  const isOutline = variant.startsWith("outline-");
  const base = colors[VARIANT_BASE_COLOR[variant]];
  const textColor = isOutline ? base : variant === "warning" ? colors.dark : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        SIZE_STYLES[size],
        {
          backgroundColor: isOutline ? "transparent" : base,
          borderColor: base,
          borderWidth: isOutline ? 1.5 : 0,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, SIZE_TEXT[size], { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const SIZE_STYLES = StyleSheet.create({
  sm: { paddingVertical: spacing[1], paddingHorizontal: spacing[2] },
  md: { paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  lg: { paddingVertical: spacing[3], paddingHorizontal: spacing[4] },
});

const SIZE_TEXT = StyleSheet.create({
  sm: { fontSize: 14 },
  md: { fontSize: 16 },
  lg: { fontSize: 18 },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "600",
  },
});
