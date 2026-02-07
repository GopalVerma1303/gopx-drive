import { UI_DEV } from "@/lib/config";
import { getCachedEvents, setCachedEvents } from "@/lib/events-cache";
import * as mockEvents from "@/lib/mock-events";
import type { Event } from "@/lib/supabase";
import * as supabaseEvents from "@/lib/supabase-events";

// Unified events API. When offline, returns full cached event list so calendar can show all events (including current month).
export const listEvents = async (userId?: string): Promise<Event[]> => {
  if (UI_DEV) {
    return mockEvents.listEvents(userId);
  }
  if (!userId) return [];
  try {
    const events = await supabaseEvents.listEvents(userId);
    await setCachedEvents(userId, events);
    return events;
  } catch {
    return getCachedEvents(userId);
  }
};

export const getEventById = async (id: string): Promise<Event | null> => {
  if (UI_DEV) {
    return mockEvents.getEventById(id);
  }
  return supabaseEvents.getEventById(id);
};

export const createEvent = async (input: {
  user_id: string;
  title: string;
  description: string;
  event_date: string;
  repeat_interval?: "once" | "daily" | "weekly" | "monthly" | "yearly" | null;
}): Promise<Event> => {
  if (UI_DEV) {
    return mockEvents.createEvent(input);
  }
  return supabaseEvents.createEvent(input);
};

export const updateEvent = async (
  id: string,
  updates: Partial<
    Pick<Event, "title" | "description" | "event_date" | "repeat_interval">
  >
): Promise<Event | null> => {
  if (UI_DEV) {
    return mockEvents.updateEvent(id, updates);
  }
  return supabaseEvents.updateEvent(id, updates);
};

export const deleteEvent = async (id: string): Promise<void> => {
  console.log("deleteEvent wrapper called, UI_DEV:", UI_DEV, "id:", id);
  if (UI_DEV) {
    return mockEvents.deleteEvent(id);
  }
  return supabaseEvents.deleteEvent(id);
};
