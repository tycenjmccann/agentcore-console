/**
 * React hook for fetching and caching workflow templates.
 *
 * Used by the enhanced intake card to display template options
 * and pre-fill form fields when a template is selected.
 */

import { useState, useEffect, useCallback } from "react";
import type {
  WorkflowTemplate,
  TemplateCategory,
  TemplateCategoryInfo,
} from "@/lib/workflow/api-types";

interface UseTemplatesReturn {
  templates: WorkflowTemplate[];
  categories: TemplateCategoryInfo[];
  selectedCategory: TemplateCategory | "all";
  isLoading: boolean;
  error: string | null;
  setSelectedCategory: (category: TemplateCategory | "all") => void;
  getTemplate: (id: string) => WorkflowTemplate | undefined;
}

export function useWorkflowTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        const params = selectedCategory !== "all" ? `?category=${selectedCategory}` : "";
        const res = await fetch(`/api/workflow/templates${params}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch templates: ${res.status}`);
        }

        const data = await res.json();
        setTemplates(data.templates);
        setCategories(data.categories);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [selectedCategory]);

  const getTemplate = useCallback(
    (id: string) => templates.find((t) => t.id === id),
    [templates]
  );

  return {
    templates,
    categories,
    selectedCategory,
    isLoading,
    error,
    setSelectedCategory,
    getTemplate,
  };
}
