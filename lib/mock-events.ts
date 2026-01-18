import { Event } from "@/lib/supabase";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory events used while building UI without a real database
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const nextWeek = new Date(today);
nextWeek.setDate(nextWeek.getDate() + 7);

let events: Event[] = [
  {
    id: "event-1",
    user_id: "demo-user",
    title: "Team Meeting",
    description: "Weekly team sync to discuss project progress",
    event_date: today.toISOString().split("T")[0],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "event-2",
    user_id: "demo-user",
    title: "Project Deadline",
    description: "Submit final project deliverables",
    event_date: tomorrow.toISOString().split("T")[0],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "event-3",
    user_id: "demo-user",
    title: "Conference Presentation",
    description: "Present research findings at annual conference",
    event_date: nextWeek.toISOString().split("T")[0],
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

const generateId = () => `event-${Math.random().toString(36).slice(2, 10)}`;

export const listEvents = async (userId?: string) => {
  await wait();
  return userId ? events.filter((event) => event.user_id === userId) : events;
};

export const getEventById = async (id: string) => {
  await wait();
  return events.find((event) => event.id === id) ?? null;
};

export const createEvent = async (input: {
  user_id: string;
  title: string;
  description: string;
  event_date: string;
}) => {
  await wait();
  const now = new Date().toISOString();
  const event: Event = {
    id: generateId(),
    user_id: input.user_id,
    title: input.title || "Untitled Event",
    description: input.description || "",
    event_date: input.event_date,
    created_at: now,
    updated_at: now,
  };
  events = [...events, event].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );
  return event;
};

export const updateEvent = async (
  id: string,
  updates: Partial<Pick<Event, "title" | "description" | "event_date">>
) => {
  await wait();
  let updated: Event | null = null;
  events = events.map((event) => {
    if (event.id !== id) return event;
    updated = {
      ...event,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return updated;
  });
  if (updated) {
    events.sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
  }
  return updated;
};

export const deleteEvent = async (id: string) => {
  console.log("mock deleteEvent called with id:", id);
  await wait();
  const beforeCount = events.length;
  events = events.filter((event) => event.id !== id);
  const afterCount = events.length;
  console.log(`Mock delete: ${beforeCount} -> ${afterCount} events`);
};
