"use client";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { parseLocalDate } from "@/lib/calendar-utils";
import type { ExpandedEvent } from "@/lib/calendar-utils";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Animated, Platform, Pressable, View } from "react-native";

const EVENT_DOUBLE_TAP_DELAY_MS = 280;

export interface EventCardProps {
  event: ExpandedEvent;
  onSelectDate: (date: string) => void;
  onEdit: () => void;
}

export function EventCard({ event, onSelectDate, onEdit }: EventCardProps) {
  const { colors } = useThemeColors();
  const scale = new Animated.Value(1);
  const lastTapTime = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const eventDateStr = event.instanceDate || event.event_date.split("T")[0];
  const eventDate = parseLocalDate(eventDateStr);
  const dayName = eventDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayNumber = eventDate.getDate();
  const monthName = eventDate.toLocaleDateString("en-US", { month: "short" });

  const isWeekend = eventDate.getDay() === 0 || eventDate.getDay() === 6;
  const desc = event.description || "";
  const hasHolidayOrLeave =
    event.title.toLowerCase().includes("holiday") ||
    event.title.toLowerCase().includes("leave") ||
    desc.toLowerCase().includes("holiday") ||
    desc.toLowerCase().includes("leave");
  const showRed = isWeekend || hasHolidayOrLeave;

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
    const now = Date.now();
    if (now - lastTapTime.current < EVENT_DOUBLE_TAP_DELAY_MS) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastTapTime.current = 0;
      onEdit();
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      return;
    }
    lastTapTime.current = now;
    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      const dateStr = event.instanceDate || event.event_date.split("T")[0];
      onSelectDate(dateStr);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, EVENT_DOUBLE_TAP_DELAY_MS);
  };

  const handleLongPress = () => {
    if (singleTapTimer.current) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
    }
    lastTapTime.current = 0;
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
        <Card className="p-3 mb-3 rounded-xl bg-muted border border-border">
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
