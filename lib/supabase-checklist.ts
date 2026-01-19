import { supabase, type Checklist, type Task } from "@/lib/supabase";

export const listChecklists = async (userId?: string): Promise<Checklist[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch checklists: ${error.message}`);
  }

  return data || [];
};

export const getChecklistById = async (id: string): Promise<Checklist | null> => {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch checklist: ${error.message}`);
  }

  return data;
};

export const createChecklist = async (input: {
  user_id: string;
  title: string;
}): Promise<Checklist> => {
  const { data, error } = await supabase
    .from("checklists")
    .insert({
      user_id: input.user_id,
      title: input.title || "Untitled",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create checklist: ${error.message}`);
  }

  return data;
};

export const updateChecklist = async (
  id: string,
  updates: Partial<Pick<Checklist, "title">>
): Promise<Checklist | null> => {
  const { data, error } = await supabase
    .from("checklists")
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
    throw new Error(`Failed to update checklist: ${error.message}`);
  }

  return data;
};

export const deleteChecklist = async (id: string): Promise<void> => {
  // First delete all tasks for this checklist
  const { error: tasksError } = await supabase
    .from("tasks")
    .delete()
    .eq("checklist_id", id);

  if (tasksError) {
    throw new Error(`Failed to delete tasks: ${tasksError.message}`);
  }

  // Then delete the checklist
  const { error } = await supabase.from("checklists").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete checklist: ${error.message}`);
  }
};

// Task CRUD
export const listTasks = async (checklistId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("order", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  return data || [];
};

export const getTaskById = async (id: string): Promise<Task | null> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch task: ${error.message}`);
  }

  return data;
};

export const createTask = async (input: {
  checklist_id: string;
  title: string;
  order?: number;
  type?: "task" | "date";
  date_value?: string;
}): Promise<Task> => {
  // If order is not provided, get the max order and add 1
  let order = input.order;
  if (order === undefined) {
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("order")
      .eq("checklist_id", input.checklist_id)
      .order("order", { ascending: false })
      .limit(1);

    order =
      existingTasks && existingTasks.length > 0
        ? (existingTasks[0].order ?? 0) + 1
        : 0;
  } else {
    // Shift existing tasks with order >= new order
    const { data: tasksToShift } = await supabase
      .from("tasks")
      .select("id, order")
      .eq("checklist_id", input.checklist_id)
      .gte("order", order);

    if (tasksToShift && tasksToShift.length > 0) {
      // Update each task's order by incrementing
      for (const task of tasksToShift) {
        await supabase
          .from("tasks")
          .update({ order: (task.order ?? 0) + 1 })
          .eq("id", task.id);
      }
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      checklist_id: input.checklist_id,
      title: input.title || "Untitled",
      completed: false,
      order: order!,
      type: input.type || "task",
      date_value: input.date_value,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  // Update checklist updated_at
  await supabase
    .from("checklists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.checklist_id);

  return data;
};

export const updateTask = async (
  id: string,
  updates: Partial<Pick<Task, "title" | "completed" | "order" | "type" | "date_value">>
): Promise<Task | null> => {
  // Get the task first to get checklist_id
  const { data: task } = await supabase
    .from("tasks")
    .select("checklist_id")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("tasks")
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
    throw new Error(`Failed to update task: ${error.message}`);
  }

  // Update checklist updated_at
  if (task?.checklist_id) {
    await supabase
      .from("checklists")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", task.checklist_id);
  }

  return data;
};

export const deleteTask = async (id: string): Promise<void> => {
  // Get the task first to get checklist_id and order
  const { data: task } = await supabase
    .from("tasks")
    .select("checklist_id, order")
    .eq("id", id)
    .single();

  if (!task) {
    throw new Error("Task not found");
  }

  // Delete the task
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }

  // Reorder remaining tasks - decrement order for tasks after the deleted one
  const { data: tasksToReorder } = await supabase
    .from("tasks")
    .select("id, order")
    .eq("checklist_id", task.checklist_id)
    .gt("order", task.order ?? 0)
    .order("order", { ascending: true });

  if (tasksToReorder && tasksToReorder.length > 0) {
    for (const taskToReorder of tasksToReorder) {
      await supabase
        .from("tasks")
        .update({ order: (taskToReorder.order ?? 0) - 1 })
        .eq("id", taskToReorder.id);
    }
  }

  // Update checklist updated_at
  await supabase
    .from("checklists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", task.checklist_id);
};
