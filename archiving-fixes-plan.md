# Archiving and Deletion UX Fixes

Fix glitches related to archiving and deletion processes, including adding missing confirmation dialogs and displaying loading states ("Archiving...", "Deleting...") during the process.

## Proposed Changes

### [Home Screen]
#### [MODIFY] [home.tsx](file:///Users/gopalverma/Desktop/gopx-drive/app/(app)/home.tsx)
- Add `archiveDialogOpen` state to control the archive confirmation modal.
- Update `openArchiveConfirm` to set `archiveDialogOpen(true)` instead of immediately mutating.
- Implement the archive confirmation dialog (using `View` for web and `Modal` for native) similar to `notes.tsx`.
- Update the "Archive" button in the dialog to show "Archiving..." when `archiveNoteMutation.isPending` or `archiveFileMutation.isPending` is true.

### [Notes Screen]
#### [MODIFY] [notes.tsx](file:///Users/gopalverma/Desktop/gopx-drive/app/(app)/notes.tsx)
- Update the archive confirmation dialog's "Archive" button to show "Archiving..." and be disabled when `archiveMutation.isPending` is true.

### [Files Screen]
#### [MODIFY] [files.tsx](file:///Users/gopalverma/Desktop/gopx-drive/app/(app)/files.tsx)
- Update the archive confirmation dialog's "Archive" button to show "Archiving..." and be disabled when `archiveMutation.isPending` is true.

### [Archive Screen]
#### [MODIFY] [archive.tsx](file:///Users/gopalverma/Desktop/gopx-drive/app/(app)/archive.tsx)
- Update the delete confirmation dialog's "Delete" button to show "Deleting..." and be disabled when any relevant delete mutation is pending.
- Specifically, check:
    - `deleteNoteMutation.isPending`
    - `deleteFileMutation.isPending`
    - `deleteFolderMutation.isPending`

## Verification Plan

### Manual Verification
1.  **Home Screen Archive**:
    - Long press a note/file and select "Archive".
    - Verify a confirmation dialog appears.
    - Click "Archive" and verify it says "Archiving..." briefly before closing.
2.  **Notes/Files Screen Archive**:
    - Select "Archive" for a note/file.
    - Verify the confirmation dialog shows "Archiving..." after clicking "Archive".
3.  **Archive Screen Delete**:
    - In the Archive tab, select "Delete".
    - Verify the confirmation dialog shows "Deleting..." after clicking "Delete".
