import { Note } from "@/lib/supabase";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// A "kitchen sink" note that exercises every markdown element the current
// `MarkdownEditor` preview supports (see `components/markdown-editor.tsx` rules/styles).
const MARKDOWN_KITCHEN_SINK = [
  "# Markdown kitchen sink",
  "",
  "Use this note to visually verify all supported markdown elements in preview mode.",
  "",
  "## Headings",
  "",
  "### H3",
  "",
  "#### H4",
  "",
  "##### H5 (may use default styling)",
  "",
  "###### H6 (may use default styling)",
  "",
  "## Inline formatting",
  "",
  "Plain text with **bold**, *italic*, and **_bold italic_**.",
  "",
  "Inline code: `const answer = 42;`",
  "",
  "Strikethrough: ~~deleted text~~ and also ~~`inline code with strike`~~.",
  "",
  "Escapes: \\*not italic\\* and \\_not italic\\_.",
  "",
  "## Links & autolinks",
  "",
  "- Markdown link: [OpenAI](https://openai.com)",
  "- Autolink form: <https://example.com>",
  "- Bare URL (should linkify in preview): www.example.com",
  "- Email (should linkify in preview): test@example.com",
  "- Scheme URLs (should linkify in preview): mailto:test@example.com, tel:+14155552671",
  "",
  "## Blockquote",
  "",
  "> A blockquote can span multiple lines.",
  ">",
  "> - And can contain lists",
  "> - With **formatting** and `inline code`",
  "",
  "## Lists",
  "",
  "- Bullet item 1",
  "- Bullet item 2",
  "  - Nested bullet",
  "  - Nested bullet with a [link](https://example.com) and `code`",
  "",
  "1. Ordered item 1",
  "2. Ordered item 2",
  "   1. Nested ordered item",
  "",
  "## Task list (checkboxes)",
  "",
  "- [ ] Unchecked task",
  "- [x] Checked task",
  "- [ ] Task with **bold**, *italic*, `code`, and a [link](https://example.com)",
  "",
  "## Horizontal rule",
  "",
  "---",
  "",
  "## Table",
  "",
  "| Column | Value | Notes |",
  "|:------ |:-----:| -----:|",
  "| Text   |  123  | Right aligned |",
  "| `code` |  3.14 | **bold** + *italic* |",
  "",
  "## Fenced code block (with language)",
  "",
  "```ts",
  "type User = { id: string; email: string };",
  "",
  "const url = \"https://example.com/path?x=1\"; // should NOT linkify inside fences",
  "const email = \"test@example.com\"; // should NOT linkify inside fences",
  "",
  "export function greet(user: User) {",
  "  return `Hello, ${user.email}`;",
  "}",
  "```",
  "",
  "## Code block (indented)",
  "",
  "    Indented code block line 1",
  "    Indented code block line 2: https://example.com (should NOT linkify)",
  "",
  "## Image (may depend on platform/network)",
  "",
  "![Placeholder image](https://placehold.co/600x300/png)",
  "",
].join("\n");

// In-memory notes used while building UI without a real database
let notes: Note[] = [
  {
    id: "note-markdown",
    user_id: "demo-user",
    title: "Markdown kitchen sink",
    content: MARKDOWN_KITCHEN_SINK,
    is_archived: false,
    folder_id: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "note-0",
    user_id: "demo-user",
    title: "Welcome to Gopx Drive",
    content: 'Tip: open the "Markdown kitchen sink" note to test preview rendering.',
    is_archived: false,
    folder_id: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "note-1",
    user_id: "demo-user",
    title: "Working draft",
    content:
      "This is a sample note used while the UI is under development.\n\n- Edit me\n- Add new notes\n- Toggle preview to see markdown rendering",
    is_archived: false,
    folder_id: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "note-2",
    user_id: "demo-user",
    title: "Design ideas",
    content: "- Rounded cards\n- Pastel palette\n- Quick actions on long press",
    is_archived: false,
    folder_id: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "note-3",
    user_id: "demo-user",
    title: "Offline first",
    content: "When ready, replace this mock store with Supabase calls.",
    is_archived: false,
    folder_id: null,
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
  folder_id?: string | null;
}) => {
  await wait();
  const now = new Date().toISOString();
  const note: Note = {
    id: generateId(),
    user_id: input.user_id,
    title: input.title || "Untitled",
    content: input.content,
    is_archived: false,
    folder_id: input.folder_id ?? null,
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
