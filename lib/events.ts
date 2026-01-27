import { UI_DEV } from "@/lib/config";
import * as mockEvents from "@/lib/mock-events";
import * as supabaseEvents from "@/lib/supabase-events";
import * as offlineEvents from "@/lib/offline-events";
import { isOffline } from "@/lib/network-utils";
import type { Event } from "@/lib/supabase";

// Unified events API that switches between mock, Supabase, and offline-aware functions
export const listEvents = async (userId?: string): Promise<Event[]> => {
  if (UI_DEV) {
    return mockEvents.listEvents(userId);
  }
  const offline = await isOffline();
  return offlineEvents.listEvents(userId, offline);
};

export const getEventById = async (id: string): Promise<Event | null> => {
  if (UI_DEV) {
    return mockEvents.getEventById(id);
  }
  const offline = await isOffline();
  return offlineEvents.getEventById(id, offline);
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
  const offline = await isOffline();
  return offlineEvents.createEvent(input, offline);
};

export const updateEvent = async (
  id: string,
  updates: Partial<Pick<Event, "title" | "description" | "event_date" | "repeat_interval">>
): Promise<Event | null> => {
  if (UI_DEV) {
    return mockEvents.updateEvent(id, updates);
  }
  const offline = await isOffline();
  return offlineEvents.updateEvent(id, updates, offline);
};

export const deleteEvent = async (id: string): Promise<void> => {
  console.log("deleteEvent wrapper called, UI_DEV:", UI_DEV, "id:", id);
  if (UI_DEV) {
    return mockEvents.deleteEvent(id);
  }
  const offline = await isOffline();
  return offlineEvents.deleteEvent(id, offline);
};
