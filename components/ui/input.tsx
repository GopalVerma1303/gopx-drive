import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Platform, TextInput, type TextInputProps } from "react-native";

const Input = forwardRef<TextInput, TextInputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        className={cn(
          // Base input styles.
          // IMPORTANT: don't force a fixed height for multiline inputs (e.g. editor/textarea),
          // otherwise the TextInput can't fill its container or scroll properly.
          "border-input bg-background text-foreground w-full min-w-0 rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5",
          props.multiline ? "min-h-0" : "flex h-10 flex-row items-center",
          props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({
              web: "disabled:pointer-events-none disabled:cursor-not-allowed",
            })
          ),
          Platform.select({
            web: cn(
              "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] ",
              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
            ),
            native: "placeholder:text-muted-foreground/50",
          }),
          className
        )}
        {...props}
      />
    );
  }
);

export { Input };
