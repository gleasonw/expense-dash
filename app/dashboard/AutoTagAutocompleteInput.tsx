"use client";

import { useId, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SUGGESTION_DEBOUNCE_MS = 250;

type AutoTagAutocompleteInputProps = {
  label: string;
  name: string;
  placeholder?: string;
  queryParam: string;
  suggestions: string[];
  required?: boolean;
};

export function AutoTagAutocompleteInput({
  label,
  name,
  placeholder,
  queryParam,
  suggestions,
  required = false,
}: AutoTagAutocompleteInputProps) {
  const listId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultValue = searchParams.get(queryParam) ?? "";

  const scheduleSearchParamUpdate = (nextValue: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      const trimmed = nextValue.trim();

      if (trimmed.length === 0) {
        params.delete(queryParam);
      } else {
        params.set(queryParam, trimmed);
      }

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    }, SUGGESTION_DEBOUNCE_MS);
  };

  return (
    <label className="flex flex-col text-sm gap-1">
      {label}
      <input
        name={name}
        type="text"
        list={listId}
        className="border rounded-md px-2 py-1 shadow-xs"
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        onChange={(event) => scheduleSearchParamUpdate(event.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </label>
  );
}
