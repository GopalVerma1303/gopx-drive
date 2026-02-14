import {
  deleteAttachmentByPublicUrl,
  listFilesInAttachmentsBucket,
  type AttachmentBucketItem,
} from "@/lib/supabase-images";

export type { AttachmentBucketItem };

/**
 * List all files in the user's attachments bucket (Storage only, no note correlation).
 */
export async function listAttachments(
  userId?: string
): Promise<AttachmentBucketItem[]> {
  if (!userId) return [];
  return listFilesInAttachmentsBucket(userId);
}

/**
 * Delete an attachment from the Storage bucket by its public URL.
 */
export async function deleteAttachment(publicUrl: string): Promise<void> {
  await deleteAttachmentByPublicUrl(publicUrl);
}
