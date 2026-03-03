"use client";

import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface MarkdownPreviewCheckboxProps {
  /** Initial checked state from the markdown (e.g. [x] vs [ ]). */
  defaultChecked?: boolean;
}

/**
 * Checkbox used in markdown preview task lists. Matches the UI Checkbox styling
 * and toggles checked state on click (visual only; does not persist to source).
 */
export function MarkdownPreviewCheckbox({ defaultChecked = false }: MarkdownPreviewCheckboxProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => setChecked(value === true)}
      aria-label="Task list checkbox"
    />
  );
}
