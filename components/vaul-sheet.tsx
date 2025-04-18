"use client";

import { Drawer } from "vaul";
export default function VaulSheet({
  children,
  content,
  open,
  onOpenChange,
}: {
  children?: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = open !== undefined;

  return (
    <Drawer.Root
      open={isControlled ? open : undefined}
      onOpenChange={isControlled ? onOpenChange : undefined}
    >
      {!isControlled && (
        <Drawer.Trigger className="w-full">{children}</Drawer.Trigger>
      )}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="flex flex-col rounded-t-[10px] h-fit fixed bottom-0 left-0 right-0 outline-none z-20">
          <Drawer.Title className="font-medium mb-4 text-gray-900">
            Drawer for React.
          </Drawer.Title>
          {content}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
