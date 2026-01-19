import { Checklist, Task } from "@/lib/supabase";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory checklists and tasks used while building UI without a real database
let checklists: Checklist[] = [
  {
    id: "checklist-1",
    user_id: "demo-user",
    title: "Shopping List",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "checklist-2",
    user_id: "demo-user",
    title: "Project Tasks",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

let tasks: Task[] = [
  {
    id: "task-1",
    checklist_id: "checklist-1",
    title: "Buy groceries",
    completed: false,
    order: 0,
    type: "task",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "task-2",
    checklist_id: "checklist-1",
    title: "Pick up dry cleaning",
    completed: true,
    order: 1,
    type: "task",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "task-3",
    checklist_id: "checklist-2",
    title: "Design mockups",
    completed: false,
    order: 0,
    type: "task",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
];

const generateId = () => `checklist-${Math.random().toString(36).slice(2, 10)}`;
const generateTaskId = () => `task-${Math.random().toString(36).slice(2, 10)}`;

// Checklist CRUD
export const listChecklists = async (userId?: string) => {
  await wait();
  return userId
    ? checklists.filter((checklist) => checklist.user_id === userId)
    : checklists;
};

export const getChecklistById = async (id: string) => {
  await wait();
  return checklists.find((checklist) => checklist.id === id) ?? null;
};

export const createChecklist = async (input: {
  user_id: string;
  title: string;
}) => {
  await wait();
  const now = new Date().toISOString();
  const checklist: Checklist = {
    id: generateId(),
    user_id: input.user_id,
    title: input.title || "Untitled",
    created_at: now,
    updated_at: now,
  };
  checklists = [checklist, ...checklists];
  return checklist;
};

export const updateChecklist = async (
  id: string,
  updates: Partial<Pick<Checklist, "title">>
) => {
  await wait();
  let updated: Checklist | null = null;
  checklists = checklists.map((checklist) => {
    if (checklist.id !== id) return checklist;
    updated = {
      ...checklist,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return updated;
  });
  return updated;
};

export const deleteChecklist = async (id: string) => {
  await wait();
  checklists = checklists.filter((checklist) => checklist.id !== id);
  // Also delete all tasks for this checklist
  tasks = tasks.filter((task) => task.checklist_id !== id);
};

// Task CRUD
export const listTasks = async (checklistId: string) => {
  await wait();
  return tasks
    .filter((task) => task.checklist_id === checklistId)
    .sort((a, b) => a.order - b.order);
};

export const getTaskById = async (id: string) => {
  await wait();
  return tasks.find((task) => task.id === id) ?? null;
};

export const createTask = async (input: {
  checklist_id: string;
  title: string;
  order?: number;
  type?: "task" | "date";
  date_value?: string;
}) => {
  await wait();
  const now = new Date().toISOString();
  
  // If order is not provided, add to the end
  let order = input.order;
  if (order === undefined) {
    const existingTasks = tasks.filter(
      (task) => task.checklist_id === input.checklist_id
    );
    order = existingTasks.length > 0 
      ? Math.max(...existingTasks.map((t) => t.order)) + 1 
      : 0;
  } else {
    // Shift existing tasks with order >= new order
    tasks = tasks.map((task) => {
      if (
        task.checklist_id === input.checklist_id &&
        task.order >= order!
      ) {
        return { ...task, order: task.order + 1 };
      }
      return task;
    });
  }

  const task: Task = {
    id: generateTaskId(),
    checklist_id: input.checklist_id,
    title: input.title || "Untitled",
    completed: false,
    order: order!,
    type: input.type || "task",
    date_value: input.date_value,
    created_at: now,
    updated_at: now,
  };
  tasks = [...tasks, task];
  
  // Update checklist updated_at
  const checklist = checklists.find((c) => c.id === input.checklist_id);
  if (checklist) {
    checklist.updated_at = now;
  }
  
  return task;
};

export const updateTask = async (
  id: string,
  updates: Partial<Pick<Task, "title" | "completed" | "order" | "type" | "date_value">>
) => {
  await wait();
  let updated: Task | null = null;
  const now = new Date().toISOString();
  
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    updated = {
      ...task,
      ...updates,
      updated_at: now,
    };
    return updated;
  });
  
  // Update checklist updated_at
  if (updated) {
    const checklist = checklists.find((c) => c.id === updated.checklist_id);
    if (checklist) {
      checklist.updated_at = now;
    }
  }
  
  return updated;
};

export const deleteTask = async (id: string) => {
  await wait();
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  
  const checklistId = task.checklist_id;
  const taskOrder = task.order;
  
  tasks = tasks.filter((task) => task.id !== id);
  
  // Reorder remaining tasks
  tasks = tasks.map((t) => {
    if (t.checklist_id === checklistId && t.order > taskOrder) {
      return { ...t, order: t.order - 1 };
    }
    return t;
  });
  
  // Update checklist updated_at
  const checklist = checklists.find((c) => c.id === checklistId);
  if (checklist) {
    checklist.updated_at = new Date().toISOString();
  }
};
