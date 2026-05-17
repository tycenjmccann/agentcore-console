"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-surface-4 bg-surface-2 px-3 py-2 text-sm",
          "text-gray-200 placeholder:text-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

interface SelectGroupProps extends React.OptgroupHTMLAttributes<HTMLOptGroupElement> {
  children: React.ReactNode;
}

const SelectGroup = React.forwardRef<HTMLOptGroupElement, SelectGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <optgroup
        ref={ref}
        className={cn("font-semibold text-gray-400", className)}
        {...props}
      >
        {children}
      </optgroup>
    );
  }
);
SelectGroup.displayName = "SelectGroup";

interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  children: React.ReactNode;
}

const SelectItem = React.forwardRef<HTMLOptionElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <option
        ref={ref}
        className={cn("py-1.5 px-2 text-sm", className)}
        {...props}
      >
        {children}
      </option>
    );
  }
);
SelectItem.displayName = "SelectItem";

export { Select, SelectGroup, SelectItem };
