"use client";

import {
  addTagToTransaction_v2,
  removeTagFromTransaction,
} from "@/app/dashboard/actions";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import React from "react";

export function RemoveTagButton({
  transaction,
  tag,
  children,
}: {
  transaction: { transaction_id: string };
  tag: { id: string; color: string };
  children: React.ReactNode;
}) {
  return (
    <button
      className={`bg-${tag.color}-200 text-${tag.color}-800 text-sm  px-1 py-0 rounded-md`}
      onClick={() =>
        removeTagFromTransaction({
          transactionId: transaction.transaction_id,
          tagId: tag.id,
        })
      }
    >
      {children}
    </button>
  );
}

export function AddTagInput({
  tags,
  transaction,
}: {
  tags: Array<{ id: string; tag: string }>;
  transaction: { transaction_id: string };
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          aria-controls="tags"
          className="justify-between hover:cursor-text w-5 h-5"
        />
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Add tag..." />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {tags.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.tag}
                  onSelect={() => {
                    setOpen(false);
                    addTagToTransaction_v2({
                      transactionId: transaction.transaction_id,
                      tagId: t.id,
                      autoTag: false,
                    });
                  }}
                >
                  {t.tag}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
