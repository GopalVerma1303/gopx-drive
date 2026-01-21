import { File } from "@/lib/supabase";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory files used while building UI without a real database
let files: File[] = [
  {
    id: "file-1",
    user_id: "demo-user",
    name: "sample-document.pdf",
    file_path: "files/demo-user/sample-document.pdf",
    file_size: 1024000,
    mime_type: "application/pdf",
    extension: "pdf",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "file-2",
    user_id: "demo-user",
    name: "image.png",
    file_path: "files/demo-user/image.png",
    file_size: 512000,
    mime_type: "image/png",
    extension: "png",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "file-3",
    user_id: "demo-user",
    name: "spreadsheet.xlsx",
    file_path: "files/demo-user/spreadsheet.xlsx",
    file_size: 2048000,
    mime_type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "file-4",
    user_id: "demo-user",
    name: "presentation.pptx",
    file_path: "files/demo-user/presentation.pptx",
    file_size: 3072000,
    mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  }
];

const generateId = () => `file-${Math.random().toString(36).slice(2, 10)}`;

export const listFiles = async (userId?: string) => {
  await wait();
  return userId ? files.filter((file) => file.user_id === userId) : files;
};

export const getFileById = async (id: string) => {
  await wait();
  return files.find((file) => file.id === id) ?? null;
};

export const uploadFile = async (input: {
  user_id: string;
  file: {
    uri: string;
    name: string;
    type: string;
    size: number;
  };
}) => {
  await wait();
  const now = new Date().toISOString();
  const fileExt = input.file.name.split(".").pop() || "";
  const file: File = {
    id: generateId(),
    user_id: input.user_id,
    name: input.file.name,
    file_path: `files/${input.user_id}/${Date.now()}-${input.file.name}`,
    file_size: input.file.size,
    mime_type: input.file.type,
    extension: fileExt,
    created_at: now,
    updated_at: now,
  };
  files = [file, ...files];
  return file;
};

export const deleteFile = async (id: string) => {
  await wait();
  files = files.filter((file) => file.id !== id);
};

export const getFileDownloadUrl = async (filePath: string): Promise<string> => {
  await wait();
  // Return a mock URL for development
  return `https://example.com/${filePath}`;
};
