import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Platform, TextInput, type TextInputProps } from "react-native";

const Input = forwardRef<TextInput, TextInputProps>(
  function Input({ className, multiline, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : undefined}
        className={cn(
          " border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5",
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
