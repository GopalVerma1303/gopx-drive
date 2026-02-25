"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { formatDateToLocalString } from "@/lib/calendar-utils";
import type { Event } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ChevronDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

export interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event: Event | null;
  prefillDate?: string | null;
  onCreate: (input: {
    user_id: string;
    title: string;
    description: string;
    event_date: string;
    repeat_interval?: "once" | "daily" | "weekly" | "monthly" | "yearly" | null;
  }) => void;
  onUpdate: (params: {
    id: string;
    updates: Partial<Pick<Event, "title" | "description" | "event_date" | "repeat_interval">>;
  }) => void;
  onDelete: (id: string) => void;
  userId: string;
}

export function EventModal({
  open,
  onClose,
  event,
  prefillDate,
  onCreate,
  onUpdate,
  onDelete,
  userId,
}: EventModalProps) {
  const { colors } = useThemeColors();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(
    formatDateToLocalString(new Date())
  );
  const [eventTime, setEventTime] = useState("12:01 AM");
  const [repeatInterval, setRepeatInterval] = useState<"once" | "daily" | "weekly" | "monthly" | "yearly">("once");
  const [dateError, setDateError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description);
        const dateTimeStr = event.event_date;
        setEventDate(dateTimeStr.split("T")[0]);
        if (dateTimeStr.includes("T") && dateTimeStr.split("T")[1]) {
          const timePart = dateTimeStr.split("T")[1];
          const timeMatch = timePart.match(/^(\d{2}):(\d{2})/);
          if (timeMatch) {
            const hours24 = parseInt(timeMatch[1], 10);
            const minutes = timeMatch[2];
            const period = hours24 >= 12 ? "PM" : "AM";
            const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
            setEventTime(`${hours12}:${minutes} ${period}`);
          } else {
            setEventTime("12:01 AM");
          }
        } else {
          setEventTime("12:01 AM");
        }
        setRepeatInterval(event.repeat_interval || "once");
      } else {
        setTitle("");
        setDescription("");
        setEventDate(prefillDate || formatDateToLocalString(new Date()));
        setEventTime("12:01 AM");
        setRepeatInterval("once");
      }
      setDateError("");
      setTimeError("");
    } else {
      setKeyboardVisible(false);
    }
  }, [open, event, prefillDate]);

  useEffect(() => {
    if (Platform.OS === "web" || !open) return;
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [open]);

  const validateDate = (dateString: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  const handleDateChange = (text: string) => {
    setEventDate(text);
    if (text && !validateDate(text)) {
      setDateError("Please enter a valid date (YYYY-MM-DD)");
    } else {
      setDateError("");
    }
  };

  const validateTime = (timeString: string): boolean => {
    const timeRegex = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm)$/;
    return timeRegex.test(timeString);
  };

  const convert12To24Hour = (time12: string): string => {
    const match = time12.match(/^(\d{1,2}):(\d{2})\s?(AM|PM|am|pm)$/);
    if (!match) return "12:01";
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  };

  const handleTimeChange = (text: string) => {
    setEventTime(text);
    if (text && !validateTime(text)) {
      setTimeError("Please enter a valid time (HH:mm AM/PM, 12-hour format)");
    } else {
      setTimeError("");
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }
    if (!validateDate(eventDate)) {
      setDateError("Please enter a valid date (YYYY-MM-DD)");
      return;
    }
    let finalTime = eventTime.trim();
    if (!finalTime || !validateTime(finalTime)) {
      finalTime = "12:01 AM";
    }
    const time24Hour = convert12To24Hour(finalTime);
    const eventDateTime = `${eventDate}T${time24Hour}:00`;

    if (event) {
      onUpdate({
        id: event.id,
        updates: {
          title: title.trim(),
          description: description.trim(),
          event_date: eventDateTime,
          repeat_interval: repeatInterval,
        },
      });
    } else {
      onCreate({
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        event_date: eventDateTime,
        repeat_interval: repeatInterval,
      });
    }
  };

  const handleDelete = () => {
    if (!event) return;
    if (Platform.OS === "web") {
      setDeleteDialogOpen(true);
    } else {
      Alert.alert("Delete Event", `Are you sure you want to delete "${event.title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(event.id);
          },
        },
      ]);
    }
  };

  const handleDeleteConfirm = () => {
    if (event) {
      onDelete(event.id);
      setDeleteDialogOpen(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {Platform.OS === "web" ? (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Pressable className="absolute inset-0" onPress={onClose} />
          <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
            <Text className="mb-5 text-xl font-semibold text-foreground">
              {event ? "Edit Event" : "Create Event"}
            </Text>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-foreground">Title</Text>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                className="border-border bg-background text-foreground"
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-foreground">Description</Text>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Event description"
                multiline
                numberOfLines={4}
                className="min-h-[80px] border-border bg-background py-3 text-foreground"
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-foreground">Date</Text>
              <Input
                value={eventDate}
                onChangeText={handleDateChange}
                placeholder="YYYY-MM-DD"
                className={`border bg-background text-foreground ${dateError ? "border-red-500" : "border-border"}`}
              />
              {dateError ? (
                <Text className="mt-1 text-xs text-red-500">{dateError}</Text>
              ) : null}
            </View>

            <View className="mb-6">
              <Text className="mb-2 text-sm font-medium text-foreground">Time</Text>
              <Input
                value={eventTime}
                onChangeText={handleTimeChange}
                placeholder="HH:mm (24-hour format)"
                className={`border bg-background text-foreground ${timeError ? "border-red-500" : "border-border"}`}
              />
              {timeError ? (
                <Text className="mt-1 text-xs text-red-500">{timeError}</Text>
              ) : null}
            </View>

            <View className="mb-6">
              <Text className="mb-2 text-sm font-medium text-foreground">Repeat</Text>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Pressable className="flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
                    <Text className="text-sm text-foreground">
                      {repeatInterval.charAt(0).toUpperCase() + repeatInterval.slice(1)}
                    </Text>
                    <ChevronDown color={colors.mutedForeground} size={16} />
                  </Pressable>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(["once", "daily", "weekly", "monthly", "yearly"] as const).map((interval) => (
                    <DropdownMenuItem
                      key={interval}
                      onPress={() => setRepeatInterval(interval)}
                    >
                      <Text className="text-foreground">
                        {interval.charAt(0).toUpperCase() + interval.slice(1)}
                      </Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </View>

            <View className="flex-row justify-between gap-3">
              {event && (
                <Pressable
                  onPress={handleDelete}
                  className="rounded-md bg-transparent px-4 py-2.5"
                >
                  <Text className="font-semibold text-red-500">Delete</Text>
                </Pressable>
              )}
              <View className="flex-1 flex-row justify-end gap-3">
                <Pressable onPress={onClose} className="rounded-md px-4 py-2.5">
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSave} className="rounded-md px-4 py-2.5">
                  <Text className="font-semibold text-blue-500">Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <KeyboardAvoidingView
            className="flex-1"
            behavior="padding"
            // Modals cover the full screen and don't sit under a header,
            // so we don't need any extra vertical offset here. Using 0
            // avoids an artificial gap between the keyboard and modal
            // content that can appear in release builds.
            keyboardVerticalOffset={0}
            enabled={keyboardVisible}
          >
            <View className="flex-1 bg-black/50">
              <View className="flex-1 p-4">
                <Pressable className="absolute inset-0" onPress={onClose} />
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 20,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
                    <Text className="mb-5 text-xl font-semibold text-foreground">
                      {event ? "Edit Event" : "Create Event"}
                    </Text>

                    <View className="mb-4">
                      <Text className="mb-2 text-sm font-medium text-foreground">Title</Text>
                      <Input
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Event title"
                        className="border-border bg-background text-foreground"
                      />
                    </View>

                    <View className="mb-4">
                      <Text className="mb-2 text-sm font-medium text-foreground">Description</Text>
                      <Input
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Event description"
                        multiline
                        numberOfLines={4}
                        className="min-h-[80px] border-border bg-background py-3 text-foreground"
                      />
                    </View>

                    <View className="mb-4 mt-10">
                      <Text className="mb-2 text-sm font-medium text-foreground">Date</Text>
                      <Input
                        value={eventDate}
                        onChangeText={handleDateChange}
                        placeholder="YYYY-MM-DD"
                        className={`border bg-background text-foreground ${dateError ? "border-red-500" : "border-border"}`}
                      />
                      {dateError ? (
                        <Text className="mt-1 text-xs text-red-500">{dateError}</Text>
                      ) : null}
                    </View>

                    <View className="mb-6">
                      <Text className="mb-2 text-sm font-medium text-foreground">Time</Text>
                      <Input
                        value={eventTime}
                        onChangeText={handleTimeChange}
                        placeholder="HH:mm AM/PM (e.g., 2:30 PM)"
                        className={`border bg-background text-foreground ${timeError ? "border-red-500" : "border-border"}`}
                      />
                      {timeError ? (
                        <Text className="mt-1 text-xs text-red-500">{timeError}</Text>
                      ) : null}
                    </View>

                    <View className="mb-6">
                      <Text className="mb-2 text-sm font-medium text-foreground">Repeat</Text>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Pressable className="flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
                            <Text className="text-sm text-foreground">
                              {repeatInterval.charAt(0).toUpperCase() + repeatInterval.slice(1)}
                            </Text>
                            <ChevronDown color={colors.mutedForeground} size={16} />
                          </Pressable>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {(["once", "daily", "weekly", "monthly", "yearly"] as const).map((interval) => (
                            <DropdownMenuItem
                              key={interval}
                              onPress={() => setRepeatInterval(interval)}
                            >
                              <Text className="text-foreground">
                                {interval.charAt(0).toUpperCase() + interval.slice(1)}
                              </Text>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </View>

                    <View className="flex-row justify-between gap-3">
                      {event && (
                        <Pressable
                          onPress={handleDelete}
                          className="rounded-md bg-transparent px-4 py-2.5"
                        >
                          <Text className="font-semibold text-red-500">Delete</Text>
                        </Pressable>
                      )}
                      <View className="flex-1 flex-row justify-end gap-3">
                        <Pressable onPress={onClose} className="rounded-md px-4 py-2.5">
                          <Text className="text-foreground">Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handleSave} className="rounded-md px-4 py-2.5">
                          <Text className="font-semibold text-blue-500">Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {Platform.OS === "web" ? (
        deleteDialogOpen && event && (
          <View className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={() => setDeleteDialogOpen(false)} />
            <View className="w-full max-w-md rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">Delete Event</Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to delete "{event.title}"? This action cannot be undone.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable className="px-4 py-2" onPress={() => setDeleteDialogOpen(false)}>
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable className="rounded-md px-4 py-2" onPress={handleDeleteConfirm}>
                  <Text className="font-semibold text-red-500">Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={deleteDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteDialogOpen(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 p-4">
            <Pressable className="absolute inset-0" onPress={() => setDeleteDialogOpen(false)} />
            <View className="w-full max-w-[400px] rounded-lg border border-border bg-muted p-6 shadow-lg">
              <Text className="mb-2 text-lg font-semibold text-foreground">Delete Event</Text>
              <Text className="mb-6 text-sm text-muted-foreground">
                Are you sure you want to delete "{event?.title}"? This action cannot be undone.
              </Text>
              <View className="flex-row justify-end gap-3">
                <Pressable className="px-4 py-2" onPress={() => setDeleteDialogOpen(false)}>
                  <Text className="text-foreground">Cancel</Text>
                </Pressable>
                <Pressable className="rounded-md px-4 py-2" onPress={handleDeleteConfirm}>
                  <Text className="font-semibold text-red-500">Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
