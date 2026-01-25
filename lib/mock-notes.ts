import { Note } from "@/lib/supabase";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const MARKDOWN_KITCHEN_SINK_NOTE_CONTENT = [
  "# Markdown kitchen sink",
  "",
  "This note is a **dummy note** meant to exercise *all* markdown components currently supported by the app.",
  "",
  "## Inline formatting",
  "",
  "- **Bold**: **bold text**",
  "- *Italic (asterisk)*: *italic text*",
  "- _Italic (underscore)_: _italic text_",
  "- ~~Strikethrough~~: ~~this should be struck~~",
  "- Combined: **_bold + italic_** and ~~**strike + bold**~~",
  "- Inline code: `const answer = 42;`",
  "",
  "## Links (including linkify in preview)",
  "",
  "- Inline link: [Gopx Drive](https://example.com)",
  "- Autolink: <https://example.com/docs>",
  "- Bare URL (should get linkified in preview): https://example.com/pricing",
  "- www URL (should get linkified in preview): www.example.com",
  "- Email (should get linkified in preview): demo@example.com",
  "- tel (should get linkified in preview): tel:+15551234567",
  "",
  "## Image",
  "",
  "![Markdown test image](https://placehold.co/600x200/png?text=Gopx+Drive+Markdown)",
  "",
  "## Blockquote",
  "",
  "> A blockquote with **bold**, *italic*, `inline code`, and a [link](https://example.com).",
  ">",
  "> - It can contain lists",
  "> - And multiple paragraphs",
  "",
  "---",
  "",
  "## Lists",
  "",
  "### Bullet list (with nesting)",
  "",
  "- Item one",
  "- Item two",
  "   - Nested item A",
  "   - Nested item B with `inline code`",
  "- Item three",
  "",
  "### Ordered list",
  "",
  "1. First",
  "2. Second",
  "3. Third (with **bold**) ",
  "",
  "### Task list (interactive checkboxes in preview)",
  "",
  "- [ ] Unchecked task",
  "- [x] Checked task (x)",
  "- [X] Checked task (X)",
  "- [*] Checked task (*)",
  "   - [ ] Nested unchecked task",
  "   - [x] Nested checked task",
  "",
  "## Table",
  "",
  "| Component | Example | Notes |",
  "|---|---|---|",
  "| Bold | **bold** | `strong` |",
  "| Italic | *italic* | `em` |",
  "| Strike | ~~strike~~ | `del` / `s` |",
  "| Link | [link](https://example.com) | `link` |",
  "| Inline code | `code()` | `code_inline` |",
  "",
  "## Code blocks",
  "",
  "### Fenced code block (with language)",
  "",
  "```ts",
  "type User = { id: string; email: string };",
  "",
  "export function greet(user: User) {",
  "  // comment",
  "  const msg = `Hello, ${user.email}!`;",
  "  return msg;",
  "}",
  "```",
  "",
  "### Indented code block (no language)",
  "",
  "    # Indented code block",
  "    echo \"Hello from an indented code block\"",
  "    exit 0",
  "",
  "## Headings (levels 1–6)",
  "",
  "# Heading 1",
  "## Heading 2",
  "### Heading 3",
  "#### Heading 4",
  "##### Heading 5",
  "###### Heading 6",
  "",
].join("\n");

// In-memory notes used while building UI without a real database
let notes: Note[] = [
  {
    id: "note-markdown-kitchen-sink",
    user_id: "demo-user",
    title: "Markdown components test",
    content: MARKDOWN_KITCHEN_SINK_NOTE_CONTENT,
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "note-0",
    user_id: "demo-user",
    title: "Welcome to Gopx Drive",
    content:"aionoi `code` ononaocno",
  
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "note-1",
    user_id: "demo-user",
    title: "Welcome to Gopx Drive",
    content:
      "This is a sample note. You can edit, delete, or add new notes while the UI is under development This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.This is a sample note. You can edit, delete, or add new notes while the UI is under development.",
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
