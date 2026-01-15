import { useTheme } from "@/contexts/theme-context";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LogOut, Moon, Plus, Sun } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui/text";

interface NotesHeaderProps {
  onSignOut: () => void;
}

export function NotesHeader({ onSignOut }: NotesHeaderProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { resolvedTheme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.background,
        borderBottomWidth: 0,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.foreground,
          }}
        >
          Gopx Drive
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(app)/note/new");
            }}
            style={{ padding: 8 }}
          >
            <Plus color={colors.foreground} size={22} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              toggleTheme();
            }}
            style={{ padding: 8 }}
          >
            {resolvedTheme === "dark" ? (
              <Sun color={colors.foreground} size={22} strokeWidth={2.5} />
            ) : (
              <Moon color={colors.foreground} size={22} strokeWidth={2.5} />
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSignOut();
            }}
            style={{ padding: 8 }}
          >
            <LogOut color={colors.foreground} size={22} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
