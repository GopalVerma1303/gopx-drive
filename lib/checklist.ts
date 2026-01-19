import { UI_DEV } from "@/lib/config";
import * as mockChecklist from "@/lib/mock-checklist";
import * as supabaseChecklist from "@/lib/supabase-checklist";
import type { Checklist, Task } from "@/lib/supabase";

// Unified checklist API that switches between mock and Supabase based on UI_DEV config
export const listChecklists = async (userId?: string): Promise<Checklist[]> => {
  if (UI_DEV) {
    return mockChecklist.listChecklists(userId);
  }
  return supabaseChecklist.listChecklists(userId);
};

export const getChecklistById = async (
  id: string
): Promise<Checklist | null> => {
  if (UI_DEV) {
    return mockChecklist.getChecklistById(id);
  }
  return supabaseChecklist.getChecklistById(id);
};

export const createChecklist = async (input: {
  user_id: string;
  title: string;
}): Promise<Checklist> => {
  if (UI_DEV) {
    return mockChecklist.createChecklist(input);
  }
  return supabaseChecklist.createChecklist(input);
};

export const updateChecklist = async (
  id: string,
  updates: Partial<Pick<Checklist, "title">>
): Promise<Checklist | null> => {
  if (UI_DEV) {
    return mockChecklist.updateChecklist(id, updates);
  }
  return supabaseChecklist.updateChecklist(id, updates);
};

export const deleteChecklist = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockChecklist.deleteChecklist(id);
  }
  return supabaseChecklist.deleteChecklist(id);
};

// Task CRUD
export const listTasks = async (checklistId: string): Promise<Task[]> => {
  if (UI_DEV) {
    return mockChecklist.listTasks(checklistId);
  }
  return supabaseChecklist.listTasks(checklistId);
};

export const getTaskById = async (id: string): Promise<Task | null> => {
  if (UI_DEV) {
    return mockChecklist.getTaskById(id);
  }
  return supabaseChecklist.getTaskById(id);
};

export const createTask = async (input: {
  checklist_id: string;
  title: string;
  order?: number;
  type?: "task" | "date";
  date_value?: string;
}): Promise<Task> => {
  if (UI_DEV) {
    return mockChecklist.createTask(input);
  }
  return supabaseChecklist.createTask(input);
};

export const updateTask = async (
  id: string,
  updates: Partial<Pick<Task, "title" | "completed" | "order" | "type" | "date_value">>
): Promise<Task | null> => {
  if (UI_DEV) {
    return mockChecklist.updateTask(id, updates);
  }
  return supabaseChecklist.updateTask(id, updates);
};

export const deleteTask = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockChecklist.deleteTask(id);
  }
  return supabaseChecklist.deleteTask(id);
};
