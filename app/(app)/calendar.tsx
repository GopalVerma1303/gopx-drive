"use client";

import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { invalidateEventsQueries, debounce } from "@/lib/query-utils";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { ChevronDown, ChevronUp, Plus, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CalendarScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Track previous month to detect month changes
  const previousMonthRef = useRef<string | null>(null);

  const {
    data: events = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    // Stable key so calendar stays visible when month changes (we refetch in background, keep showing previous data)
    queryKey: ["events", user?.id],
    queryFn: () => listEvents(user?.id),
    refetchOnMount: false, // Don't block on mount - use cache first
    refetchOnWindowFocus: false,
    staleTime: Infinity, // Don't auto-refetch based on stale time - we'll refetch manually on month change
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    // Use cached data immediately, don't show loading if we have cache
    placeholderData: (previousData) => previousData,
    // Don't throw errors on network failures - use cache instead
    retry: false,
    retryOnMount: false,
  });

  // Debounced refetch to avoid rapid API calls when scrolling through months quickly
  const debouncedRefetch = useRef(
    debounce(() => {
      refetch().catch(() => {
        // Refetch failed, but UI already shows cached data
      });
    }, 300) // 300ms debounce delay
  ).current;

  // Refetch events when month changes (non-blocking, debounced)
  useEffect(() => {
    if (!user?.id) return;

    const currentMonthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
    const previousMonthKey = previousMonthRef.current;

    // Skip refetch on initial mount - use cached data
    if (previousMonthKey === null) {
      previousMonthRef.current = currentMonthKey;
      // Try to refetch in background without blocking
      refetch().catch(() => {
        // Refetch failed, but UI already shows cached data
      });
      return;
    }

    // Refetch only if month actually changed (non-blocking, debounced)
    if (previousMonthKey !== currentMonthKey) {
      previousMonthRef.current = currentMonthKey;
      debouncedRefetch();
    }
  }, [currentMonth, user?.id, refetch, debouncedRefetch]);

  const createMutation = useMutation({
    mutationFn: (input: {
      user_id: string;
      title: string;
      description: string;
      event_date: string;
      repeat_interval?: "once" | "daily" | "weekly" | "monthly" | "yearly" | null;
    }) => createEvent(input),
    onSuccess: () => {
      invalidateEventsQueries(queryClient, user?.id);
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
      updates: Partial<Pick<Event, "title" | "description" | "event_date" | "repeat_interval">>;
    }) => updateEvent(id, updates),
    onSuccess: () => {
      invalidateEventsQueries(queryClient, user?.id);
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
      const eventsQueryKey = ["events", user?.id];
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: eventsQueryKey });

      // Snapshot the previous value
      const previousEvents = queryClient.getQueryData<Event[]>(eventsQueryKey);
      console.log("Previous events count:", previousEvents?.length || 0);

      // Optimistically update to the new value
      if (previousEvents) {
        queryClient.setQueryData<Event[]>(eventsQueryKey, (old) => {
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
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      // Invalidate after a brief delay to ensure DB has processed
      setTimeout(() => {
        invalidateEventsQueries(queryClient, user?.id);
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

  // Expand events into recurring instances (memoized to prevent unnecessary recalculations)
  // Include events from 1 year ago to 1 year ahead to show past, present, and future events in calendar
  const expandedEvents = useMemo(() => {
    if (events.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 1); // Include events from 1 year ago
    const endDate = new Date(today);
    endDate.setFullYear(endDate.getFullYear() + 1); // Show events up to 1 year ahead

    return expandEventsIntoInstances(events, startDate, endDate);
  }, [events]); // Only recalculate when events array changes

  // Get the start and end of the current month being displayed (memoized)
  const { monthStart, monthEnd, today } = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { monthStart: start, monthEnd: end, today: todayDate };
  }, [currentMonth]);

  // Filter events based on search, selected date, and current month (memoized)
  const filteredEvents = useMemo(() => {
    const now = new Date(); // Current date and time

    return expandedEvents
      .filter((event) => {
        const matchesSearch =
          event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.description.toLowerCase().includes(searchQuery.toLowerCase());

        if (selectedDate) {
          const eventDate = event.instanceDate || event.event_date.split("T")[0];
          // For selected date, show ALL events for that date (both past and future)
          if (eventDate === selectedDate) {
            return matchesSearch;
          }
          return false;
        }

        // Parse the full event datetime (date + time)
        const eventDateTime = new Date(event.event_date);

        // Check if event is in the current month
        const eventDate = parseLocalDate(event.instanceDate || event.event_date.split("T")[0]);
        const eventDateObj = new Date(eventDate);
        eventDateObj.setHours(0, 0, 0, 0);
        const isInCurrentMonth = eventDateObj >= monthStart && eventDateObj <= monthEnd;

        // Only show events that are in the current month and datetime is in the future
        const isUpcoming = eventDateTime > now;

        return matchesSearch && isInCurrentMonth && isUpcoming;
      })
      .sort((a, b) => {
        // Sort by date first
        const dateA = a.instanceDate || a.event_date.split("T")[0];
        const dateB = b.instanceDate || b.event_date.split("T")[0];
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
  }, [expandedEvents, searchQuery, selectedDate, monthStart, monthEnd, today]);

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
          {/* Calendar always visible */}
          <View className="w-full max-w-2xl mx-auto mb-6">
            <CustomCalendar
                events={expandedEvents}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
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
            {isLoading ? (
              <View className="w-full max-w-2xl mx-auto flex-1 justify-center items-center pt-12">
                <ActivityIndicator size="small" color={colors.foreground} />
                <Text className="text-sm text-muted-foreground mt-2">
                  Loading events...
                </Text>
              </View>
            ) : filteredEvents.length === 0 ? (
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
                {filteredEvents.map((event, index) => (
                  <EventCard
                    key={`${event.id}-${event.instanceDate || event.event_date.split("T")[0]}-${index}`}
                    event={event}
                    onSelectDate={setSelectedDate}
                    onEdit={() => {
                      // Find the original event (not the instance) for editing
                      const originalEvent = events.find(e => e.id === event.id);
                      if (originalEvent) {
                        handleOpenEditModal(originalEvent);
                      }
                    }}
                  />
                ))}
              </View>
            )}
        </ScrollView>
      </View>

      {/* Event Modal */}
      <EventModal
        open={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        prefillDate={selectedDate}
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
  events: ExpandedEvent[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
}

function CustomCalendar({
  events,
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
}: CustomCalendarProps) {
  const { colors } = useThemeColors();
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const itemLayoutsRef = useRef<Map<number, { x: number; width: number }>>(new Map());
  const scrollViewLayoutRef = useRef<{ width: number } | null>(null);
  const pendingScrollRef = useRef<{ targetIndex: number; animated: boolean } | null>(null);
  const animateNextScrollRef = useRef(false);

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
    return events.some((event) => {
      const eventDate = event.instanceDate || event.event_date.split("T")[0];
      return eventDate === dateStr;
    });
  };

  const isWeekend = (date: Date | null): boolean => {
    if (!date) return false;
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday (0) or Saturday (6)
  };

  const hasHolidayOrLeaveEvent = (date: Date | null): boolean => {
    if (!date) return false;
    const dateStr = formatDateToLocalString(date);
    return events.some((event) => {
      const eventDate = event.instanceDate || event.event_date.split("T")[0];
      if (eventDate === dateStr) {
        const titleLower = event.title.toLowerCase();
        const descriptionLower = (event.description || "").toLowerCase();
        return (
          titleLower.includes("holiday") ||
          titleLower.includes("leave") ||
          descriptionLower.includes("holiday") ||
          descriptionLower.includes("leave")
        );
      }
      return false;
    });
  };

  const shouldShowRedText = (date: Date | null): boolean => {
    if (!date) return false;
    return isWeekend(date) || hasHolidayOrLeaveEvent(date);
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
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    onMonthChange(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    onMonthChange(newMonth);
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

  // Function to perform the actual scroll
  const performScroll = (targetIndex: number, animated: boolean) => {
    if (!scrollViewRef.current) return;

    const itemLayout = itemLayoutsRef.current.get(targetIndex);

    if (itemLayout) {
      // Use measured layout for accurate scrolling
      // The x position from onLayout is relative to the ScrollView content container
      // We want to scroll so the item appears at the start (accounting for padding)
      const paddingHorizontal = 4;
      const scrollX = Math.max(0, itemLayout.x - paddingHorizontal);
      scrollViewRef.current.scrollTo({
        x: scrollX,
        animated,
      });
      pendingScrollRef.current = null;
    } else {
      // Fallback to estimated calculation
      // Item width: minWidth 60 + paddingHorizontal 12*2 = 84, plus gap 8 = 92
      const estimatedItemWidth = 84;
      const gap = 8;
      const paddingHorizontal = 4;

      // Calculate position: padding + (index * (itemWidth + gap))
      const itemStart = paddingHorizontal + (targetIndex * (estimatedItemWidth + gap));

      scrollViewRef.current.scrollTo({
        x: Math.max(0, itemStart - paddingHorizontal),
        animated,
      });
      pendingScrollRef.current = null;
    }
  };

  // Function to scroll to optimal position based on current date
  const scrollToOptimalPosition = (animated = true, retryCount = 0) => {
    if (isExpanded || !scrollViewRef.current) return;

    const datesInMonth = getDatesInMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today is in the current month
    const isTodayInCurrentMonth =
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear();

    let targetIndex = 0; // Default to day 1

    if (isTodayInCurrentMonth) {
      // Find today's date index in the dates array
      const todayDate = today.getDate();
      targetIndex = datesInMonth.findIndex(
        (date) => date.getDate() === todayDate
      );
      // If not found (shouldn't happen), default to 0
      if (targetIndex === -1) {
        targetIndex = 0;
      }
    } else {
      // For non-current months, start with the first date
      targetIndex = 0;
    }

    // Store pending scroll
    pendingScrollRef.current = { targetIndex, animated };

    // Try to scroll immediately
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!pendingScrollRef.current || !scrollViewRef.current) return;

        const itemLayout = itemLayoutsRef.current.get(targetIndex);

        // If layout is not ready and we haven't retried too many times, retry
        if (!itemLayout && retryCount < 5) {
          setTimeout(() => {
            scrollToOptimalPosition(animated, retryCount + 1);
          }, 50);
          return;
        }

        // Perform the scroll
        performScroll(pendingScrollRef.current.targetIndex, pendingScrollRef.current.animated);
      });
    });
  };

  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if we're already on the current month
    const isAlreadyOnCurrentMonth =
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear();

    // Mark that the next auto-scroll should be animated
    animateNextScrollRef.current = true;
    onDateSelect(null);

    // Always update month (even if same) to ensure consistency
    onMonthChange(today);

    // If already on current month and collapsed, trigger scroll immediately
    // This handles the case where useEffect doesn't run because month didn't change
    if (isAlreadyOnCurrentMonth && !isExpanded) {
      // Clear layouts to force re-measurement
      itemLayoutsRef.current.clear();
      scrollViewLayoutRef.current = null;

      // Trigger scroll with retry mechanism built into scrollToOptimalPosition
      setTimeout(() => {
        scrollToOptimalPosition(true);
      }, 150);
    }
  };

  // Auto-scroll to optimal position when month changes (if collapsed)
  useEffect(() => {
    if (!isExpanded) {
      // Clear previous layouts when month changes
      itemLayoutsRef.current.clear();
      scrollViewLayoutRef.current = null;

      // Delay to ensure layout is complete
      const timer = setTimeout(() => {
        // Use animated scroll if triggered via the Today button
        const animated = animateNextScrollRef.current;
        animateNextScrollRef.current = false;
        scrollToOptimalPosition(animated); // Animate only when explicitly requested
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, currentMonth]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Toggle expand/collapse functionality
  const toggleExpand = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsExpanded(!isExpanded);
  };

  // Collapsed view - horizontal scrolling row
  if (!isExpanded) {
    const datesInMonth = getDatesInMonth();

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
        {/* Collapsed Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
            <Text
              style={{
                color: colors.foreground,
                fontSize: 18,
                fontWeight: "600",
                minWidth: 120,
                textAlign: "center",
              }}
            >
              {monthName}
            </Text>
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
          <Pressable
            onPress={toggleExpand}
            style={{
              padding: 8,
            }}
          >
            <ChevronDown color={colors.foreground} size={20} />
          </Pressable>
        </View>

        {/* Horizontal Scrollable Dates */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 4,
            gap: 8,
          }}
          onLayout={(e) => {
            scrollViewLayoutRef.current = { width: e.nativeEvent.layout.width };
          }}
          onContentSizeChange={() => {
            // When content size changes, try to perform pending scroll
            if (pendingScrollRef.current) {
              requestAnimationFrame(() => {
                if (pendingScrollRef.current) {
                  performScroll(pendingScrollRef.current.targetIndex, pendingScrollRef.current.animated);
                }
              });
            }
          }}
        >
          {datesInMonth.map((date, index) => {
            const hasEvent = hasEventOnDate(date);
            const selected = isSelected(date);
            const todayDate = isToday(date);
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            const showRed = shouldShowRedText(date);

            return (
              <Pressable
                key={index}
                onPress={() => handleDatePress(date)}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  itemLayoutsRef.current.set(index, { x, width });
                }}
                style={{
                  minWidth: 60,
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
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
                      : showRed
                        ? "#ef4444"
                        : todayDate
                          ? colors.primary
                          : colors.mutedForeground,
                    fontSize: 11,
                    fontWeight: "500",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {dayName}
                </Text>
                <Text
                  style={{
                    color: selected
                      ? colors.primaryForeground
                      : showRed
                        ? "#ef4444"
                        : todayDate
                          ? colors.primary
                          : colors.foreground,
                    fontSize: 18,
                    fontWeight: selected || todayDate ? "700" : "600",
                  }}
                >
                  {date.getDate()}
                </Text>
                {hasEvent && (
                  <View
                    style={{
                      marginTop: 4,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: selected
                        ? colors.primaryForeground
                        : colors.primary,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>
    );
  }

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
        {weekDays.map((day) => {
          const isWeekendDay = day === "Sat" || day === "Sun";
          return (
            <View
              key={day}
              style={{
                flex: 1,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: isWeekendDay ? "#ef4444" : colors.mutedForeground,
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                {day}
              </Text>
            </View>
          );
        })}
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
          const showRed = shouldShowRedText(date);

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
                        : showRed
                          ? "#ef4444"
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

      {/* Collapse Button - Bottom Middle */}
      <View
        style={{
          alignItems: "center",
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
      </View>
    </Card>
  );
}

// Event Card Component
interface EventCardProps {
  event: ExpandedEvent;
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
  const eventDateStr = event.instanceDate || event.event_date.split("T")[0];
  const eventDate = parseLocalDate(eventDateStr);
  const dayName = eventDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayNumber = eventDate.getDate();
  const monthName = eventDate.toLocaleDateString("en-US", { month: "short" });

  // Check if should show red text (weekend or holiday/leave event)
  const isWeekend = eventDate.getDay() === 0 || eventDate.getDay() === 6; // Sunday (0) or Saturday (6)
  const hasHolidayOrLeave = event.title.toLowerCase().includes("holiday") || event.title.toLowerCase().includes("leave") || event.description.toLowerCase().includes("holiday") || event.description.toLowerCase().includes("leave");
  const showRed = isWeekend || hasHolidayOrLeave;

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
    const eventDateStr = event.instanceDate || event.event_date.split("T")[0];
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
        <Card className="p-3 mb-2 rounded-xl bg-muted border border-border">
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
            }}
          >
            {/* Date Section - More Compact */}
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                minWidth: 50,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  color: showRed ? "#ef4444" : colors.primary,
                  fontSize: 20,
                  fontWeight: "700",
                  lineHeight: 24,
                }}
              >
                {dayNumber}
              </Text>
              <Text
                style={{
                  color: showRed ? "#ef4444" : colors.mutedForeground,
                  fontSize: 11,
                  fontWeight: "500",
                  textTransform: "uppercase",
                  marginTop: 1,
                }}
              >
                {dayName}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 10,
                  marginTop: 1,
                }}
              >
                {monthName}
              </Text>
            </View>

            {/* Content Section - More Compact */}
            <View style={{ flex: 1 }}>
              <Text
                className="text-base font-semibold text-foreground"
                numberOfLines={1}
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.foreground,
                  marginBottom: 2,
                  lineHeight: 20,
                }}
              >
                {event.title}
              </Text>
              <Text
                className="text-sm text-muted-foreground"
                numberOfLines={2}
                style={{
                  fontSize: 13,
                  color: colors.mutedForeground,
                  lineHeight: 18,
                  marginBottom: 4,
                }}
              >
                {event.description || "No description"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.mutedForeground,
                    textTransform: "capitalize",
                  }}
                >
                  {event.repeat_interval || "once"}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.mutedForeground,
                    marginLeft: -2,
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

function EventModal({
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

  // Only enable KeyboardAvoidingView when keyboard is visible; avoids extra space / shifted layout when keyboard closes
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

            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 8,
                }}
              >
                Repeat
              </Text>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Pressable
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 14 }}>
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
                      <Text style={{ color: colors.foreground }}>
                        {interval.charAt(0).toUpperCase() + interval.slice(1)}
                      </Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            enabled={keyboardVisible}
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

                    <View style={{ marginBottom: 24 }}>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          fontWeight: "500",
                          marginBottom: 8,
                        }}
                      >
                        Repeat
                      </Text>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Pressable
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              backgroundColor: colors.background,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ color: colors.foreground, fontSize: 14 }}>
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
                              <Text style={{ color: colors.foreground }}>
                                {interval.charAt(0).toUpperCase() + interval.slice(1)}
                              </Text>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

// Generate recurring event instances
interface ExpandedEvent extends Event {
  instanceDate: string; // The date this instance occurs on
  isRecurring: boolean; // Whether this is a recurring instance
}

function generateRecurringInstances(
  event: Event,
  startDate: Date,
  endDate: Date
): ExpandedEvent[] {
  const instances: ExpandedEvent[] = [];
  const repeatInterval = event.repeat_interval || "once";

  // If it's a one-time event, just return the original event if it's in range
  if (repeatInterval === "once") {
    const eventDate = parseLocalDate(event.event_date.split("T")[0]);
    if (eventDate >= startDate && eventDate <= endDate) {
      instances.push({
        ...event,
        instanceDate: event.event_date.split("T")[0],
        isRecurring: false,
      });
    }
    return instances;
  }

  // Parse the original event date
  const originalDate = parseLocalDate(event.event_date.split("T")[0]);
  const timePart = event.event_date.includes("T") ? event.event_date.split("T")[1] : "00:00:00";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // For recurring events, include the original event date if it's in the past (before today)
  // This ensures past recurring events are visible in the calendar
  // We skip adding it if it's today or future since those will be generated below
  if (originalDate >= startDate && originalDate < today) {
    const dateStr = formatDateToLocalString(originalDate);
    const instanceDateTime = `${dateStr}T${timePart}`;
    instances.push({
      ...event,
      event_date: instanceDateTime,
      instanceDate: dateStr,
      isRecurring: true,
    });
  }

  // Generate instances based on repeat interval
  let currentDate = new Date(originalDate);

  // For past events, start from today or the original date (whichever is later)
  if (currentDate < today) {
    // Calculate how many intervals have passed
    if (repeatInterval === "daily") {
      const daysDiff = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDate = new Date(originalDate);
      currentDate.setDate(currentDate.getDate() + daysDiff);
    } else if (repeatInterval === "weekly") {
      const weeksDiff = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      currentDate = new Date(originalDate);
      currentDate.setDate(currentDate.getDate() + (weeksDiff * 7));
    } else if (repeatInterval === "monthly") {
      const monthsDiff = (today.getFullYear() - currentDate.getFullYear()) * 12 + (today.getMonth() - currentDate.getMonth());
      currentDate = new Date(originalDate);
      currentDate.setMonth(currentDate.getMonth() + monthsDiff);
    } else if (repeatInterval === "yearly") {
      const yearsDiff = today.getFullYear() - currentDate.getFullYear();
      currentDate = new Date(originalDate);
      currentDate.setFullYear(currentDate.getFullYear() + yearsDiff);
    }

    // Make sure we're at or after today
    while (currentDate < today) {
      if (repeatInterval === "daily") {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (repeatInterval === "weekly") {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (repeatInterval === "monthly") {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (repeatInterval === "yearly") {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      }
    }
  }

  // Generate instances up to endDate (or 1 year ahead, whichever is smaller)
  const maxEndDate = new Date(today);
  maxEndDate.setFullYear(maxEndDate.getFullYear() + 1);
  const actualEndDate = endDate < maxEndDate ? endDate : maxEndDate;

  let instanceCount = 0;
  const maxInstances = 500; // Safety limit to prevent infinite loops

  while (currentDate <= actualEndDate && instanceCount < maxInstances) {
    const dateStr = formatDateToLocalString(currentDate);
    const instanceDateTime = `${dateStr}T${timePart}`;

    instances.push({
      ...event,
      event_date: instanceDateTime,
      instanceDate: dateStr,
      isRecurring: true,
    });

    // Move to next occurrence
    if (repeatInterval === "daily") {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (repeatInterval === "weekly") {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (repeatInterval === "monthly") {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (repeatInterval === "yearly") {
      currentDate.setFullYear(currentDate.getFullYear() + 1);
    }

    instanceCount++;
  }

  return instances;
}

// Expand events into recurring instances for a given date range
function expandEventsIntoInstances(
  events: Event[],
  startDate: Date,
  endDate: Date
): ExpandedEvent[] {
  const expandedEvents: ExpandedEvent[] = [];

  for (const event of events) {
    const instances = generateRecurringInstances(event, startDate, endDate);
    expandedEvents.push(...instances);
  }

  return expandedEvents;
}
