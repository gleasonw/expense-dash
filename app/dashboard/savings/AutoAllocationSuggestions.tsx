"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  generateSuggestedAllocations,
  applySuggestedAllocations,
} from "../bucket_actions";
import { useRouter } from "next/navigation";

type Suggestion = {
  transactionId: string;
  transactionName: string;
  bucketId: number;
  bucketName: string;
  amount: string;
  transactionDate: string;
};

export function AutoAllocationSuggestions({
  currentMonth,
  hasOngoingBuckets,
}: {
  currentMonth: string;
  hasOngoingBuckets: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  if (!hasOngoingBuckets) {
    return null;
  }

  const handleGenerateSuggestions = async () => {
    setLoading(true);
    try {
      const result = await generateSuggestedAllocations(currentMonth);
      setSuggestions(result);
      setShowSuggestions(true);
    } catch (err) {
      console.error("Failed to generate suggestions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestions = async () => {
    if (suggestions.length === 0) return;

    setLoading(true);
    try {
      await applySuggestedAllocations(suggestions);
      setSuggestions([]);
      setShowSuggestions(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to apply suggestions", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Auto-Allocation Suggestions</h3>
        <div className="flex gap-2">
          {!showSuggestions && (
            <Button
              onClick={handleGenerateSuggestions}
              disabled={loading}
              variant="outline"
            >
              {loading ? "Generating..." : "Generate Suggestions"}
            </Button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <>
              <Button
                onClick={() => setShowSuggestions(false)}
                variant="outline"
              >
                Hide
              </Button>
              <Button onClick={handleApplySuggestions} disabled={loading}>
                {loading
                  ? "Applying..."
                  : `Apply ${suggestions.length} Suggestions`}
              </Button>
            </>
          )}
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-3">
            Suggested allocations based on your ongoing bucket percentages:
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                className="text-sm text-blue-800 flex justify-between"
              >
                <span>
                  {s.transactionName} → {s.bucketName}
                </span>
                <span className="font-semibold">${s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            No suggestions available. All transactions may already be allocated.
          </p>
        </div>
      )}
    </div>
  );
}
