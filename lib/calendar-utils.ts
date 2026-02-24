import type { Event } from "@/lib/supabase";

export function formatDateToLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateDisplay(dateString: string): string {
  const date = parseLocalDate(dateString.split("T")[0]);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface ExpandedEvent extends Event {
  instanceDate: string;
  isRecurring: boolean;
}

function generateRecurringInstances(
  event: Event,
  startDate: Date,
  endDate: Date
): ExpandedEvent[] {
  const instances: ExpandedEvent[] = [];
  const repeatInterval = event.repeat_interval || "once";

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

  const originalDate = parseLocalDate(event.event_date.split("T")[0]);
  const timePart = event.event_date.includes("T") ? event.event_date.split("T")[1] : "00:00:00";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  let currentDate = new Date(originalDate);

  if (currentDate < today) {
    if (repeatInterval === "daily") {
      const daysDiff = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      currentDate = new Date(originalDate);
      currentDate.setDate(currentDate.getDate() + daysDiff);
    } else if (repeatInterval === "weekly") {
      const weeksDiff = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      currentDate = new Date(originalDate);
      currentDate.setDate(currentDate.getDate() + weeksDiff * 7);
    } else if (repeatInterval === "monthly") {
      const monthsDiff =
        (today.getFullYear() - currentDate.getFullYear()) * 12 +
        (today.getMonth() - currentDate.getMonth());
      currentDate = new Date(originalDate);
      currentDate.setMonth(currentDate.getMonth() + monthsDiff);
    } else if (repeatInterval === "yearly") {
      const yearsDiff = today.getFullYear() - currentDate.getFullYear();
      currentDate = new Date(originalDate);
      currentDate.setFullYear(currentDate.getFullYear() + yearsDiff);
    }

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

  const maxEndDate = new Date(today);
  maxEndDate.setFullYear(maxEndDate.getFullYear() + 1);
  const actualEndDate = endDate < maxEndDate ? endDate : maxEndDate;

  let instanceCount = 0;
  const maxInstances = 500;

  while (currentDate <= actualEndDate && instanceCount < maxInstances) {
    const dateStr = formatDateToLocalString(currentDate);
    const instanceDateTime = `${dateStr}T${timePart}`;

    instances.push({
      ...event,
      event_date: instanceDateTime,
      instanceDate: dateStr,
      isRecurring: true,
    });

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

export function expandEventsIntoInstances(
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

function sortEventsByTime(list: ExpandedEvent[]): ExpandedEvent[] {
  return [...list].sort((a, b) => {
    const timeA =
      a.event_date.includes("T") && a.event_date.split("T")[1]
        ? a.event_date.split("T")[1].substring(0, 5)
        : "00:00";
    const timeB =
      b.event_date.includes("T") && b.event_date.split("T")[1]
        ? b.event_date.split("T")[1].substring(0, 5)
        : "00:00";
    return timeA.localeCompare(timeB);
  });
}

/** Returns today's events (expanded for recurring), sorted by time. */
export function getTodaysEvents(events: Event[]): ExpandedEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const expanded = expandEventsIntoInstances(events, today, todayEnd);
  const todayStr = formatDateToLocalString(today);
  const forToday = expanded.filter((e) => (e.instanceDate || e.event_date.split("T")[0]) === todayStr);
  return sortEventsByTime(forToday);
}

/** Returns today's and tomorrow's events (expanded for recurring), each sorted by time. */
export function getTodaysAndTomorrowsEvents(events: Event[]): {
  today: ExpandedEvent[];
  tomorrow: ExpandedEvent[];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const expanded = expandEventsIntoInstances(events, today, tomorrowEnd);
  const todayStr = formatDateToLocalString(today);
  const tomorrowStr = formatDateToLocalString(tomorrow);
  const forToday = expanded.filter((e) => (e.instanceDate || e.event_date.split("T")[0]) === todayStr);
  const forTomorrow = expanded.filter((e) => (e.instanceDate || e.event_date.split("T")[0]) === tomorrowStr);
  return {
    today: sortEventsByTime(forToday),
    tomorrow: sortEventsByTime(forTomorrow),
  };
}

/** Format event time from event_date (e.g. "14:30"). */
export function formatEventTime(eventDate: string): string {
  if (eventDate.includes("T") && eventDate.split("T")[1]) {
    return eventDate.split("T")[1].substring(0, 5);
  }
  return "All day";
}
