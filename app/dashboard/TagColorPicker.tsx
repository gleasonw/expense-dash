"use client";

import { updateTag } from "@/app/dashboard/tag_actions";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerEyeDropper,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/shadcn-io/color-picker";
import { rgbToHex } from "@/lib/utils";
import { Tag } from "@/server/schema";
import { PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { useState } from "react";

export function TagColorPicker({ tag }: { tag: Tag }) {
  const [hexColorValue, setHexColorValue] = useState<string>(
    tag.color ?? "#fffff"
  );
  return (
    <form>
      <Popover
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          // we have closed
          updateTag({ ...tag, color: hexColorValue });
        }}
      >
        <PopoverTrigger asChild>
          <Button>Select color for {tag.label}</Button>
        </PopoverTrigger>
        <div style={{ background: tag.color }} className="w-10 h-10" />
        <PopoverContent className="h-32">
          <ColorPicker
            defaultValue={hexColorValue}
            onChange={(rgbArray) => {
              if (!Array.isArray(rgbArray)) {
                return;
              }
              const rgbArrayToInt = rgbArray.map((v) => Math.round(v));
              setHexColorValue(
                rgbToHex(
                  rgbArrayToInt[0]!,
                  rgbArrayToInt[1]!,
                  rgbArrayToInt[2]!
                )
              );
            }}
            className="max-w-sm h-[300px] rounded-md border bg-background p-4 shadow-sm"
          >
            <ColorPickerSelection />
            <div className="flex items-center gap-4">
              <ColorPickerEyeDropper />
              <div className="grid w-full gap-1">
                <ColorPickerHue />
                <ColorPickerAlpha />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ColorPickerOutput />
              <ColorPickerFormat />
            </div>
          </ColorPicker>
        </PopoverContent>
      </Popover>
    </form>
  );
}
