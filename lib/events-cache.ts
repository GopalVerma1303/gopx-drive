/**
 * Events cache: persist all events in AsyncStorage so the calendar
 * can show this month's events when offline (UI filters to current month).
 */

import type { Event } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const EVENTS_CACHE_PREFIX = "@events_cache";
const EVENTS_FULL_KEY = "@events_full";

function fullKey(userId: string): string {
  return `${EVENTS_CACHE_PREFIX}:${EVENTS_FULL_KEY}:${userId}`;
}

function monthKey(userId: string, year: number, month: number): string {
  const mm = String(month + 1).padStart(2, "0");
  return `${EVENTS_CACHE_PREFIX}:${userId}:${year}-${mm}`;
}

/** Get full cached event list (used when offline). */
export async function getCachedEvents(userId: string): Promise<Event[]> {
  try {
    const raw = await AsyncStorage.getItem(fullKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Event[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist full event list after a successful fetch. */
export async function setCachedEvents(
  userId: string,
  events: Event[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(fullKey(userId), JSON.stringify(events));
  } catch (e) {
    console.error("Failed to cache events:", e);
  }
}

export async function getCachedEventsForMonth(
  userId: string,
  year: number,
  month: number
): Promise<Event[]> {
  try {
    const raw = await AsyncStorage.getItem(monthKey(userId, year, month));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Event[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedEventsForMonth(
  userId: string,
  year: number,
  month: number,
  events: Event[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      monthKey(userId, year, month),
      JSON.stringify(events)
    );
  } catch (e) {
    console.error("Failed to cache events for month:", e);
  }
}
