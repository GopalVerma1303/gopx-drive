import { supabase, DEFAULT_FOLDER_ID, type File } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export const listFiles = async (userId?: string): Promise<File[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  // Try querying with is_archived filter first
  let { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  // If column doesn't exist (400 error), fallback to querying without filter
  if (error && (error.code === "PGRST116" || error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    
    if (fallbackQuery.error) {
      throw new Error(`Failed to fetch files: ${fallbackQuery.error.message}`);
    }
    
    return (fallbackQuery.data || []).filter((file: any) => !file.is_archived).map((f: any) => ({ ...f, folder_id: f.folder_id ?? null }));
  }

  if (error) {
    throw new Error(`Failed to fetch files: ${error.message}`);
  }

  return (data || []).map((f: any) => ({ ...f, folder_id: f.folder_id ?? null }));
};

/** List non-archived files in a folder. Use DEFAULT_FOLDER_ID for default (folder_id is null). */
export const listFilesByFolder = async (
  userId: string,
  folderId: string
): Promise<File[]> => {
  const isDefault = folderId === DEFAULT_FOLDER_ID;
  let query = supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (isDefault) {
    query = query.is("folder_id", null);
  } else {
    query = query.eq("folder_id", folderId);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message?.includes("column") || error.message?.includes("folder_id")) {
      const all = await listFiles(userId);
      return all.filter((f) => (f.folder_id ?? null) === (isDefault ? null : folderId));
    }
    throw new Error(`Failed to fetch files: ${error.message}`);
  }

  return (data || []).map((f: any) => ({ ...f, folder_id: f.folder_id ?? null }));
};

export const listArchivedFiles = async (userId?: string): Promise<File[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  // Try querying with is_archived filter first
  let { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", true)
    .order("updated_at", { ascending: false });

  // If column doesn't exist (400 error), return empty array (no archived items yet)
  if (error && (error.code === "PGRST116" || error.message?.includes("column") || error.message?.includes("is_archived"))) {
    return [];
  }

  if (error) {
    throw new Error(`Failed to fetch archived files: ${error.message}`);
  }

  return data || [];
};

export const getFileById = async (id: string, includeArchived: boolean = true): Promise<File | null> => {
  let query = supabase
    .from("files")
    .select("*")
    .eq("id", id);
  
  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }
  
  let { data, error } = await query.single();

  // If column doesn't exist and we're filtering, retry without filter
  if (error && !includeArchived && (error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .single();
    
    if (fallbackQuery.error) {
      if (fallbackQuery.error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch file: ${fallbackQuery.error.message}`);
    }
    
    // Filter in JavaScript if needed
    if (fallbackQuery.data && (fallbackQuery.data as any).is_archived) {
      return null;
    }
    
    return fallbackQuery.data;
  }

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch file: ${error.message}`);
  }

  return data;
};

export const uploadFile = async (input: {
  user_id: string;
  folder_id?: string | null;
  file: {
    uri: string | globalThis.File;
    name: string;
    type: string;
    size: number;
  };
}): Promise<File> => {
  const { user_id, folder_id, file } = input;
  const folderId = folder_id === DEFAULT_FOLDER_ID ? null : (folder_id ?? null);

  // Generate a unique file path
  // Note: In Supabase Storage, the path should NOT include the bucket name
  const fileExt = file.name.split(".").pop() || "";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const filePath = `${user_id}/${fileName}`;

  // Read file and prepare for upload
  let fileData: Blob | ArrayBuffer;
  if (Platform.OS === "web") {
    // Web: expo-document-picker returns a File object or blob URI
    if (file.uri instanceof globalThis.File) {
      fileData = file.uri;
    } else if (typeof file.uri === "string") {
      if (file.uri.startsWith("blob:") || file.uri.startsWith("http")) {
        // Fetch blob URL or HTTP URL
        const response = await fetch(file.uri);
        fileData = await response.blob();
      } else {
        // Try to read as file path
        const response = await fetch(file.uri);
        fileData = await response.blob();
      }
    } else {
      throw new Error("Invalid file URI for web platform");
    }
  } else {
    // React Native: Use expo-file-system to read local file as base64, then convert to ArrayBuffer
    // Supabase Storage accepts ArrayBuffer directly in React Native (Blob doesn't work reliably)
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri as string, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to ArrayBuffer (Supabase Storage accepts ArrayBuffer in React Native)
      fileData = decode(base64);
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message || "Unknown error"}`);
    }
  }

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("files")
    .upload(filePath, fileData, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("files")
    .getPublicUrl(filePath);

  const insertRow: Record<string, unknown> = {
    user_id,
    name: file.name,
    file_path: filePath,
    file_size: file.size,
    mime_type: file.type,
    extension: fileExt,
    is_archived: false,
  };
  if (folderId !== undefined) (insertRow as any).folder_id = folderId;

  let { data, error } = await supabase.from("files").insert(insertRow).select().single();

  if (error && (error.message?.includes("column") || error.message?.includes("is_archived") || error.message?.includes("folder_id"))) {
    const fallbackRow: Record<string, unknown> = {
      user_id,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      extension: fileExt,
    };
    const fallbackQuery = await supabase.from("files").insert(fallbackRow).select().single();
    if (fallbackQuery.error) {
      await supabase.storage.from("files").remove([filePath]);
      throw new Error(`Failed to create file record: ${fallbackQuery.error.message}`);
    }
    return { ...fallbackQuery.data, folder_id: (fallbackQuery.data as any).folder_id ?? null };
  }

  if (error) {
    await supabase.storage.from("files").remove([filePath]);
    throw new Error(`Failed to create file record: ${error.message}`);
  }

  return { ...data, folder_id: (data as any).folder_id ?? null };
};

export const archiveFile = async (id: string): Promise<void> => {
  // Try updating with is_archived first
  let { error } = await supabase
    .from("files")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  // If column doesn't exist, just update updated_at (column will be added later)
  if (error && (error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("files")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    
    if (fallbackQuery.error) {
      throw new Error(`Failed to archive file: ${fallbackQuery.error.message}`);
    }
    // Note: Archive functionality won't work until column is added, but won't crash
    return;
  }

  if (error) {
    throw new Error(`Failed to archive file: ${error.message}`);
  }
};

export const restoreFile = async (id: string): Promise<void> => {
  // Try updating with is_archived first
  let { error } = await supabase
    .from("files")
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  // If column doesn't exist, just update updated_at (column will be added later)
  if (error && (error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("files")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    
    if (fallbackQuery.error) {
      throw new Error(`Failed to restore file: ${fallbackQuery.error.message}`);
    }
    // Note: Restore functionality won't work until column is added, but won't crash
    return;
  }

  if (error) {
    throw new Error(`Failed to restore file: ${error.message}`);
  }
};

export const deleteFile = async (id: string): Promise<void> => {
  // First get the file to get the storage path
  const file = await getFileById(id);
  if (!file) {
    throw new Error("File not found");
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("files")
    .remove([file.file_path]);

  if (storageError) {
    console.error("Failed to delete file from storage:", storageError);
    // Continue to delete database record even if storage delete fails
  }

  // Delete from database
  const { error } = await supabase.from("files").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const getFileDownloadUrl = async (
  filePath: string,
  options?: { download?: boolean }
): Promise<string> => {
  // For private buckets, we need to use signed URLs
  // Signed URLs expire after a certain time (default 3600 seconds = 1 hour)
  // Pass download: true only when we want the browser/OS to save the file; omit for inline preview
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(filePath, 3600, options?.download ? { download: true } : undefined);

  if (error) {
    throw new Error(`Failed to create download URL: ${error.message}`);
  }

  return data.signedUrl;
};
