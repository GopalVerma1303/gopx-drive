"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from "@/lib/events";
import type { Event } from "@/lib/supabase";
import { THEME } from "@/lib/theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { Calendar as CalendarIcon, Plus, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CalendarScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const {
    data: events = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: () => listEvents(user?.id),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      user_id: string;
      title: string;
      description: string;
      event_date: string;
    }) => createEvent(input),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEventModalOpen(false);
      setEditingEvent(null);
    },
    onError: (error: any) => {
      console.error("Create event error:", error);
      Alert.alert("Error", error.message || "Failed to create event");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<Event, "title" | "description" | "event_date">>;
    }) => updateEvent(id, updates),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEventModalOpen(false);
      setEditingEvent(null);
    },
    onError: (error: any) => {
      console.error("Update event error:", error);
      Alert.alert("Error", error.message || "Failed to update event");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("deleteMutation.mutationFn called with id:", id);
      try {
        await deleteEvent(id);
        console.log("deleteMutation.mutationFn completed successfully");
      } catch (error) {
        console.error("deleteMutation.mutationFn error:", error);
        throw error;
      }
    },
    onMutate: async (id: string) => {
      console.log("deleteMutation.onMutate called with id:", id);
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["events", user?.id] });
      
      // Snapshot the previous value
      const previousEvents = queryClient.getQueryData<Event[]>(["events", user?.id]);
      console.log("Previous events count:", previousEvents?.length || 0);
      
      // Optimistically update to the new value
      if (previousEvents) {
        queryClient.setQueryData<Event[]>(["events", user?.id], (old) => {
          const filtered = old ? old.filter((event) => event.id !== id) : [];
          console.log("Optimistic update - new events count:", filtered.length);
          return filtered;
        });
      }
      
      return { previousEvents };
    },
    onError: (error: any, id: string, context: any) => {
      console.error("deleteMutation.onError called:", error);
      // Rollback to previous value on error
      if (context?.previousEvents) {
        console.log("Rolling back to previous events");
        queryClient.setQueryData(["events", user?.id], context.previousEvents);
      }
      Alert.alert("Error", error.message || "Failed to delete event");
    },
    onSuccess: async (data, id: string) => {
      console.log("deleteMutation.onSuccess called for id:", id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEventModalOpen(false);
      setEditingEvent(null);
      // Invalidate and refetch after a brief delay to ensure DB has processed
      setTimeout(async () => {
        queryClient.invalidateQueries({ queryKey: ["events", user?.id] });
        const result = await refetch();
        console.log("Refetch after delete - events count:", result.data?.length || 0);
      }, 200);
    },
  });

  const handleDeleteEvent = (id: string, title: string) => {
    if (Platform.OS === "web") {
      setEventToDelete({ id, title });
      setDeleteDialogOpen(true);
    } else {
      Alert.alert("Delete Event", `Are you sure you want to delete "${title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            console.log("Deleting event:", id);
            deleteMutation.mutate(id);
          },
        },
      ]);
    }
  };

  const handleDeleteConfirm = () => {
    if (eventToDelete) {
      console.log("Deleting event:", eventToDelete.id);
      deleteMutation.mutate(eventToDelete.id);
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  const handleOpenCreateModal = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setEditingEvent(null);
    setEventModalOpen(true);
  };

  const handleOpenEditModal = (event: Event) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setEditingEvent(event);
    setEventModalOpen(true);
  };

  // Filter events based on search and selected date
  const filteredEvents = events
    .filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (selectedDate) {
        const eventDate = event.event_date.split("T")[0];
        return matchesSearch && eventDate === selectedDate;
      }
      
      // Show only future events if no date is selected
      const eventDate = parseLocalDate(event.event_date.split("T")[0]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return matchesSearch && eventDate >= today;
    })
    .sort((a, b) => {
      // Sort by date first
      const dateA = a.event_date.split("T")[0];
      const dateB = b.event_date.split("T")[0];
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      // If same date, sort by time
      const timeA = a.event_date.includes("T") && a.event_date.split("T")[1]
        ? a.event_date.split("T")[1].substring(0, 5)
        : "12:01";
      const timeB = b.event_date.includes("T") && b.event_date.split("T")[1]
        ? b.event_date.split("T")[1].substring(0, 5)
        : "12:01";
      return timeA.localeCompare(timeB);
    });

  const onRefresh = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await refetch();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <View
      className="flex-1 w-full mx-auto"
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
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
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              Calendar
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Pressable
              onPress={handleOpenCreateModal}
              style={{ padding: 8 }}
            >
              <Plus color={colors.foreground} size={22} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </View>
      <View className="w-full h-full">
        {/* Search Container */}
        <View className="w-full max-w-3xl mx-auto">
          <View className="flex-row items-center mx-4 my-3 px-4 rounded-2xl h-14 border border-border bg-muted">
            <Search
              className="text-muted border-border mr-2"
              color={THEME.light.mutedForeground}
              size={20}
            />
            <Input
              className="flex-1 h-full border-0 bg-transparent px-2 shadow-none"
              placeholder="Search events..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="muted-foreground"
            />
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="foreground" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4 pb-32"
            refreshControl={
              <RefreshControl
                progressBackgroundColor={colors.background}
                refreshing={isFetching}
                onRefresh={onRefresh}
                tintColor={colors.foreground}
                colors={[colors.foreground]}
              />
            }
          >
            {/* Calendar Component */}
            <View className="w-full max-w-2xl mx-auto mb-6">
              <CustomCalendar
                events={events}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            </View>

            {/* Selected Date Indicator */}
            {selectedDate && (
              <View className="w-full max-w-2xl mx-auto mb-4">
                <Pressable
                  onPress={() => setSelectedDate(null)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    backgroundColor: colors.muted,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Showing events for: {formatDateDisplay(selectedDate)}
                  </Text>
                  <X color={colors.mutedForeground} size={18} />
                </Pressable>
              </View>
            )}

            {/* Events List */}
            {filteredEvents.length === 0 ? (
              <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-24">
                <Text className="text-xl font-semibold text-muted-foreground mb-2">
                  {searchQuery || selectedDate
                    ? "No events found"
                    : "No upcoming events"}
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  {searchQuery || selectedDate
                    ? "Try a different search or date"
                    : "Tap the + button to create your first event"}
                </Text>
              </View>
            ) : (
              <View className="w-full max-w-2xl mx-auto">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelectDate={setSelectedDate}
                    onEdit={() => handleOpenEditModal(event)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Event Modal */}
      <EventModal
        open={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        onCreate={createMutation.mutate}
        onUpdate={updateMutation.mutate}
        onDelete={deleteMutation.mutate}
        userId={user?.id || ""}
      />

      {/* Delete Confirmation Dialog */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && eventToDelete && (
          <View
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ position: "absolute" as any }}
              onPress={() => {
                setDeleteDialogOpen(false);
                setEventToDelete(null);
              }}
            />
            <View
              className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg"
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <Text
                className="text-lg font-semibold mb-2"
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                Delete Event
              </Text>
              <Text
                className="text-sm mb-6"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to delete "{eventToDelete.title}"? This
                action cannot be undone.
              </Text>
              <View
                className="flex-row justify-end gap-3"
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  className="px-4 py-2"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => {
                    setDeleteDialogOpen(false);
                    setEventToDelete(null);
                  }}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
                  </Text>
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
          onRequestClose={() => {
            setDeleteDialogOpen(false);
            setEventToDelete(null);
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 16,
              }}
            >
              <Pressable
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onPress={() => {
                  setDeleteDialogOpen(false);
                  setEventToDelete(null);
                }}
              />
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                padding: 24,
                width: "100%",
                maxWidth: 400,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                Delete Event
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to delete "{eventToDelete?.title}"? This
                action cannot be undone.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => {
                    setDeleteDialogOpen(false);
                    setEventToDelete(null);
                  }}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
          </View>
        </Modal>
      )}
    </View>
  );
}

// Custom Calendar Component
interface CustomCalendarProps {
  events: Event[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
}

function CustomCalendar({
  events,
  selectedDate,
  onDateSelect,
}: CustomCalendarProps) {
  const { colors } = useThemeColors();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // const [isExpanded, setIsExpanded] = useState(false);
  // const scrollViewRef = useRef<ScrollView>(null);
  const isExpanded = true; // Always show full calendar

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const hasEventOnDate = (date: Date | null): boolean => {
    if (!date) return false;
    const dateStr = formatDateToLocalString(date);
    return events.some((event) => event.event_date.split("T")[0] === dateStr);
  };

  const isSelected = (date: Date | null): boolean => {
    if (!date || !selectedDate) return false;
    return formatDateToLocalString(date) === selectedDate;
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleDatePress = (date: Date | null) => {
    if (!date) return;
    const dateStr = formatDateToLocalString(date);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (selectedDate === dateStr) {
      onDateSelect(null);
    } else {
      onDateSelect(dateStr);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  // Get all dates in the current month for collapsed view
  const getDatesInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const dates: Date[] = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i));
    }
    return dates;
  };

  // Function to scroll to today's date and center it
  // COMMENTED OUT - Collapsed view functionality
  // const scrollToToday = (animated = true) => {
  //   if (isExpanded || !scrollViewRef.current) return;
  //   
  //   const todayDate = new Date();
  //   todayDate.setHours(0, 0, 0, 0);
  //   const datesInMonth = getDatesInMonth();
  //   
  //   // Check if today is in the current month
  //   const isTodayInCurrentMonth = 
  //     todayDate.getMonth() === currentMonth.getMonth() &&
  //     todayDate.getFullYear() === currentMonth.getFullYear();
  //   
  //   if (!isTodayInCurrentMonth) return;
  //   
  //   const todayIndex = datesInMonth.findIndex((date) => {
  //     return (
  //       date.getDate() === todayDate.getDate() &&
  //       date.getMonth() === todayDate.getMonth() &&
  //       date.getFullYear() === todayDate.getFullYear()
  //     );
  //   });
  //   
  //   if (todayIndex === -1) return;
  //   
  //   // Simple calculation - wait for layout then scroll
  //   setTimeout(() => {
  //     if (!scrollViewRef.current) return;
  //     
  //     // Simple item width calculation: 60px minWidth + 24px padding + 8px gap = 92px
  //     const itemWidth = 92;
  //     const scrollPadding = 4; // ScrollView paddingHorizontal
  //     
  //     // Item position in content
  //     const itemStart = scrollPadding + (todayIndex * itemWidth);
  //     const itemCenter = itemStart + 42; // Half of 84px (actual item width)
  //     
  //     // Get screen width and calculate available space
  //     const screenWidth = Dimensions.get("window").width;
  //     const maxWidth = 672; // max-w-2xl
  //     const cardMargin = 16; // mx-4
  //     const cardPadding = 32; // p-4 (16px on each side)
  //     
  //     // Calculate actual card width
  //     const actualCardWidth = Math.min(screenWidth - (cardMargin * 2), maxWidth);
  //     const availableWidth = actualCardWidth - cardPadding;
  //     
  //     // Scroll to center the item
  //     const scrollX = itemCenter - (availableWidth / 2);
  //     
  //     // Calculate max scroll
  //     const totalContentWidth = scrollPadding + ((datesInMonth.length - 1) * itemWidth) + 84 + scrollPadding;
  //     const maxScroll = Math.max(0, totalContentWidth - availableWidth);
  //     
  //     scrollViewRef.current.scrollTo({
  //       x: Math.max(0, Math.min(scrollX, maxScroll)),
  //       animated,
  //     });
  //   }, 200);
  // };

  const goToToday = () => {
    setCurrentMonth(new Date());
    onDateSelect(null);
    // COMMENTED OUT - Scroll to today in collapsed view
    // setTimeout(() => {
    //   scrollToToday(true);
    // }, 150);
  };

  // COMMENTED OUT - Auto-scroll to today on mount and when month changes (if collapsed and showing current month)
  // useEffect(() => {
  //   if (!isExpanded) {
  //     const todayDate = new Date();
  //     const isCurrentMonth = 
  //       currentMonth.getMonth() === todayDate.getMonth() &&
  //       currentMonth.getFullYear() === todayDate.getFullYear();
  //     
  //     if (isCurrentMonth) {
  //       // Delay to ensure layout is complete
  //       const timer = setTimeout(() => {
  //         scrollToToday(false); // No animation on initial load
  //       }, 400);
  //       return () => clearTimeout(timer);
  //     }
  //   }
  // }, [isExpanded, currentMonth]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // COMMENTED OUT - Toggle expand/collapse functionality
  // const toggleExpand = () => {
  //   if (Platform.OS !== "web") {
  //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  //   }
  //   setIsExpanded(!isExpanded);
  // };

  // COMMENTED OUT - Collapsed view - horizontal scrolling row
  // if (!isExpanded) {
  //   const datesInMonth = getDatesInMonth();
  //   
  //   return (
  //     <Card
  //       className="p-4 rounded-2xl bg-muted border border-border"
  //       style={{
  //         backgroundColor: colors.muted,
  //         borderColor: colors.border,
  //         borderRadius: 16,
  //         padding: 16,
  //       }}
  //     >
  //       {/* Collapsed Header */}
  //       <View
  //         style={{
  //           flexDirection: "row",
  //           alignItems: "center",
  //           justifyContent: "space-between",
  //           marginBottom: 12,
  //         }}
  //       >
  //         <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
  //           <Text
  //             style={{
  //               color: colors.foreground,
  //               fontSize: 18,
  //               fontWeight: "600",
  //             }}
  //           >
  //             {monthName}
  //           </Text>
  //           <Pressable
  //             onPress={goToToday}
  //             style={{
  //               paddingHorizontal: 12,
  //               paddingVertical: 6,
  //               backgroundColor: colors.accent,
  //               borderRadius: 6,
  //             }}
  //           >
  //             <Text
  //               style={{
  //                 color: colors.foreground,
  //                 fontSize: 12,
  //                 fontWeight: "500",
  //               }}
  //             >
  //               Today
  //             </Text>
  //           </Pressable>
  //         </View>
  //         <Pressable
  //           onPress={toggleExpand}
  //           style={{
  //             padding: 8,
  //           }}
  //         >
  //           <ChevronDown color={colors.foreground} size={20} />
  //         </Pressable>
  //       </View>

  //       {/* Horizontal Scrollable Dates */}
  //       <ScrollView
  //         ref={scrollViewRef}
  //         horizontal
  //         showsHorizontalScrollIndicator={false}
  //         contentContainerStyle={{
  //           paddingHorizontal: 4,
  //           gap: 8,
  //         }}
  //       >
  //         {datesInMonth.map((date, index) => {
  //           const hasEvent = hasEventOnDate(date);
  //           const selected = isSelected(date);
  //           const todayDate = isToday(date);
  //           const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

  //           return (
  //             <Pressable
  //               key={index}
  //               onPress={() => handleDatePress(date)}
  //               style={{
  //                 minWidth: 60,
  //                 alignItems: "center",
  //                 paddingVertical: 8,
  //                 paddingHorizontal: 12,
  //                 borderRadius: 8,
  //                 backgroundColor: selected
  //                   ? colors.primary
  //                   : todayDate
  //                   ? colors.accent
  //                   : "transparent",
  //                 borderWidth: todayDate && !selected ? 2 : 0,
  //                 borderColor: colors.primary,
  //               }}
  //             >
  //               <Text
  //                 style={{
  //                   color: selected
  //                     ? colors.primaryForeground
  //                     : todayDate
  //                     ? colors.primary
  //                     : colors.mutedForeground,
  //                   fontSize: 11,
  //                   fontWeight: "500",
  //                   textTransform: "uppercase",
  //                   marginBottom: 4,
  //                 }}
  //               >
  //                 {dayName}
  //               </Text>
  //               <Text
  //                 style={{
  //                   color: selected
  //                     ? colors.primaryForeground
  //                     : todayDate
  //                     ? colors.primary
  //                     : colors.foreground,
  //                   fontSize: 18,
  //                   fontWeight: selected || todayDate ? "700" : "600",
  //                 }}
  //               >
  //                 {date.getDate()}
  //               </Text>
  //               {hasEvent && (
  //                 <View
  //                   style={{
  //                     marginTop: 4,
  //                     width: 4,
  //                     height: 4,
  //                     borderRadius: 2,
  //                     backgroundColor: selected
  //                       ? colors.primaryForeground
  //                       : colors.primary,
  //                   }}
  //                 />
  //               )}
  //             </Pressable>
  //           );
  //         })}
  //       </ScrollView>
  //     </Card>
  //   );
  // }

  // Expanded view - full calendar
  return (
    <Card
      className="p-4 rounded-2xl bg-muted border border-border"
      style={{
        backgroundColor: colors.muted,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Calendar Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Pressable onPress={goToPreviousMonth}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "600",
              padding: 8,
            }}
          >
            ‹
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            {monthName}
          </Text>
          <Pressable
            onPress={goToToday}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: colors.accent,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              Today
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={goToNextMonth}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "600",
              padding: 8,
            }}
          >
            ›
          </Text>
        </Pressable>
      </View>

      {/* Week Days Header */}
      <View
        style={{
          flexDirection: "row",
          marginBottom: 8,
        }}
      >
        {weekDays.map((day) => (
          <View
            key={day}
            style={{
              flex: 1,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
        }}
      >
        {days.map((date, index) => {
          const hasEvent = hasEventOnDate(date);
          const selected = isSelected(date);
          const todayDate = isToday(date);

          return (
            <Pressable
              key={index}
              onPress={() => handleDatePress(date)}
              style={{
                width: "14.28%",
                aspectRatio: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
              }}
            >
              {date ? (
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor: selected
                      ? colors.primary
                      : todayDate
                      ? colors.accent
                      : "transparent",
                    borderWidth: todayDate && !selected ? 2 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text
                    style={{
                      color: selected
                        ? colors.primaryForeground
                        : todayDate
                        ? colors.primary
                        : colors.foreground,
                      fontSize: 14,
                      fontWeight: selected || todayDate ? "600" : "400",
                    }}
                  >
                    {date.getDate()}
                  </Text>
                  {hasEvent && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 2,
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: selected
                          ? colors.primaryForeground
                          : colors.primary,
                      }}
                    />
                  )}
                </View>
              ) : (
                <View />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* COMMENTED OUT - Collapse Button - Bottom Middle */}
      {/* <View
        style={{
          alignItems: "center",
          marginTop: 16,
        }}
      >
        <Pressable
          onPress={toggleExpand}
          style={{
            padding: 8,
          }}
        >
          <ChevronUp color={colors.foreground} size={20} />
        </Pressable>
      </View> */}
    </Card>
  );
}

// Event Card Component
interface EventCardProps {
  event: Event;
  onSelectDate: (date: string) => void;
  onEdit: () => void;
}

function EventCard({ event, onSelectDate, onEdit }: EventCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
    }).start();
  };

  // Parse event date as local date to avoid timezone issues
  const eventDate = parseLocalDate(event.event_date.split("T")[0]);
  const dayName = eventDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayNumber = eventDate.getDate();
  const monthName = eventDate.toLocaleDateString("en-US", { month: "short" });
  
  // Extract time from event_date, default to 12:01 AM if not present
  let eventTime = "12:01 AM";
  if (event.event_date.includes("T") && event.event_date.split("T")[1]) {
    const timePart = event.event_date.split("T")[1];
    const timeMatch = timePart.match(/^(\d{2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      eventTime = `${displayHours}:${minutes} ${period}`;
    }
  }

  const handlePress = () => {
    // Extract date from event and select it
    const eventDateStr = event.event_date.split("T")[0];
    onSelectDate(eventDateStr);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleLongPress = () => {
    onEdit();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card className="p-4 mb-3 rounded-2xl bg-muted border border-border">
          <View
            style={{
              flexDirection: "row",
              gap: 16,
            }}
          >
            {/* Date Section */}
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                minWidth: 60,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 24,
                  fontWeight: "700",
                }}
              >
                {dayNumber}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 12,
                  fontWeight: "500",
                  textTransform: "uppercase",
                }}
              >
                {dayName}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {monthName}
              </Text>
            </View>

            {/* Content Section */}
            <View style={{ flex: 1 }}>
              <Text
                className="text-lg font-semibold text-foreground"
                numberOfLines={1}
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginBottom: 4,
                }}
              >
                {event.title}
              </Text>
              <Text
                className="text-sm text-muted-foreground leading-5"
                numberOfLines={2}
                style={{
                  fontSize: 14,
                  color: colors.mutedForeground,
                  lineHeight: 20,
                  marginBottom: 8,
                }}
              >
                {event.description || "No description"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CalendarIcon
                  color={colors.mutedForeground}
                  size={14}
                  strokeWidth={2}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.mutedForeground,
                  }}
                >
                  {formatDateDisplay(event.event_date)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.mutedForeground,
                    marginLeft: -3,
                  }}
                >
                  • {eventTime}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

// Event Modal Component
interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event: Event | null;
  onCreate: (input: {
    user_id: string;
    title: string;
    description: string;
    event_date: string;
  }) => void;
  onUpdate: (params: {
    id: string;
    updates: Partial<Pick<Event, "title" | "description" | "event_date">>;
  }) => void;
  onDelete: (id: string) => void;
  userId: string;
}

function EventModal({
  open,
  onClose,
  event,
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
  const [dateError, setDateError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Reset form when modal opens/closes or event changes
  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description);
        const dateTimeStr = event.event_date;
        setEventDate(dateTimeStr.split("T")[0]);
        // Extract time if available, convert to 12-hour format, otherwise default to 12:01 AM
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
      } else {
        setTitle("");
        setDescription("");
        setEventDate(formatDateToLocalString(new Date()));
        setEventTime("12:01 AM");
      }
      setDateError("");
      setTimeError("");
    }
  }, [open, event]);

  const validateDate = (dateString: string): boolean => {
    // Check if the date string matches YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    // Parse the date components
    const [year, month, day] = dateString.split("-").map(Number);
    
    // Check if the date is valid
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
    // Check if the time string matches HH:mm AM/PM format (12-hour format)
    const timeRegex = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm)$/;
    return timeRegex.test(timeString);
  };

  const convert12To24Hour = (time12: string): string => {
    // Convert 12-hour format to 24-hour format
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

    // Validate time, use default if empty or invalid
    let finalTime = eventTime.trim();
    if (!finalTime || !validateTime(finalTime)) {
      finalTime = "12:01 AM";
    }

    // Convert 12-hour format to 24-hour format for storage
    const time24Hour = convert12To24Hour(finalTime);

    // Combine date and time into ISO format
    const eventDateTime = `${eventDate}T${time24Hour}:00`;

    if (event) {
      onUpdate({
        id: event.id,
        updates: {
          title: title.trim(),
          description: description.trim(),
          event_date: eventDateTime,
        },
      });
    } else {
      onCreate({
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        event_date: eventDateTime,
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
            console.log("Modal deleting event:", event.id);
            onDelete(event.id);
          },
        },
      ]);
    }
  };

  const handleDeleteConfirm = () => {
    if (event) {
      console.log("Modal deleting event:", event.id);
      onDelete(event.id);
      setDeleteDialogOpen(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {Platform.OS === "web" ? (
    <View
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{
        position: "fixed" as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Pressable
        className="absolute inset-0"
        style={{ position: "absolute" as any }}
        onPress={onClose}
      />
      <View
        className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg"
        style={{
          backgroundColor: colors.muted,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontSize: 20,
            fontWeight: "600",
            marginBottom: 20,
          }}
        >
          {event ? "Edit Event" : "Create Event"}
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "500",
              marginBottom: 8,
            }}
          >
            Title
          </Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.foreground,
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "500",
              marginBottom: 8,
            }}
          >
            Description
          </Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Event description"
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.foreground,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "500",
              marginBottom: 8,
            }}
          >
            Date
          </Text>
          <Input
            value={eventDate}
            onChangeText={handleDateChange}
            placeholder="YYYY-MM-DD"
            style={{
              backgroundColor: colors.background,
              borderColor: dateError ? "#ef4444" : colors.border,
              color: colors.foreground,
            }}
          />
          {dateError ? (
            <Text
              style={{
                color: "#ef4444",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {dateError}
            </Text>
          ) : null}
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "500",
              marginBottom: 8,
            }}
          >
            Time
          </Text>
          <Input
            value={eventTime}
            onChangeText={handleTimeChange}
            placeholder="HH:mm (24-hour format)"
            style={{
              backgroundColor: colors.background,
              borderColor: timeError ? "#ef4444" : colors.border,
              color: colors.foreground,
            }}
          />
          {timeError ? (
            <Text
              style={{
                color: "#ef4444",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {timeError}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {event && (
            <Pressable
              onPress={handleDelete}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 6,
                backgroundColor: "transparent",
              }}
            >
              <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                Delete
              </Text>
            </Pressable>
          )}
          <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
            <Pressable
              onPress={onClose}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: colors.foreground }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: "#3b82f6", fontWeight: "600" }}>Save</Text>
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
        style={{
          flex: 1,
        }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <BlurView
            intensity={20}
            tint="dark"
            style={{
              flex: 1,
              padding: 16,
            }}
          >
            <Pressable
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={onClose}
            />
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
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                padding: 24,
                width: "100%",
                maxWidth: 400,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 20,
                  fontWeight: "600",
                  marginBottom: 20,
                }}
              >
                {event ? "Edit Event" : "Create Event"}
              </Text>

              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                  }}
                >
                  Title
                </Text>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Event title"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  }}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                  }}
                >
                  Description
                </Text>
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Event description"
                  multiline
                  numberOfLines={4}
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <View style={{ marginBottom: 16, marginTop: 40 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                  }}
                >
                  Date
                </Text>
                <Input
                  value={eventDate}
                  onChangeText={handleDateChange}
                  placeholder="YYYY-MM-DD"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: dateError ? "#ef4444" : colors.border,
                    color: colors.foreground,
                  }}
                />
                {dateError ? (
                  <Text
                    style={{
                      color: "#ef4444",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {dateError}
                  </Text>
                ) : null}
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "500",
                    marginBottom: 8,
                  }}
                >
                  Time
                </Text>
                <Input
                  value={eventTime}
                  onChangeText={handleTimeChange}
                  placeholder="HH:mm AM/PM (e.g., 2:30 PM)"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: timeError ? "#ef4444" : colors.border,
                    color: colors.foreground,
                  }}
                />
                {timeError ? (
                  <Text
                    style={{
                      color: "#ef4444",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {timeError}
                  </Text>
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {event && (
                  <Pressable
                    onPress={handleDelete}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 6,
                      backgroundColor: "transparent",
                    }}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                      Delete
                    </Text>
                  </Pressable>
                )}
                <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                  <Pressable
                    onPress={onClose}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: colors.foreground }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: "#3b82f6", fontWeight: "600" }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </BlurView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
      )}

      {/* Delete Confirmation Dialog - EventModal */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && event && (
          <View
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 60,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ position: "absolute" as any }}
              onPress={() => setDeleteDialogOpen(false)}
            />
            <View
              className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg"
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <Text
                className="text-lg font-semibold mb-2"
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                Delete Event
              </Text>
              <Text
                className="text-sm mb-6"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to delete "{event.title}"? This action
                cannot be undone.
              </Text>
              <View
                className="flex-row justify-end gap-3"
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  className="px-4 py-2"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => setDeleteDialogOpen(false)}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
                  </Text>
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
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 16,
              }}
            >
              <Pressable
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onPress={() => setDeleteDialogOpen(false)}
              />
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                borderWidth: 1,
                padding: 24,
                width: "100%",
                maxWidth: 400,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 8,
                }}
              >
                Delete Event
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to delete "{event?.title}"? This action
                cannot be undone.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => setDeleteDialogOpen(false)}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
          </View>
        </Modal>
      )}
    </>
  );
}

// Helper functions
function formatDateToLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString: string): Date {
  // Parse YYYY-MM-DD as local date, not UTC
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateDisplay(dateString: string): string {
  // Parse as local date to avoid timezone issues
  const date = parseLocalDate(dateString.split("T")[0]);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
