import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_MODE, getModeConfig, type AIMode } from "@/lib/ai-providers/mode-config";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Code,
  FileCheck,
  FileText,
  List,
  ListChecks,
  Pencil,
  Scale,
  Smile,
  Table
} from "lucide-react-native";
import * as React from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Svg, { Defs, Stop, LinearGradient as SvgLinearGradient, Text as SvgText, TSpan } from "react-native-svg";

interface AIPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, mode?: AIMode) => void;
  initialPrompt?: string;
  isLoading?: boolean;
}

// Gradient text component for cross-platform gradient text
const GradientText = ({ children, style, disabled }: { children: React.ReactNode; style?: any; disabled?: boolean }) => {
  const { colors } = useThemeColors();
  const textRef = React.useRef<Text>(null);
  const [textLayout, setTextLayout] = React.useState({ width: 0, height: 0 });

  // Use a unique gradient ID to avoid conflicts - must be called before any conditional returns
  const gradientId = React.useMemo(() => `gradient-${Math.random().toString(36).substr(2, 9)}`, []);

  const fontSize = style?.fontSize || 15;
  const fontWeight = style?.fontWeight || "700";
  const textString = typeof children === "string" ? children : String(children);

  if (Platform.OS === "web") {
    if (disabled) {
      return <Text style={[{ color: colors.mutedForeground, fontSize }, style]}>{children}</Text>;
    }
    return (
      <Text
        style={[
          style,
          {
            fontSize,
            fontWeight,
            background: "linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          },
        ]}
      >
        {children}
      </Text>
    );
  }

  // For native platforms, always use the same container structure to prevent layout shifts
  // Always render Text first for measurement, then overlay SVG when enabled
  return (
    <View className="items-center justify-center">
      {/* Always render Text for consistent sizing - this prevents layout shift */}
      {/* Make text fully transparent when gradient is enabled (disabled=false) */}
      <Text
        ref={textRef}
        style={[
          style,
          {
            color: disabled ? colors.mutedForeground : "transparent",
            fontSize,
            fontWeight,
            letterSpacing: style?.letterSpacing || 0.1,
          },
        ]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0 && (textLayout.width !== width || textLayout.height !== height)) {
            setTextLayout({ width, height });
          }
        }}
      >
        {children}
      </Text>

      {/* Overlay gradient SVG when enabled - uses same dimensions as Text */}
      {!disabled && textLayout.width > 0 && textLayout.height > 0 && (
        <Svg
          width={textLayout.width}
          height={textLayout.height}
          className="absolute"
        >
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#ec4899" stopOpacity="1" />
              <Stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
              <Stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <SvgText
            x="0"
            y={fontSize + 1}
            fontSize={fontSize}
            fontWeight={fontWeight}
            fill={`url(#${gradientId})`}
            letterSpacing={style?.letterSpacing || 0.7}
          >
            <TSpan>{textString}</TSpan>
          </SvgText>
        </Svg>
      )}
    </View>
  );
};

// Icon mapping for modes
const MODE_ICONS: Record<AIMode, typeof Smile> = {
  friendly: Smile,
  professional: Briefcase,
  concise: Scale,
  summary: FileText,
  "key-points": ListChecks,
  list: List,
  table: Table,
  code: Code,
  proofread: FileCheck,
  rewrite: Pencil,
};

export function AIPromptModal({
  visible,
  onClose,
  onGenerate,
  initialPrompt = "",
  isLoading = false,
}: AIPromptModalProps) {
  const { colors } = useThemeColors();
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [selectedMode, setSelectedMode] = React.useState<AIMode>(DEFAULT_MODE);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setPrompt(initialPrompt);
      setSelectedMode(DEFAULT_MODE);
    } else {
      setKeyboardVisible(false);
    }
  }, [visible, initialPrompt]);

  // Only enable KeyboardAvoidingView when keyboard is actually visible.
  // When keyboard closes, RN's KAV often leaves extra space / shifted layout;
  // disabling it on keyboardDidHide ensures the modal fills the screen again.
  React.useEffect(() => {
    if (Platform.OS === "web" || !visible) return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const handleGenerate = () => {
    if (prompt.trim() && !isLoading) {
      onGenerate(prompt.trim(), selectedMode);
    }
  };

  const currentModeConfig = getModeConfig(selectedMode);
  const ModeIcon = MODE_ICONS[selectedMode];

  // Custom trigger component with chevron icon
  const CustomDropdownTrigger = React.forwardRef<any, any>((props, ref) => {
    const { open } = DropdownMenuPrimitive.useRootContext();
    return (
      <DropdownMenuTrigger ref={ref} {...props}>
        <View className="min-w-[200px] flex-row items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <Icon as={ModeIcon} size={16} className="text-foreground" />
          <Text className="flex-1 text-sm text-foreground">
            {currentModeConfig.label}
          </Text>
          <Icon
            as={open ? ChevronUp : ChevronDown}
            size={16}
            className="text-foreground"
          />
        </View>
      </DropdownMenuTrigger>
    );
  });
  CustomDropdownTrigger.displayName = "CustomDropdownTrigger";

  return (
    <>
      {Platform.OS === "web" ? (
        visible && (
          <View className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={onClose} />
            <View className="w-full max-w-[500px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                AI Assistant
              </Text>
              <Text className="mb-4 text-sm text-muted-foreground">
                Enter your prompt to generate content.
              </Text>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="What would you like to generate?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                className="min-h-[100px] rounded-md border border-border bg-background p-3 text-sm text-foreground mb-4"
                autoFocus
              />
              <Text className="mb-2 text-sm font-medium text-foreground">
                Mode
              </Text>
              <View className="mb-6">
                <DropdownMenu>
                  <CustomDropdownTrigger />
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Style</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={selectedMode} onValueChange={(value) => setSelectedMode(value as AIMode)}>
                      <DropdownMenuRadioItem value="friendly">
                        <View className="flex-row items-center gap-2">
                          <Icon as={Smile} size={16} className="text-foreground" />
                          <Text className="text-foreground">Friendly</Text>
                        </View>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="professional">
                        <View className="flex-row items-center gap-2">
                          <Icon as={Briefcase} size={16} className="text-foreground" />
                          <Text className="text-foreground">Professional</Text>
                        </View>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="concise">
                        <View className="flex-row items-center gap-2">
                          <Icon as={Scale} size={16} className="text-foreground" />
                          <Text className="text-foreground">Concise</Text>
                        </View>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Format</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={selectedMode} onValueChange={(value) => setSelectedMode(value as AIMode)}>
                      <DropdownMenuRadioItem value="summary">
                        <View className="flex-row items-center gap-2">
                          <Icon as={FileText} size={16} className="text-foreground" />
                          <Text className="text-foreground">Summary</Text>
                        </View>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="key-points">
                        <View className="flex-row items-center gap-2">
                          <Icon as={ListChecks} size={16} className="text-foreground" />
                          <Text className="text-foreground">Key Points</Text>
                        </View>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="list">
                        <View className="flex-row items-center gap-2">
                          <Icon as={List} size={16} className="text-foreground" />
                          <Text className="text-foreground">List</Text>
                        </View>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="table">
                        <View className="flex-row items-center gap-2">
                          <Icon as={Table} size={16} className="text-foreground" />
                          <Text className="text-foreground">Table</Text>
                        </View>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="code">
                        <View className="flex-row items-center gap-2">
                          <Icon as={Code} size={16} className="text-foreground" />
                          <Text className="text-foreground">Code</Text>
                        </View>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </View>
              <View className="flex-row items-center justify-end gap-3">
                <Pressable
                  className="px-4 py-2"
                  onPress={onClose}
                  disabled={isLoading}
                >
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  className={`rounded-md px-4 py-2 ${prompt.trim() && !isLoading ? "opacity-100" : "opacity-50"}`}
                  onPress={handleGenerate}
                  disabled={!prompt.trim() || isLoading}
                >
                  <GradientText
                    disabled={!prompt.trim() || isLoading}
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    {isLoading ? "Generating..." : "Generate"}
                  </GradientText>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <KeyboardAvoidingView
            className="flex-1"
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            enabled={keyboardVisible}
          >
            <View className="flex-1 bg-black/50">
              <View className="flex-1">
                <Pressable className="absolute inset-0" onPress={onClose} />
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 16,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View className="w-full max-w-[500px] rounded-lg border border-border bg-muted p-6 shadow-lg">
                    <Text className="mb-2 text-lg font-semibold text-foreground">
                      AI Assistant
                    </Text>
                    <Text className="mb-4 text-sm text-muted-foreground">
                      Enter your prompt to generate content.
                    </Text>
                    <TextInput
                      value={prompt}
                      onChangeText={setPrompt}
                      placeholder="What would you like to generate?"
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      numberOfLines={4}
                      className="min-h-[100px] rounded-md border border-border bg-background p-3 text-sm text-foreground mb-4"
                      autoFocus
                    />
                    <Text className="mb-2 text-sm font-medium text-foreground">
                      Mode
                    </Text>
                    <View className="mb-6">
                      <DropdownMenu>
                        <CustomDropdownTrigger />
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Style</DropdownMenuLabel>
                          <DropdownMenuRadioGroup value={selectedMode} onValueChange={(value) => setSelectedMode(value as AIMode)}>
                            <DropdownMenuRadioItem value="friendly">
                              <View className="flex-row items-center gap-2">
                                <Icon as={Smile} size={16} className="text-foreground" />
                                <Text className="text-foreground">Friendly</Text>
                              </View>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="professional">
                              <View className="flex-row items-center gap-2">
                                <Icon as={Briefcase} size={16} className="text-foreground" />
                                <Text className="text-foreground">Professional</Text>
                              </View>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="concise">
                              <View className="flex-row items-center gap-2">
                                <Icon as={Scale} size={16} className="text-foreground" />
                                <Text className="text-foreground">Concise</Text>
                              </View>
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Format</DropdownMenuLabel>
                          <DropdownMenuRadioGroup value={selectedMode} onValueChange={(value) => setSelectedMode(value as AIMode)}>
                            <DropdownMenuRadioItem value="summary">
                              <View className="flex-row items-center gap-2">
                                <Icon as={FileText} size={16} className="text-foreground" />
                                <Text className="text-foreground">Summary</Text>
                              </View>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="key-points">
                              <View className="flex-row items-center gap-2">
                                <Icon as={ListChecks} size={16} className="text-foreground" />
                                <Text className="text-foreground">Key Points</Text>
                              </View>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="list">
                              <View className="flex-row items-center gap-2">
                                <Icon as={List} size={16} className="text-foreground" />
                                <Text className="text-foreground">List</Text>
                              </View>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="table">
                              <View className="flex-row items-center gap-2">
                                <Icon as={Table} size={16} className="text-foreground" />
                                <Text className="text-foreground">Table</Text>
                              </View>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="code">
                              <View className="flex-row items-center gap-2">
                                <Icon as={Code} size={16} className="text-foreground" />
                                <Text className="text-foreground">Code</Text>
                              </View>
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </View>
                    <View className="flex-row items-center justify-end gap-3">
                      <Pressable
                        className="px-4 py-2"
                        onPress={onClose}
                        disabled={isLoading}
                      >
                        <Text className="text-foreground">Cancel</Text>
                      </Pressable>
                      <Pressable
                        className={`rounded-md px-4 py-2 ${prompt.trim() && !isLoading ? "opacity-100" : "opacity-50"}`}
                        onPress={handleGenerate}
                        disabled={!prompt.trim() || isLoading}
                      >
                        <GradientText
                          disabled={!prompt.trim() || isLoading}
                          style={{
                            fontSize: 15,
                            fontWeight: "700",
                          }}
                        >
                          {isLoading ? "Generating..." : "Generate"}
                        </GradientText>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
}
