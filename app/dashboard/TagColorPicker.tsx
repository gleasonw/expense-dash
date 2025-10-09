"use client";

import { updateTag } from "@/app/dashboard/tag_actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag } from "@/server/schema";
import { useState } from "react";

export function TagColorPicker({ tag }: { tag: Tag }) {
  const [colorName, setColorName] = useState<string>(
    tag.color ?? tailwindColorNames[0]
  );

  function handleColorChange(newColor: string) {
    setColorName(newColor);
    updateTag({ ...tag, color: newColor });
  }

  return (
    <form>
      <span>{tag.label}</span>
      <Select onValueChange={handleColorChange} value={colorName}>
        <SelectTrigger>
          <SelectValue placeholder="Select color" />
        </SelectTrigger>
        <SelectContent>
          {tailwindColorNames.map((color) => (
            <SelectItem key={color} value={color}>
              <div className="flex w-full gap-2">
                <div className={`bg-${color}-500 w-4 h-4`}></div>
                <span>{color}</span>{" "}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}

export type TailwindColorNames = (typeof tailwindColorNames)[number];

export const tailwindColorNames = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
] as const;
