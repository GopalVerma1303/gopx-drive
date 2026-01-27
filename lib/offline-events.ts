import { getCachedData, setCachedData, queueMutation } from "./offline-storage";
import * as eventsApi from "./events";
import type { Event } from "./supabase";

/**
 * Enhanced listEvents with offline support
 */
export async function listEvents(
  userId?: string,
  isOffline: boolean = false
): Promise<Event[]> {
  if (isOffline) {
    const cached = await getCachedData<Event[]>("events");
    if (cached) {
      // Filter by userId if provided
      if (userId) {
        return cached.filter((event) => event.user_id === userId);
      }
      return cached;
    }
    return [];
  }

  try {
    const data = await eventsApi.listEvents(userId);
    await setCachedData("events", data);
    return data;
  } catch (error) {
    // Fallback to cache on error
    const cached = await getCachedData<Event[]>("events");
    if (cached) {
      if (userId) {
        return cached.filter((event) => event.user_id === userId);
      }
      return cached;
    }
    throw error;
  }
}

/**
 * Enhanced getEventById with offline support
 */
export async function getEventById(
  id: string,
  isOffline: boolean = false
): Promise<Event | null> {
  if (isOffline) {
    const cached = await getCachedData<Event[]>("events");
    if (cached) {
      return cached.find((event) => event.id === id) || null;
    }
    return null;
  }

  try {
    const data = await eventsApi.getEventById(id);
    // Update cache if found
    if (data) {
      const cached = await getCachedData<Event[]>("events");
      if (cached) {
        const index = cached.findIndex((event) => event.id === id);
        if (index >= 0) {
          cached[index] = data;
        } else {
          cached.push(data);
        }
        await setCachedData("events", cached);
      }
    }
    return data;
  } catch (error) {
    // Fallback to cache
    const cached = await getCachedData<Event[]>("events");
    if (cached) {
      return cached.find((event) => event.id === id) || null;
    }
    throw error;
  }
}

/**
 * Enhanced createEvent with offline queue support
 */
export async function createEvent(
  input: {
    user_id: string;
    title: string;
    description: string;
    event_date: string;
    repeat_interval?: "once" | "daily" | "weekly" | "monthly" | "yearly" | null;
  },
  isOffline: boolean = false
): Promise<Event> {
  if (isOffline) {
    await queueMutation({
      type: "create",
      resource: "event",
      data: input,
    });
    // Return optimistic response
    return {
      id: `temp_${Date.now()}`,
      user_id: input.user_id,
      title: input.title,
      description: input.description,
      event_date: input.event_date,
      repeat_interval: input.repeat_interval || "once",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const data = await eventsApi.createEvent(input);
    // Update cache
    const cached = await getCachedData<Event[]>("events");
    if (cached) {
      cached.push(data);
      await setCachedData("events", cached);
    }
    return data;
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "create",
      resource: "event",
      data: input,
    });
    throw error;
  }
}

/**
 * Enhanced updateEvent with offline queue support
 */
export async function updateEvent(
  id: string,
  updates: Partial<Pick<Event, "title" | "description" | "event_date" | "repeat_interval">>,
  isOffline: boolean = false
): Promise<Event | null> {
  if (isOffline) {
    const cached = await getCachedData<Event[]>("events");
    const existing = cached?.find((event) => event.id === id);
    
    await queueMutation({
      type: "update",
      resource: "event",
      data: { id, updates },
    });

    // Return optimistic update
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      // Update cache optimistically
      if (cached) {
        const index = cached.findIndex((event) => event.id === id);
        if (index >= 0) {
          cached[index] = updated;
          await setCachedData("events", cached);
        }
      }
      return updated;
    }
    return null;
  }

  try {
    const data = await eventsApi.updateEvent(id, updates);
    // Update cache
    if (data) {
      const cached = await getCachedData<Event[]>("events");
      if (cached) {
        const index = cached.findIndex((event) => event.id === id);
        if (index >= 0) {
          cached[index] = data;
          await setCachedData("events", cached);
        }
      }
    }
    return data;
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "update",
      resource: "event",
      data: { id, updates },
    });
    throw error;
  }
}

/**
 * Enhanced deleteEvent with offline queue support
 */
export async function deleteEvent(
  id: string,
  isOffline: boolean = false
): Promise<void> {
  if (isOffline) {
    await queueMutation({
      type: "delete",
      resource: "event",
      data: { id },
    });
    // Optimistically remove from cache
    const cached = await getCachedData<Event[]>("events");
    if (cached) {
      const filtered = cached.filter((event) => event.id !== id);
      await setCachedData("events", filtered);
    }
    return;
  }

  try {
    await eventsApi.deleteEvent(id);
    // Update cache
    const cached = await getCachedData<Event[]>("events");
    if (cached) {
      const filtered = cached.filter((event) => event.id !== id);
      await setCachedData("events", filtered);
    }
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "delete",
      resource: "event",
      data: { id },
    });
    throw error;
  }
}
