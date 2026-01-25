import { Note } from "@/lib/supabase";

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory notes used while building UI without a real database
let notes: Note[] = [
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
  {
    id: "note-4",
    user_id: "demo-user",
    title: "Markdown Kitchen Sink (GFM)",
    content: [
      "Markdown Kitchen Sink (GitHub Flavored Markdown)",
      "Easiest → most complex. Use this to verify web + mobile editor parity.",
      "",
      "Plain text + hard line break (two spaces at end):",
      "Line one with two spaces  ",
      "Line two",
      "",
      "---",
      "",
      "# Heading 1",
      "## Heading 2",
      "### Heading 3",
      "",
      "Setext Heading 1",
      "===============",
      "",
      "Setext Heading 2",
      "---------------",
      "",
      "Emphasis:",
      "- *italic* and _italic_",
      "- **bold** and __bold__",
      "- ***bold+italic***",
      "",
      "Strikethrough (GFM): ~~deleted~~",
      "",
      "Inline code: `const x = 1`",
      "",
      "Links:",
      "- Inline: [Example](https://example.com)",
      "- Reference: [Example][ex]",
      "",
      "[ex]: https://example.com \"Example title\"",
      "",
      "Autolinks (GFM):",
      "- <https://example.com>",
      "- <user@example.com>",
      "",
      "Images (syntax only):",
      "![Alt text](https://example.com/image.png)",
      "",
      "Blockquote:",
      "> Quote line 1",
      "> Quote line 2",
      ">",
      "> - Quote + list item 1",
      "> - Quote + list item 2",
      "",
      "Lists:",
      "- Unordered item",
      "  - Nested item",
      "  - Nested item 2",
      "",
      "1. Ordered item one",
      "2. Ordered item two",
      "",
      "Task list (GFM, should be interactive):",
      "- [ ] todo item",
      "- [x] done item",
      "",
      "Table (GFM):",
      "| Feature | Syntax | Notes |",
      "| --- | --- | --- |",
      "| Bold | `**bold**` | Works |",
      "| Strike | `~~strike~~` | GFM |",
      "| Task | `- [ ]` | Interactive |",
      "",
      "Fenced code block (language):",
      "```ts",
      "type User = { id: string; name: string };",
      "const user: User = { id: \"1\", name: \"Ada\" };",
      "console.log(user);",
      "```",
      "",
      "Indented code block:",
      "    four spaces makes a code block",
      "    second line",
      "",
      "Horizontal rules:",
      "---",
      "***",
      "___",
      "",
      "Escapes (should render literals):",
      "\\*not italic\\* \\_not italic\\_ \\`not code\\`",
      "",
      "Inline/Block HTML:",
      "<details>",
      "<summary>Click to expand</summary>",
      "",
      "<p>HTML block inside markdown.</p>",
      "</details>",
      "",
      "Emoji shortcode (parser supports): :smile: :rocket:",
      "",
      "Subscript / superscript (parser supports): H~2~O and x^2^",
      "",
      "Complex mix (blockquote + task + code):",
      "> - [ ] task inside quote",
      ">",
      "> ```js",
      "> console.log(\"hello\");",
      "> ```",
    ].join("\n"),
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
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
