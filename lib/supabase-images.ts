import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

// Bucket name - change this if your bucket has a different name
// Common variations: "attachments", "Attachments", "note-images", "images"
const BUCKET_NAME = "attachments";

/**
 * Get the actual bucket name from environment or use default
 * You can override this by setting EXPO_PUBLIC_ATTACHMENTS_BUCKET_NAME in your .env file
 */
const getBucketName = (): string => {
  const envBucketName = process.env.EXPO_PUBLIC_ATTACHMENTS_BUCKET_NAME;
  return envBucketName || BUCKET_NAME;
};

/**
 * List all available buckets (for debugging)
 */
export const listStorageBuckets = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error("Error listing buckets:", error);
      return [];
    }
    return data?.map((b) => b.name) || [];
  } catch (error: any) {
    console.error("Failed to list buckets:", error);
    return [];
  }
};

/**
 * Verify that the attachments bucket exists and is accessible
 */
export const verifyAttachmentsBucket = async (): Promise<{
  exists: boolean;
  error?: string;
  availableBuckets?: string[];
  actualBucketName?: string;
}> => {
  const bucketName = getBucketName();

  try {
    // First, try to list buckets to see what's available (may fail due to permissions)
    let availableBuckets: string[] = [];
    try {
      availableBuckets = await listStorageBuckets();

      // If the configured bucket name doesn't exist, try to find a similar one
      if (
        !availableBuckets.includes(bucketName) &&
        availableBuckets.length > 0
      ) {
        const similarBuckets = availableBuckets.filter(
          (b) =>
            b.toLowerCase().includes("attach") ||
            b.toLowerCase().includes("image") ||
            b.toLowerCase().includes("note"),
        );
      }
    } catch (listError) {
      // Continue without bucket list - we'll try to access the bucket directly
    }

    // Try to access the bucket directly
    const { data, error } = await supabase.storage.from(bucketName).list("", {
      limit: 1,
    });

    if (error) {
      const statusCode = (error as any).statusCode;
      if (
        error.message?.includes("Bucket not found") ||
        error.message?.includes("does not exist") ||
        statusCode === 404
      ) {
        const bucketList =
          availableBuckets.length > 0
            ? ` Available buckets: ${availableBuckets.join(", ")}.`
            : " Please check your Supabase Storage dashboard to see available buckets.";
        return {
          exists: false,
          error: `Bucket '${bucketName}' does not exist (404).${bucketList} Please create the '${bucketName}' bucket in Supabase Storage or set EXPO_PUBLIC_ATTACHMENTS_BUCKET_NAME in your .env file.`,
          availableBuckets:
            availableBuckets.length > 0 ? availableBuckets : undefined,
          actualBucketName:
            availableBuckets.length > 0 ? availableBuckets[0] : undefined,
        };
      }
      return {
        exists: false,
        error: error.message,
        availableBuckets:
          availableBuckets.length > 0 ? availableBuckets : undefined,
      };
    }

    return {
      exists: true,
      availableBuckets:
        availableBuckets.length > 0 ? availableBuckets : undefined,
      actualBucketName: bucketName,
    };
  } catch (error: any) {
    return { exists: false, error: error.message || "Failed to verify bucket" };
  }
};

/**
 * Upload an image to Supabase Storage bucket "attachments"
 * Returns the public URL of the uploaded image
 */
export const uploadImageToNoteImages = async (input: {
  user_id: string;
  file: {
    uri: string | globalThis.File;
    name: string;
    type: string;
    size: number;
  };
}): Promise<string> => {
  const { user_id, file } = input;
  const bucketName = getBucketName();

  // First verify the bucket exists
  const bucketCheck = await verifyAttachmentsBucket();
  if (!bucketCheck.exists) {
    let errorMsg =
      bucketCheck.error ||
      `Bucket '${bucketName}' not found. Please create it in Supabase Storage.`;

    // If we found available buckets, suggest using one of them
    if (
      bucketCheck.availableBuckets &&
      bucketCheck.availableBuckets.length > 0
    ) {
      errorMsg += `\n\nAvailable buckets: ${bucketCheck.availableBuckets.join(", ")}\n\nTo use a different bucket, set EXPO_PUBLIC_ATTACHMENTS_BUCKET_NAME in your .env file.`;
    }

    throw new Error(errorMsg);
  }

  // Generate a unique file path
  // Note: In Supabase Storage, the path should NOT include the bucket name
  const fileExt = file.name.split(".").pop() || "jpg";
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
      throw new Error(
        `Failed to read file: ${error.message || "Unknown error"}`,
      );
    }
  }

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileData, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // Provide more detailed error information
    let errorMessage = uploadError.message || "Failed to upload image";

    // Check for common errors
    if (
      uploadError.message?.includes("Bucket not found") ||
      uploadError.message?.includes("does not exist")
    ) {
      errorMessage = `Bucket '${bucketName}' not found (404). Please verify:\n\n1. The bucket name is exactly "${bucketName}" (case-sensitive)\n2. The bucket exists in your Supabase Storage dashboard\n3. You have the correct Supabase project selected\n4. Set EXPO_PUBLIC_ATTACHMENTS_BUCKET_NAME in .env if your bucket has a different name\n\nError details: ${uploadError.message}`;
    } else if (
      uploadError.message?.includes("new row violates row-level security") ||
      uploadError.message?.includes("403")
    ) {
      errorMessage = `Permission denied (403). Please check your Supabase Storage RLS policies for the '${bucketName}' bucket. Error: ${uploadError.message}`;
    }

    console.error("Upload error details:", {
      error: uploadError,
      bucketName,
      filePath,
      userId: user_id,
    });

    throw new Error(errorMessage);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error("Failed to get public URL for uploaded image");
  }

  return urlData.publicUrl;
};
