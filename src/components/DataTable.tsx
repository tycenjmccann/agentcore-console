"use client";

import { useState, useMemo, useCallback, useEffect, useRef, useId } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, SearchX, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  comparator?: (a: T, b: T) => number;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  filterPlaceholder?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  getRowKey: (row: T) => string;
}

// ─── Default comparator ──────────────────────────────────────────────────────

function defaultComparator<T>(key: string) {
  return (a: T, b: T): number => {
    const aVal = (a as Record<string, unknown>)[key];
    const bVal = (b as Record<string, unknown>)[key];

    // Handle null/undefined
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return -1;
    if (bVal == null) return 1;

    // Numeric detection
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }

    // Locale-aware string compare
    return String(aVal).localeCompare(String(bVal), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };
}

// ─── Debounce hook ───────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  filterPlaceholder = "Filter rows...",
  emptyMessage = "No results match your filter.",
  onRowClick,
  getRowKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [filterText, setFilterText] = useState("");
  const debouncedFilter = useDebounce(filterText, 150);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterId = useId();

  // ─── Sort cycling ────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (key: string) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDirection("asc");
      } else if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortKey(null);
        setSortDirection(null);
      }
    },
    [sortKey, sortDirection]
  );

  // ─── Filtered + sorted data ──────────────────────────────────────────────
  const processedData = useMemo(() => {
    let result = data;

    // Filter
    if (debouncedFilter) {
      const lower = debouncedFilter.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const value = (row as Record<string, unknown>)[col.key];
          if (value == null) return false;
          return String(value).toLowerCase().includes(lower);
        })
      );
    }

    // Sort
    if (sortKey && sortDirection) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        const comparator = col.comparator || defaultComparator<T>(sortKey);
        const direction = sortDirection === "asc" ? 1 : -1;
        result = [...result].sort((a, b) => comparator(a, b) * direction);
      }
    }

    return result;
  }, [data, debouncedFilter, sortKey, sortDirection, columns]);

  // ─── Get aria-sort value ─────────────────────────────────────────────────
  const getAriaSort = (key: string): "ascending" | "descending" | "none" => {
    if (sortKey !== key) return "none";
    if (sortDirection === "asc") return "ascending";
    if (sortDirection === "desc") return "descending";
    return "none";
  };

  // ─── Render sort icon ────────────────────────────────────────────────────
  const renderSortIcon = (key: string) => {
    if (sortKey === key && sortDirection === "asc") {
      return <ChevronUp className="w-4 h-4 text-brand-400" />;
    }
    if (sortKey === key && sortDirection === "desc") {
      return <ChevronDown className="w-4 h-4 text-brand-400" />;
    }
    return <ChevronsUpDown className="w-4 h-4 text-[--color-text-muted]" />;
  };

  // ─── Clear filter ────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setFilterText("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className="space-y-3">
      {/* Filter input */}
      <div className="relative">
        <label htmlFor={filterId} className="sr-only">
          Filter table rows
        </label>
        <input
          ref={inputRef}
          id={filterId}
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={filterPlaceholder}
          className="w-full px-4 py-2 rounded-lg border border-[--color-border] bg-surface-1 text-[--color-text-primary] placeholder:text-[--color-text-muted] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        {filterText && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[--color-text-muted] hover:text-[--color-text-primary]"
            aria-label="Clear filter"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table container */}
      <div className="border border-[--color-border] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-3">
                {columns.map((col) => {
                  const isSortable = col.sortable !== false;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={isSortable ? getAriaSort(col.key) : undefined}
                      className="px-4 py-3 text-left font-semibold text-[--color-text-secondary] whitespace-nowrap"
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className="inline-flex items-center gap-1 hover:text-[--color-text-primary]"
                        >
                          {col.header}
                          {renderSortIcon(col.key)}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {processedData.map((row, index) => {
                const isEven = index % 2 === 0;
                return (
                  <tr
                    key={getRowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-[--color-border] last:border-b-0",
                      isEven ? "bg-surface-1" : "bg-surface-2",
                      "hover:bg-surface-3",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col) => {
                      const value = (row as Record<string, unknown>)[col.key];
                      return (
                        <td
                          key={col.key}
                          className="px-4 py-3 text-[--color-text-primary] whitespace-nowrap"
                        >
                          {col.render ? col.render(value, row) : (value != null ? String(value) : "—")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {processedData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <SearchX className="w-10 h-10 text-[--color-text-muted] mb-3" />
            <p className="text-sm text-[--color-text-muted]">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataTable;
