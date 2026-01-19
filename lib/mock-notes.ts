import { Note } from "@/lib/supabase";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory notes used while building UI without a real database
let notes: Note[] = [
  {
    id: "note-1",
    user_id: "demo-user",
    title: "Welcome to Gopx Drive",
    content:
      "This is a sample note. You can edit, delete, or add new notes while the UI is under development. This is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under development. This is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under developmentThis is a sample note. You can edit, delete, or add new notes while the UI is under development",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "note-2",
    user_id: "demo-user",
    title: "Design ideas",
    content: "• Rounded cards\n• Pastel palette\n• Quick actions on long press",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "note-3",
    user_id: "demo-user",
    title: "Offline first",
    content: "When ready, replace this mock store with Supabase calls.",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

const generateId = () => `note-${Math.random().toString(36).slice(2, 10)}`;

export const listNotes = async (userId?: string) => {
  await wait();
  return userId ? notes.filter((note) => note.user_id === userId) : notes;
};

export const getNoteById = async (id: string) => {
  await wait();
  return notes.find((note) => note.id === id) ?? null;
};

export const createNote = async (input: {
  user_id: string;
  title: string;
  content: string;
}) => {
  await wait();
  const now = new Date().toISOString();
  const note: Note = {
    id: generateId(),
    user_id: input.user_id,
    title: input.title || "Untitled",
    content: input.content,
    created_at: now,
    updated_at: now,
  };
  notes = [note, ...notes];
  return note;
};

export const updateNote = async (id: string, updates: Partial<Note>) => {
  await wait();
  let updated: Note | null = null;
  notes = notes.map((note) => {
    if (note.id !== id) return note;
    updated = {
      ...note,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return updated;
  });
  return updated;
};

export const deleteNote = async (id: string) => {
  await wait();
  notes = notes.filter((note) => note.id !== id);
};
