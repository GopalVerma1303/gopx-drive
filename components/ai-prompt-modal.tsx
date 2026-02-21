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

interface AIPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, mode?: AIMode) => void;
  initialPrompt?: string;
  isLoading?: boolean;
}

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
                  <Text className="font-semibold text-blue-500">
                    {isLoading ? "Generating..." : "Generate"}
                  </Text>
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
                        <Text className="font-semibold text-blue-500">
                          {isLoading ? "Generating..." : "Generate"}
                        </Text>
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
