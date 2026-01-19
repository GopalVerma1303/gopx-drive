"use client";

import { ChecklistDetailHeader } from "@/components/headers/checklist-detail-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import {
  createChecklist,
  createTask,
  deleteTask,
  getChecklistById,
  listTasks,
  updateChecklist,
  updateTask,
} from "@/lib/checklist";
import type { Task } from "@/lib/supabase";
import { useThemeColors } from "@/lib/use-theme-colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Alert as RNAlert,
  ScrollView,
  View,
} from "react-native";

export default function ChecklistEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useThemeColors();
  const isNewChecklist = id === "new";

  const [title, setTitle] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lastSavedTasks, setLastSavedTasks] = useState<Task[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingOriginalValue, setEditingOriginalValue] = useState<string>("");
  const [editingCurrentValue, setEditingCurrentValue] = useState<string>("");
  const editingInputRef = useRef<any>(null);
  const [newCellText, setNewCellText] = useState("");
  const [newCellPosition, setNewCellPosition] = useState<{
    type: "above" | "below";
    taskId: string | null;
    cellType: "task" | "date";
  } | null>(null);
  const [longPressedTaskId, setLongPressedTaskId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const {
    data: checklist,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["checklist", id],
    queryFn: async () => {
      const existingChecklist = await getChecklistById(id);
      if (!existingChecklist) {
        throw new Error("Checklist not found");
      }
      return existingChecklist;
    },
    enabled: !isNewChecklist && !!id,
  });

  const {
    data: fetchedTasks = [],
    isLoading: isLoadingTasks,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => listTasks(id),
    enabled: !!id && !isNewChecklist,
  });

  useEffect(() => {
    if (checklist) {
      setTitle(checklist.title);
      setLastSavedTitle(checklist.title);
    } else if (isNewChecklist) {
      // For new checklists, initialize with empty strings
      setTitle("");
      setLastSavedTitle("");
    }
  }, [checklist, isNewChecklist]);

  // Track if we've initialized tasks from server and the last synced tasks
  const tasksInitializedRef = useRef(false);
  const lastSyncedTasksRef = useRef<Task[]>([]);

  useEffect(() => {
    // Only sync from server if we're not creating a new checklist
    if (isNewChecklist) {
      tasksInitializedRef.current = false;
      lastSyncedTasksRef.current = [];
      return;
    }

    // Check if fetched tasks are different from last synced
    const tasksChanged = !tasksAreEqual(fetchedTasks, lastSyncedTasksRef.current);

    if (!tasksInitializedRef.current) {
      // Initial load - sync from server
      setTasks(fetchedTasks);
      setLastSavedTasks(fetchedTasks);
      lastSyncedTasksRef.current = fetchedTasks;
      tasksInitializedRef.current = true;
      return;
    }

    // After initial load, only sync if:
    // - We're not editing a task (to avoid overwriting local edits)
    // - The fetched tasks are actually different from what we last synced
    if (editingTaskId === null && tasksChanged) {
      setTasks(fetchedTasks);
      setLastSavedTasks(fetchedTasks);
      lastSyncedTasksRef.current = fetchedTasks;
    }
  }, [fetchedTasks, isNewChecklist, editingTaskId]);

  // Helper function to compare tasks for changes
  const tasksAreEqual = (tasks1: Task[], tasks2: Task[]): boolean => {
    if (tasks1.length !== tasks2.length) return false;
    
    const sorted1 = [...tasks1].sort((a, b) => a.order - b.order);
    const sorted2 = [...tasks2].sort((a, b) => a.order - b.order);
    
    return sorted1.every((task1, index) => {
      const task2 = sorted2[index];
      return (
        task1.id === task2.id &&
        task1.title === task2.title &&
        task1.completed === task2.completed &&
        task1.order === task2.order &&
        task1.type === task2.type &&
        task1.date_value === task2.date_value
      );
    });
  };

  // Check if there are changes: title changed or tasks changed
  const isDirty = isNewChecklist
    ? title.trim().length > 0 || tasks.length > 0
    : title !== lastSavedTitle || !tasksAreEqual(tasks, lastSavedTasks);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const userId = user?.id ?? "demo-user";

      let savedChecklist;
      if (isNewChecklist) {
        savedChecklist = await createChecklist({
          user_id: userId,
          title: title || "Untitled",
        });
      } else {
        const updated = await updateChecklist(id, {
          title: title || "Untitled",
        });
        if (!updated) {
          throw new Error("Checklist not found");
        }
        savedChecklist = updated;
      }

      // Save all tasks
      const checklistId = savedChecklist.id;
      
      // Get current saved tasks to compare (only for existing checklists)
      const existingTasks = !isNewChecklist ? await listTasks(checklistId) : [];
      const existingTaskIds = new Set(existingTasks.map(t => t.id));
      const currentTaskIds = new Set(tasks.map(t => t.id));

      // Delete tasks that are no longer in the current list
      for (const existingTask of existingTasks) {
        if (!currentTaskIds.has(existingTask.id)) {
          await deleteTask(existingTask.id);
        }
      }

      // Create or update tasks
      for (const task of tasks) {
        // Skip temp tasks that might have been created but not saved yet
        if (task.id.startsWith("temp-")) {
          // Create new task
          await createTask({
            checklist_id: checklistId,
            title: task.title,
            order: task.order,
            type: task.type,
            date_value: task.date_value,
          });
        } else if (existingTaskIds.has(task.id)) {
          // Update existing task
          await updateTask(task.id, {
            title: task.title,
            completed: task.completed,
            order: task.order,
            type: task.type,
            date_value: task.date_value,
          });
        } else {
          // Create new task (for new checklists)
          await createTask({
            checklist_id: checklistId,
            title: task.title,
            order: task.order,
            type: task.type,
            date_value: task.date_value,
          });
        }
      }

      return savedChecklist;
    },
    onSuccess: async (savedChecklist) => {
      const updatedTitle = savedChecklist.title ?? title;
      setTitle(updatedTitle);
      setLastSavedTitle(updatedTitle);

      // Refresh tasks from server to get updated IDs for new tasks
      if (isNewChecklist) {
        queryClient.invalidateQueries({ queryKey: ["checklists"] });
        queryClient.invalidateQueries({ queryKey: ["checklist", savedChecklist.id] });
        queryClient.invalidateQueries({ queryKey: ["tasks", savedChecklist.id] });
        
        // Fetch the updated tasks
        const updatedTasks = await listTasks(savedChecklist.id);
        setTasks(updatedTasks);
        setLastSavedTasks(updatedTasks);
        lastSyncedTasksRef.current = updatedTasks;
        
        router.replace(`/(app)/checklist/${savedChecklist.id}`);
      } else {
        // Refresh tasks for existing checklist
        const updatedTasks = await listTasks(id);
        setTasks(updatedTasks);
        setLastSavedTasks(updatedTasks);
        lastSyncedTasksRef.current = updatedTasks;
        
        queryClient.invalidateQueries({ queryKey: ["checklists"] });
        queryClient.invalidateQueries({ queryKey: ["checklist", id] });
        queryClient.invalidateQueries({ queryKey: ["tasks", id] });
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      RNAlert.alert("Error", error.message);
    },
  });

  // Generate temporary ID for new tasks (will be replaced when saved)
  const generateTempTaskId = () => `temp-${Math.random().toString(36).slice(2, 10)}`;

  const handleSave = () => {
    if (!title.trim()) {
      RNAlert.alert("Empty Checklist", "Please add a title");
      return;
    }
    if (!isDirty) {
      return;
    }
    saveMutation.mutate();
  };

  const handleSubmitCell = () => {
    if (!newCellText.trim() || !newCellPosition) {
      setNewCellPosition(null);
      return;
    }

    let order: number;
    if (newCellPosition.taskId) {
      const targetTask = tasks.find((t) => t.id === newCellPosition!.taskId);
      if (targetTask) {
        order =
          newCellPosition.type === "above"
            ? targetTask.order
            : targetTask.order + 1;
        
        // Shift existing tasks with order >= new order
        setTasks(prevTasks => 
          prevTasks.map(t => 
            t.order >= order ? { ...t, order: t.order + 1 } : t
          )
        );
      } else {
        order = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) + 1 : 0;
      }
    } else {
      // Adding at the end
      order = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) + 1 : 0;
    }

    const dateValue = newCellPosition.cellType === "date" ? newCellText.trim() : undefined;
    const taskTitle = newCellText.trim();
    const now = new Date().toISOString();

    const newTask: Task = {
      id: generateTempTaskId(),
      checklist_id: id || "temp",
      title: taskTitle,
      completed: false,
      order,
      type: newCellPosition.cellType,
      date_value: dateValue,
      created_at: now,
      updated_at: now,
    };

    setTasks(prevTasks => {
      const updated = [...prevTasks, newTask];
      return updated.sort((a, b) => a.order - b.order);
    });

    setNewCellText("");
    setNewCellPosition(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleTask = (task: Task) => {
    if (task.type === "date") return; // Don't toggle date cells
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === task.id ? { ...t, completed: !t.completed } : t
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
    setLongPressedTaskId(null);
  };

  const handleDeleteConfirm = () => {
    if (!taskToDelete) return;
    
    const task = tasks.find(t => t.id === taskToDelete);
    if (!task) {
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      return;
    }

    const deletedOrder = task.order;
    setTasks(prevTasks => {
      const filtered = prevTasks.filter(t => t.id !== taskToDelete);
      // Reorder remaining tasks
      return filtered.map(t =>
        t.order > deletedOrder ? { ...t, order: t.order - 1 } : t
      );
    });
    
    setDeleteDialogOpen(false);
    setTaskToDelete(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLongPress = (taskId: string | null = null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLongPressedTaskId(taskId);
  };

  const handleAddTaskAbove = (taskId: string | null) => {
    setLongPressedTaskId(null);
    setNewCellPosition({ type: "above", taskId, cellType: "task" });
    setNewCellText("");
  };

  const handleAddDateAbove = (taskId: string | null) => {
    setLongPressedTaskId(null);
    setNewCellPosition({ type: "above", taskId, cellType: "date" });
    setNewCellText("");
  };

  const handleAddTaskBelow = (taskId: string | null) => {
    setLongPressedTaskId(null);
    setNewCellPosition({ type: "below", taskId, cellType: "task" });
    setNewCellText("");
  };

  const handleAddDateBelow = (taskId: string | null) => {
    setLongPressedTaskId(null);
    setNewCellPosition({ type: "below", taskId, cellType: "date" });
    setNewCellText("");
  };

  const handleDeleteFromMenu = (taskId: string) => {
    setLongPressedTaskId(null);
    handleDeleteTask(taskId);
  };

  const handleEditFromMenu = (taskId: string) => {
    setLongPressedTaskId(null);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      if (task.type === "date") {
        const originalValue = task.date_value || task.title;
        setEditingTaskId(taskId);
        setEditingOriginalValue(originalValue);
        setEditingCurrentValue(originalValue);
      } else {
        setEditingTaskId(taskId);
        setEditingOriginalValue(task.title);
        setEditingCurrentValue(task.title);
      }
    }
  };

  const handleSaveTaskEdit = (taskId: string) => {
    if (editingCurrentValue.trim() === editingOriginalValue.trim()) {
      setEditingTaskId(null);
      setEditingOriginalValue("");
      setEditingCurrentValue("");
      return;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const trimmedValue = editingCurrentValue.trim();
    if (task.type === "date") {
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId
            ? { ...t, title: trimmedValue, date_value: trimmedValue }
            : t
        )
      );
    } else {
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId ? { ...t, title: trimmedValue } : t
        )
      );
    }
    setEditingTaskId(null);
    setEditingOriginalValue("");
    setEditingCurrentValue("");
  };

  const handleBlurTaskEdit = (taskId: string) => {
    // Update local state with the current value (so UI reflects the change)
    // but don't save to server - that happens when main save button is clicked
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const trimmedValue = editingCurrentValue.trim();
      if (task.type === "date") {
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === taskId
              ? { ...t, title: trimmedValue, date_value: trimmedValue }
              : t
          )
        );
      } else {
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === taskId ? { ...t, title: trimmedValue } : t
          )
        );
      }
    }
    
    // Blur the input and exit edit mode
    if (editingInputRef.current) {
      editingInputRef.current.blur();
    }
    setEditingTaskId(null);
    setEditingOriginalValue("");
    setEditingCurrentValue("");
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const canSave = isDirty && !saveMutation.isPending;

  if (isLoading && !isNewChecklist) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    );
  }

  const isFirstCell = (index: number) => index === 0;
  const isLastCell = (index: number) => index === tasks.length - 1;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ChecklistDetailHeader
        title={title}
        onTitleChange={setTitle}
        isNewChecklist={isNewChecklist}
        isDirty={isDirty}
        canSave={canSave}
        onSave={handleSave}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        <View className="flex-1 px-5 w-full max-w-2xl mx-auto bg-muted">
          <Pressable
            onLongPress={() => handleLongPress(null)}
            delayLongPress={500}
            style={{ flex: 1 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            {...(Platform.OS === "android" && {
              android_ripple: { color: "rgba(0, 0, 0, 0.1)" },
            })}
          >
          {isNewChecklist ? (
            <View className="py-8 items-center">
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 16,
                  textAlign: "center",
                }}
              >
                Save the checklist to start adding items
              </Text>
            </View>
          ) : (
            <>
              {/* Empty state - show message to long press to add */}
              {tasks.length === 0 && !newCellPosition && (
                <View className="py-8 items-center">
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 16,
                      textAlign: "center",
                    }}
                  >
                    Long press anywhere to add your first item
                  </Text>
                </View>
              )}

              {/* Add cell at the top - only show when adding below first */}
              {newCellPosition?.taskId === null && newCellPosition?.type === "below" && (
                <View className="py-3 border-b border-border">
                  {newCellPosition.cellType === "date" ? (
                    <View className="flex-row items-center gap-3">
                      <Calendar color={colors.mutedForeground} size={20} strokeWidth={2.5} />
                      <Input
                        className="flex-1"
                        value={newCellText}
                        onChangeText={setNewCellText}
                        placeholder="YYYY-MM-DD or date..."
                        placeholderTextColor={colors.mutedForeground}
                        onSubmitEditing={handleSubmitCell}
                        onBlur={handleSubmitCell}
                        autoFocus
                      />
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-3">
                      <Checkbox checked={false} disabled onCheckedChange={() => {}} />
                      <Input
                        className="flex-1"
                        value={newCellText}
                        onChangeText={setNewCellText}
                        placeholder="New task..."
                        placeholderTextColor={colors.mutedForeground}
                        onSubmitEditing={handleSubmitCell}
                        onBlur={handleSubmitCell}
                        autoFocus
                      />
                    </View>
                  )}
                </View>
              )}

              {isLoadingTasks ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color={colors.foreground} />
                </View>
              ) : (
                tasks.map((task, index) => (
                  <View key={task.id}>
                    {/* Add cell above */}
                    {newCellPosition?.taskId === task.id &&
                      newCellPosition.type === "above" && (
                        <View className="py-3 border-b border-border">
                          {newCellPosition.cellType === "date" ? (
                            <View className="flex-row items-center gap-3">
                              <Calendar color={colors.mutedForeground} size={20} strokeWidth={2.5} />
                              <Input
                                className="flex-1"
                                value={newCellText}
                                onChangeText={setNewCellText}
                                placeholder="YYYY-MM-DD or date..."
                                placeholderTextColor={colors.mutedForeground}
                                onSubmitEditing={handleSubmitCell}
                                onBlur={handleSubmitCell}
                                autoFocus
                              />
                            </View>
                          ) : (
                            <View className="flex-row items-center gap-3">
                              <Checkbox checked={false} disabled onCheckedChange={() => {}} />
                              <Input
                                className="flex-1"
                                value={newCellText}
                                onChangeText={setNewCellText}
                                placeholder="New task..."
                                placeholderTextColor={colors.mutedForeground}
                                onSubmitEditing={handleSubmitCell}
                                onBlur={handleSubmitCell}
                                autoFocus
                              />
                            </View>
                          )}
                        </View>
                      )}

                    {/* Task or Date item */}
                    <Pressable
                      onLongPress={() => handleLongPress(task.id)}
                      delayLongPress={500}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      {...(Platform.OS === "android" && {
                        android_ripple: { color: "rgba(0, 0, 0, 0.1)" },
                      })}
                      {...(Platform.OS === "web" && {
                        onContextMenu: (e: any) => {
                          e.preventDefault();
                          handleLongPress(task.id);
                        },
                      })}
                    >
                      <View className="flex-row items-center gap-3 py-3 border-b border-border">
                        {task.type === "date" ? (
                          <>
                            <Calendar color={colors.foreground} size={20} strokeWidth={2.5} />
                            {editingTaskId === task.id ? (
                              <View className="flex-row items-center gap-2 flex-1">
                                <Input
                                  ref={editingInputRef}
                                  className="flex-1"
                                  value={editingCurrentValue}
                                  onChangeText={setEditingCurrentValue}
                                  onBlur={() => {
                                    handleBlurTaskEdit(task.id);
                                  }}
                                  onSubmitEditing={() => {
                                    handleBlurTaskEdit(task.id);
                                  }}
                                  placeholder="YYYY-MM-DD"
                                  autoFocus
                                />
                                <Pressable
                                  onPress={() => handleBlurTaskEdit(task.id)}
                                  style={{ padding: 4 }}
                                >
                                  <Check
                                    color={colors.foreground}
                                    size={18}
                                    strokeWidth={2.5}
                                  />
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => {
                                  const originalValue = task.date_value || task.title;
                                  setEditingTaskId(task.id);
                                  setEditingOriginalValue(originalValue);
                                  setEditingCurrentValue(originalValue);
                                }}
                                className="flex-1"
                              >
                                <Text
                                  style={{
                                    color: colors.foreground,
                                    fontSize: 16,
                                    fontWeight: "600",
                                  }}
                                >
                                  {formatDate(task.date_value || task.title)}
                                </Text>
                              </Pressable>
                            )}
                          </>
                        ) : (
                          <>
                            <Checkbox
                              checked={task.completed}
                              onCheckedChange={() => handleToggleTask(task)}
                            />
                            {editingTaskId === task.id ? (
                              <View className="flex-row items-center gap-2 flex-1">
                                <Input
                                  ref={editingInputRef}
                                  className="flex-1"
                                  value={editingCurrentValue}
                                  onChangeText={setEditingCurrentValue}
                                  onBlur={() => {
                                    handleBlurTaskEdit(task.id);
                                  }}
                                  onSubmitEditing={() => {
                                    handleBlurTaskEdit(task.id);
                                  }}
                                  autoFocus
                                />
                                <Pressable
                                  onPress={() => handleBlurTaskEdit(task.id)}
                                  style={{ padding: 4 }}
                                >
                                  <Check
                                    color={colors.foreground}
                                    size={18}
                                    strokeWidth={2.5}
                                  />
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => {
                                  setEditingTaskId(task.id);
                                  setEditingOriginalValue(task.title);
                                  setEditingCurrentValue(task.title);
                                }}
                                className="flex-1"
                              >
                                <Text
                                  style={{
                                    color: task.completed
                                      ? colors.mutedForeground
                                      : colors.foreground,
                                    textDecorationLine: task.completed
                                      ? "line-through"
                                      : "none",
                                    fontSize: 16,
                                  }}
                                >
                                  {task.title}
                                </Text>
                              </Pressable>
                            )}
                          </>
                        )}
                      </View>
                    </Pressable>

                    {/* Add cell below */}
                    {newCellPosition?.taskId === task.id &&
                      newCellPosition.type === "below" && (
                        <View className="py-3 border-b border-border">
                          {newCellPosition.cellType === "date" ? (
                            <View className="flex-row items-center gap-3">
                              <Calendar color={colors.mutedForeground} size={20} strokeWidth={2.5} />
                              <Input
                                className="flex-1"
                                value={newCellText}
                                onChangeText={setNewCellText}
                                placeholder="YYYY-MM-DD or date..."
                                placeholderTextColor={colors.mutedForeground}
                                onSubmitEditing={handleSubmitCell}
                                onBlur={handleSubmitCell}
                                autoFocus
                              />
                            </View>
                          ) : (
                            <View className="flex-row items-center gap-3">
                              <Checkbox checked={false} disabled onCheckedChange={() => {}} />
                              <Input
                                className="flex-1"
                                value={newCellText}
                                onChangeText={setNewCellText}
                                placeholder="New task..."
                                placeholderTextColor={colors.mutedForeground}
                                onSubmitEditing={handleSubmitCell}
                                onBlur={handleSubmitCell}
                                autoFocus
                              />
                            </View>
                          )}
                        </View>
                      )}
                  </View>
                ))
              )}
            </>
          )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Long Press Context Menu */}
      {longPressedTaskId !== null && (
        Platform.OS === "web" ? (
          <View
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Pressable
              style={{
                position: "absolute" as any,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={() => setLongPressedTaskId(null)}
            />
            <View
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                padding: 8,
                width: "80%",
                maxWidth: 300,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
            >
              <Pressable
                onPress={() => handleAddDateAbove(longPressedTaskId)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: "500",
                  }}
                >
                  Add Date Above
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleAddTaskAbove(longPressedTaskId)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: "500",
                  }}
                >
                  Add Task Above
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleAddDateBelow(longPressedTaskId)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: "500",
                  }}
                >
                  Add Date Below
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleAddTaskBelow(longPressedTaskId)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: "500",
                  }}
                >
                  Add Task Below
                </Text>
              </Pressable>
              {longPressedTaskId && (
                <>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border,
                      marginVertical: 4,
                    }}
                  />
                  <Pressable
                    onPress={() => handleEditFromMenu(longPressedTaskId)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 16,
                      borderRadius: 8,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: "#3b82f6",
                        fontSize: 16,
                        fontWeight: "500",
                      }}
                    >
                      Edit
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteFromMenu(longPressedTaskId)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 16,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: "#ef4444",
                        fontSize: 16,
                        fontWeight: "500",
                      }}
                    >
                      Delete
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ) : (
          <Modal
            visible={longPressedTaskId !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setLongPressedTaskId(null)}
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => setLongPressedTaskId(null)}
            >
              <BlurView
                intensity={20}
                tint="dark"
                style={{
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderRadius: 12,
                  borderWidth: 1,
                  padding: 8,
                  width: "80%",
                  maxWidth: 300,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Pressable
                  onPress={() => handleAddDateAbove(longPressedTaskId)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: "500",
                    }}
                  >
                    Add Date Above
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAddTaskAbove(longPressedTaskId)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: "500",
                    }}
                  >
                    Add Task Above
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAddDateBelow(longPressedTaskId)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: "500",
                    }}
                  >
                    Add Date Below
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAddTaskBelow(longPressedTaskId)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: "500",
                    }}
                  >
                    Add Task Below
                  </Text>
                </Pressable>
                {longPressedTaskId && (
                  <>
                    <View
                      style={{
                        height: 1,
                        backgroundColor: colors.border,
                        marginVertical: 4,
                      }}
                    />
                    <Pressable
                      onPress={() => handleEditFromMenu(longPressedTaskId)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        borderRadius: 8,
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: "#3b82f6",
                          fontSize: 16,
                          fontWeight: "500",
                        }}
                      >
                        Edit
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteFromMenu(longPressedTaskId)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: "#ef4444",
                          fontSize: 16,
                          fontWeight: "500",
                        }}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </>
                )}
              </BlurView>
            </Pressable>
          </Modal>
        )
      )}

      {/* Delete Confirmation Dialog */}
      {Platform.OS === "web" ? (
        deleteDialogOpen && (
          <View
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            style={{
              position: "fixed" as any,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ position: "absolute" as any }}
              onPress={() => {
                setDeleteDialogOpen(false);
                setTaskToDelete(null);
              }}
            />
            <View
              className="bg-background border-border w-full max-w-md rounded-lg border p-6 shadow-lg"
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <Text
                className="text-lg font-semibold mb-4"
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "600",
                  marginBottom: 16,
                }}
              >
                Delete Item
              </Text>
              <Text
                className="text-sm mb-6"
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                Are you sure you want to delete this item? This action cannot be undone.
              </Text>
              <View
                className="flex-row justify-end gap-3"
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  className="px-4 py-2"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                  onPress={() => {
                    setDeleteDialogOpen(false);
                    setTaskToDelete(null);
                  }}
                >
                  <Text style={{ color: colors.foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 rounded-md"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}
                  onPress={handleDeleteConfirm}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )
      ) : (
        <Modal
          visible={deleteDialogOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setDeleteDialogOpen(false);
            setTaskToDelete(null);
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <BlurView
              intensity={20}
              tint="dark"
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 16,
              }}
            >
              <Pressable
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onPress={() => {
                  setDeleteDialogOpen(false);
                  setTaskToDelete(null);
                }}
              />
              <View
                style={{
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderRadius: 8,
                  borderWidth: 1,
                  padding: 24,
                  width: "100%",
                  maxWidth: 400,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 18,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  Delete Item
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 14,
                    marginBottom: 24,
                  }}
                >
                  Are you sure you want to delete this item? This action cannot be undone.
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 12,
                  }}
                >
                  <Pressable
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                    }}
                    onPress={() => {
                      setDeleteDialogOpen(false);
                      setTaskToDelete(null);
                    }}
                  >
                    <Text style={{ color: colors.foreground }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 6,
                    }}
                    onPress={handleDeleteConfirm}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            </BlurView>
          </View>
        </Modal>
      )}
    </>
  );
}
