"use client";

import React, { useState } from "react";

/** Check icon as inline SVG (no RN/lucide dependency so it works inside createRoot). */
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface MarkdownPreviewCheckboxWebProps {
  defaultChecked?: boolean;
}

/**
 * Web-only checkbox for markdown preview task lists. Uses plain DOM + CSS
 * so it works when rendered via createRoot (no React Native primitives).
 * Matches UI checkbox look: green when checked, red when unchecked.
 */
export function MarkdownPreviewCheckboxWeb({ defaultChecked = false }: MarkdownPreviewCheckboxWebProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label="Task list checkbox"
      className={`md-preview-checkbox ${checked ? "checked" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        setChecked((prev) => !prev);
      }}
    >
      {checked ? <CheckIcon /> : null}
    </button>
  );
}
