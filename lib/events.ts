import { UI_DEV } from "@/lib/config";
import * as mockEvents from "@/lib/mock-events";
import * as supabaseEvents from "@/lib/supabase-events";
import type { Event } from "@/lib/supabase";

// Unified events API that switches between mock and Supabase based on UI_DEV config
export const listEvents = async (userId?: string): Promise<Event[]> => {
  if (UI_DEV) {
    return mockEvents.listEvents(userId);
  }
  return supabaseEvents.listEvents(userId);
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
  updates: Partial<Pick<Event, "title" | "description" | "event_date" | "repeat_interval">>
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
