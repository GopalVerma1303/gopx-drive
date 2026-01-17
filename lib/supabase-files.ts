import { supabase, type File } from "@/lib/supabase";
import { Platform } from "react-native";

export const listFiles = async (userId?: string): Promise<File[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch files: ${error.message}`);
  }

  return data || [];
};

export const getFileById = async (id: string): Promise<File | null> => {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .single();

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
  file: {
    uri: string | globalThis.File;
    name: string;
    type: string;
    size: number;
  };
}): Promise<File> => {
  const { user_id, file } = input;

  // Generate a unique file path
  // Note: In Supabase Storage, the path should NOT include the bucket name
  const fileExt = file.name.split(".").pop() || "";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const filePath = `${user_id}/${fileName}`;

  // Read file as blob
  let fileBlob: Blob;
  if (Platform.OS === "web") {
    // Web: expo-document-picker returns a File object or blob URI
    if (file.uri instanceof globalThis.File) {
      fileBlob = file.uri;
    } else if (typeof file.uri === "string") {
      if (file.uri.startsWith("blob:") || file.uri.startsWith("http")) {
        // Fetch blob URL or HTTP URL
        const response = await fetch(file.uri);
        fileBlob = await response.blob();
      } else {
        // Try to read as file path
        const response = await fetch(file.uri);
        fileBlob = await response.blob();
      }
    } else {
      throw new Error("Invalid file URI for web platform");
    }
  } else {
    // React Native: fetch the file URI (always a string)
    const response = await fetch(file.uri as string);
    fileBlob = await response.blob();
  }

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("files")
    .upload(filePath, fileBlob, {
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

  // Create file record in database
  const { data, error } = await supabase
    .from("files")
    .insert({
      user_id,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      extension: fileExt,
    })
    .select()
    .single();

  if (error) {
    // If database insert fails, try to delete the uploaded file
    await supabase.storage.from("files").remove([filePath]);
    throw new Error(`Failed to create file record: ${error.message}`);
  }

  return data;
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

export const getFileDownloadUrl = async (filePath: string): Promise<string> => {
  // For private buckets, we need to use signed URLs
  // Signed URLs expire after a certain time (default 3600 seconds = 1 hour)
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(filePath, 3600); // URL valid for 1 hour

  if (error) {
    throw new Error(`Failed to create download URL: ${error.message}`);
  }

  return data.signedUrl;
};
