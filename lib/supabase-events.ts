import { supabase, type Event } from "@/lib/supabase";

export const listEvents = async (userId?: string): Promise<Event[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .order("event_date", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return data || [];
};

export const getEventById = async (id: string): Promise<Event | null> => {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch event: ${error.message}`);
  }

  return data;
};

export const createEvent = async (input: {
  user_id: string;
  title: string;
  description: string;
  event_date: string;
  repeat_interval?: "once" | "daily" | "weekly" | "monthly" | "yearly" | null;
}): Promise<Event> => {
  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: input.user_id,
      title: input.title || "Untitled Event",
      description: input.description || "",
      event_date: input.event_date,
      repeat_interval: input.repeat_interval || "once",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create event: ${error.message}`);
  }

  return data;
};

export const updateEvent = async (
  id: string,
  updates: Partial<Pick<Event, "title" | "description" | "event_date" | "repeat_interval">>
): Promise<Event | null> => {
  const { data, error } = await supabase
    .from("events")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to update event: ${error.message}`);
  }

  return data;
};

export const deleteEvent = async (id: string): Promise<void> => {
  console.log("deleteEvent called with id:", id);
  
  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .select();

  console.log("Delete result - data:", data, "error:", error);

  if (error) {
    console.error("Delete error details:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to delete event: ${error.message}`);
  }

  console.log("Delete successful, deleted rows:", data?.length || 0);
};
