import { toolbarActionToCommand, getAllEditorCommandTypes } from "../commandMapping";

describe("commandMapping", () => {
  describe("toolbarActionToCommand", () => {
    it("maps bold to ToggleBold", () => {
      expect(toolbarActionToCommand("bold")).toBe("ToggleBold");
    });
    it("maps italic to ToggleItalic", () => {
      expect(toolbarActionToCommand("italic")).toBe("ToggleItalic");
    });
    it("maps undo to Undo", () => {
      expect(toolbarActionToCommand("undo")).toBe("Undo");
    });
    it("maps redo to Redo", () => {
      expect(toolbarActionToCommand("redo")).toBe("Redo");
    });
    it("maps indent to Indent", () => {
      expect(toolbarActionToCommand("indent")).toBe("Indent");
    });
    it("returns null for aiAssistant", () => {
      expect(toolbarActionToCommand("aiAssistant")).toBeNull();
    });
    it("returns null for date", () => {
      expect(toolbarActionToCommand("date")).toBeNull();
    });
  });

  describe("getAllEditorCommandTypes", () => {
    it("returns non-empty array of command types", () => {
      const all = getAllEditorCommandTypes();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);
      expect(all).toContain("ToggleBold");
      expect(all).toContain("Undo");
    });
  });
});
