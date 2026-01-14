"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface ViewToggleProps {
  defaultView?: "month" | "aggregate";
}

export function ViewToggle({ defaultView = "month" }: ViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = (searchParams.get("view") ?? defaultView) as
    | "month"
    | "aggregate";

  const handleViewChange = (view: "month" | "aggregate") => {
    const currentURL = new URL(window.location.href);
    if (view === defaultView) {
      currentURL.searchParams.delete("view");
    } else {
      currentURL.searchParams.set("view", view);
    }
    router.push(currentURL.toString());
  };

  return (
    <div className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500">
      <button
        onClick={() => handleViewChange("month")}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
          currentView === "month"
            ? "bg-white text-gray-900 shadow-sm"
            : "hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        Month View
      </button>
      <button
        onClick={() => handleViewChange("aggregate")}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
          currentView === "aggregate"
            ? "bg-white text-gray-900 shadow-sm"
            : "hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        Aggregate View
      </button>
    </div>
  );
}
