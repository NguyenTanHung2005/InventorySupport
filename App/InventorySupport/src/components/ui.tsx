import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors } from '../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, buttonTextStyles[variant]]}>
          {icon ? `${icon}  ` : ''}
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9aa5b5"
        {...input}
        style={[styles.input, input.multiline && styles.multiline, error ? styles.inputError : null, input.style]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SwitchRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.segmentItem, option.value === value && styles.segmentActive]}
          accessibilityState={{ selected: option.value === value }}
        >
          <Text style={[styles.segmentText, option.value === value && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Badge({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'muted' }) {
  return <Text style={[styles.badge, badgeStyles[tone]]}>{label}</Text>;
}

export function EmptyState({ text, children }: PropsWithChildren<{ text: string }>) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      {children}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry ? <Text style={styles.retry} onPress={onRetry}>Thử lại</Text> : null}
    </View>
  );
}

export function SuccessBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.successBanner}>{message}</Text>;
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 11, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonText: { fontWeight: '800', fontSize: 15 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  field: { gap: 6 },
  label: { color: colors.text, fontWeight: '700' },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  segment: { flexDirection: 'row', backgroundColor: '#e9edf4', borderRadius: 11, padding: 4, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontWeight: '700' },
  segmentTextActive: { color: colors.text },
  badge: { fontSize: 12, fontWeight: '800', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start' },
  empty: { padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { color: colors.muted, textAlign: 'center' },
  errorBanner: { backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10, flexDirection: 'row', gap: 10, alignItems: 'center' },
  errorBannerText: { color: colors.danger, flex: 1 },
  retry: { color: colors.primary, fontWeight: '800' },
  successBanner: { backgroundColor: colors.successSoft, color: colors.success, padding: 12, borderRadius: 10, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { color: colors.muted },
  infoValue: { color: colors.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft },
  danger: { backgroundColor: colors.danger },
  success: { backgroundColor: colors.success },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
});

const buttonTextStyles = StyleSheet.create({
  primary: { color: '#fff' },
  secondary: { color: colors.primary },
  danger: { color: '#fff' },
  success: { color: '#fff' },
  ghost: { color: colors.text },
});

const badgeStyles = StyleSheet.create({
  primary: { color: colors.primary, backgroundColor: colors.primarySoft },
  success: { color: colors.success, backgroundColor: colors.successSoft },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft },
  danger: { color: colors.danger, backgroundColor: colors.dangerSoft },
  muted: { color: colors.muted, backgroundColor: '#eef1f6' },
});
