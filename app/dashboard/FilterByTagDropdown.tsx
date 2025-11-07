"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterOption = {
  label: string;
  value: string;
};

const ALL_TAG_VALUE = "__all__";

export function FilterByTagDropdown({
  options,
  selectedValue,
}: {
  options: FilterOption[];
  selectedValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === ALL_TAG_VALUE) {
          params.delete("tag");
        } else {
          params.set("tag", value);
        }
        const queryString = params.toString();
        router.push(queryString ? `${pathname}?${queryString}` : pathname);
      }}
      value={selectedValue && selectedValue.length > 0 ? selectedValue : ALL_TAG_VALUE}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Filter by tag" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value || ALL_TAG_VALUE}
            value={option.value || ALL_TAG_VALUE}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
