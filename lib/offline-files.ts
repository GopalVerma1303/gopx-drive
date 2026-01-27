import { getCachedData, setCachedData, queueMutation } from "./offline-storage";
import * as filesApi from "./files";
import type { File } from "./supabase";

/**
 * Enhanced listFiles with offline support
 */
export async function listFiles(
  userId?: string,
  isOffline: boolean = false
): Promise<File[]> {
  if (isOffline) {
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      // Filter by userId if provided
      if (userId) {
        return cached.filter((file) => file.user_id === userId);
      }
      return cached;
    }
    return [];
  }

  try {
    const data = await filesApi.listFiles(userId);
    await setCachedData("files", data);
    return data;
  } catch (error) {
    // Fallback to cache on error
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      if (userId) {
        return cached.filter((file) => file.user_id === userId);
      }
      return cached;
    }
    throw error;
  }
}

/**
 * Enhanced listArchivedFiles with offline support
 */
export async function listArchivedFiles(
  userId?: string,
  isOffline: boolean = false
): Promise<File[]> {
  if (isOffline) {
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const filtered = cached.filter((file) => file.is_archived === true);
      if (userId) {
        return filtered.filter((file) => file.user_id === userId);
      }
      return filtered;
    }
    return [];
  }

  try {
    const data = await filesApi.listArchivedFiles(userId);
    // Update cache with archived files
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      // Merge archived files into cache
      data.forEach((file) => {
        const index = cached.findIndex((f) => f.id === file.id);
        if (index >= 0) {
          cached[index] = file;
        } else {
          cached.push(file);
        }
      });
      await setCachedData("files", cached);
    }
    return data;
  } catch (error) {
    // Fallback to cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const filtered = cached.filter((file) => file.is_archived === true);
      if (userId) {
        return filtered.filter((file) => file.user_id === userId);
      }
      return filtered;
    }
    throw error;
  }
}

/**
 * Enhanced getFileById with offline support
 */
export async function getFileById(
  id: string,
  isOffline: boolean = false,
  includeArchived: boolean = true
): Promise<File | null> {
  if (isOffline) {
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const file = cached.find((file) => file.id === id);
      if (file && (!includeArchived && file.is_archived)) {
        return null;
      }
      return file || null;
    }
    return null;
  }

  try {
    const data = await filesApi.getFileById(id, includeArchived);
    // Update cache if found
    if (data) {
      const cached = await getCachedData<File[]>("files");
      if (cached) {
        const index = cached.findIndex((file) => file.id === id);
        if (index >= 0) {
          cached[index] = data;
        } else {
          cached.push(data);
        }
        await setCachedData("files", cached);
      }
    }
    return data;
  } catch (error) {
    // Fallback to cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const file = cached.find((file) => file.id === id);
      if (file && (!includeArchived && file.is_archived)) {
        return null;
      }
      return file || null;
    }
    throw error;
  }
}

/**
 * Enhanced uploadFile with offline queue support
 */
export async function uploadFile(
  input: {
    user_id: string;
    file: {
      uri: string;
      name: string;
      type: string;
      size: number;
    };
  },
  isOffline: boolean = false
): Promise<File> {
  if (isOffline) {
    await queueMutation({
      type: "create",
      resource: "file",
      data: input,
    });
    // Return optimistic response
    return {
      id: `temp_${Date.now()}`,
      user_id: input.user_id,
      name: input.file.name,
      file_path: `temp/${input.file.name}`,
      file_size: input.file.size,
      mime_type: input.file.type,
      extension: input.file.name.split(".").pop() || "",
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const data = await filesApi.uploadFile(input);
    // Update cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      cached.unshift(data); // Add to beginning
      await setCachedData("files", cached);
    }
    return data;
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "create",
      resource: "file",
      data: input,
    });
    throw error;
  }
}

/**
 * Enhanced archiveFile with offline queue support
 */
export async function archiveFile(
  id: string,
  isOffline: boolean = false
): Promise<void> {
  if (isOffline) {
    await queueMutation({
      type: "update",
      resource: "file",
      data: { id, updates: { is_archived: true } },
    });
    // Optimistically update cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const file = cached.find((f) => f.id === id);
      if (file) {
        file.is_archived = true;
        file.updated_at = new Date().toISOString();
        await setCachedData("files", cached);
      }
    }
    return;
  }

  try {
    await filesApi.archiveFile(id);
    // Update cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const file = cached.find((f) => f.id === id);
      if (file) {
        file.is_archived = true;
        file.updated_at = new Date().toISOString();
        await setCachedData("files", cached);
      }
    }
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "update",
      resource: "file",
      data: { id, updates: { is_archived: true } },
    });
    throw error;
  }
}

/**
 * Enhanced restoreFile with offline queue support
 */
export async function restoreFile(
  id: string,
  isOffline: boolean = false
): Promise<void> {
  if (isOffline) {
    await queueMutation({
      type: "update",
      resource: "file",
      data: { id, updates: { is_archived: false } },
    });
    // Optimistically update cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const file = cached.find((f) => f.id === id);
      if (file) {
        file.is_archived = false;
        file.updated_at = new Date().toISOString();
        await setCachedData("files", cached);
      }
    }
    return;
  }

  try {
    await filesApi.restoreFile(id);
    // Update cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const file = cached.find((f) => f.id === id);
      if (file) {
        file.is_archived = false;
        file.updated_at = new Date().toISOString();
        await setCachedData("files", cached);
      }
    }
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "update",
      resource: "file",
      data: { id, updates: { is_archived: false } },
    });
    throw error;
  }
}

/**
 * Enhanced deleteFile with offline queue support
 */
export async function deleteFile(
  id: string,
  isOffline: boolean = false
): Promise<void> {
  if (isOffline) {
    await queueMutation({
      type: "delete",
      resource: "file",
      data: { id },
    });
    // Optimistically remove from cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const filtered = cached.filter((file) => file.id !== id);
      await setCachedData("files", filtered);
    }
    return;
  }

  try {
    await filesApi.deleteFile(id);
    // Update cache
    const cached = await getCachedData<File[]>("files");
    if (cached) {
      const filtered = cached.filter((file) => file.id !== id);
      await setCachedData("files", filtered);
    }
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "delete",
      resource: "file",
      data: { id },
    });
    throw error;
  }
}

/**
 * Enhanced getFileDownloadUrl with offline support
 * Note: For offline files, we can't generate signed URLs, so we return a placeholder
 */
export async function getFileDownloadUrl(
  filePath: string,
  isOffline: boolean = false
): Promise<string> {
  if (isOffline) {
    // In offline mode, we can't generate signed URLs
    // Return a placeholder or try to get from cache if available
    throw new Error("Cannot generate download URL while offline");
  }

  try {
    return await filesApi.getFileDownloadUrl(filePath);
  } catch (error) {
    throw error;
  }
}
