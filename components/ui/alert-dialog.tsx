import { buttonTextVariants, buttonVariants } from "@/components/ui/button";
import { NativeOnlyAnimatedView } from "@/components/ui/native-only-animated-view";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import * as React from "react";
import { Platform, View, type ViewProps } from "react-native";
import { FadeIn, FadeOut } from "react-native-reanimated";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";

// Wrapper component to ensure single child for Slot
// Use React.createElement to ensure it's recognized as a valid React element
const AlertDialogContentWrapper = React.forwardRef<View, { children: React.ReactNode }>(
  ({ children }, ref) => {
    return React.createElement(
      View,
      { ref, className: "flex flex-col gap-4" },
      children
    );
  }
);
AlertDialogContentWrapper.displayName = "AlertDialogContentWrapper";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const FullWindowOverlay =
  Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function AlertDialogOverlay({
  className,
  children,
  ...props
}: Omit<AlertDialogPrimitive.OverlayProps, "asChild"> &
  React.RefAttributes<AlertDialogPrimitive.OverlayRef> & {
    children?: React.ReactNode;
  }) {
  // On web, don't use NativeOnlyAnimatedView to avoid Slot conflicts
  // CSS animations are handled by Tailwind classes
  if (Platform.OS === "web") {
    return (
      <FullWindowOverlay>
        <AlertDialogPrimitive.Overlay
          className={cn(
            "absolute bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center bg-black/50 p-2 animate-in fade-in-0",
            Platform.select({
              web: "fixed",
            }),
            className
          )}
          {...props}
        >
          {children}
        </AlertDialogPrimitive.Overlay>
      </FullWindowOverlay>
    );
  }

  // On native, use NativeOnlyAnimatedView for animations
  return (
    <FullWindowOverlay>
      <AlertDialogPrimitive.Overlay
        className={cn(
          "absolute bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center bg-black/50 p-2",
          className
        )}
        {...props}
      >
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(200).delay(50)}
          exiting={FadeOut.duration(150)}
        >
          {children}
        </NativeOnlyAnimatedView>
      </AlertDialogPrimitive.Overlay>
    </FullWindowOverlay>
  );
}

function AlertDialogContent({
  className,
  portalHost,
  children,
  ...props
}: Omit<AlertDialogPrimitive.ContentProps, "asChild"> &
  React.RefAttributes<AlertDialogPrimitive.ContentRef> & {
    portalHost?: string;
    children?: React.ReactNode;
  }) {
  // Always wrap children in a single component to satisfy React.Children.only requirement
  // AlertDialogPrimitive.Content uses Slot internally which requires exactly one child
  // Use JSX directly - React.createElement with forwardRef component should work
  const wrappedChildren = React.Children.count(children) === 0 
    ? null 
    : <AlertDialogContentWrapper>{children}</AlertDialogContentWrapper>;

  return (
    <AlertDialogPortal hostName={portalHost}>
      <AlertDialogOverlay>
        <AlertDialogPrimitive.Content
          className={cn(
            "bg-background border-border z-50 flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 rounded-lg border p-6 shadow-lg shadow-black/5 sm:max-w-lg",
            Platform.select({
              web: "animate-in fade-in-0 zoom-in-95 duration-200",
            }),
            className
          )}
          {...props}
        >
          {wrappedChildren}
        </AlertDialogPrimitive.Content>
      </AlertDialogOverlay>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: ViewProps) {
  return (
    <TextClassContext.Provider value="text-center sm:text-left">
      <View className={cn("flex flex-col gap-2", className)} {...props} />
    </TextClassContext.Provider>
  );
}

function AlertDialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.TitleProps &
  React.RefAttributes<AlertDialogPrimitive.TitleRef>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-foreground text-lg font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.DescriptionProps &
  React.RefAttributes<AlertDialogPrimitive.DescriptionRef>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  ...props
}: AlertDialogPrimitive.ActionProps &
  React.RefAttributes<AlertDialogPrimitive.ActionRef>) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ className })}>
      <AlertDialogPrimitive.Action
        className={cn(buttonVariants(), className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function AlertDialogCancel({
  className,
  ...props
}: AlertDialogPrimitive.CancelProps &
  React.RefAttributes<AlertDialogPrimitive.CancelRef>) {
  return (
    <TextClassContext.Provider
      value={buttonTextVariants({ className, variant: "outline" })}
    >
      <AlertDialogPrimitive.Cancel
        className={cn(buttonVariants({ variant: "outline" }), className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
