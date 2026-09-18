// categoryService.ts — plain fetch layer for /categories/*.
//
// This module used to keep a 15-minute module-level cache plus a 2-minute
// setInterval background poll that started on the FIRST fetchCategories call
// and never stopped (cleanupCategories had no callers) — dispatching a
// 'categoriesDataUpdated' CustomEvent that nothing listened to. Any page that
// touched categories (including the Course Setup panel, which doesn't even
// use them) ignited permanent 2-minute polling for the life of the tab.
// Caching now lives in the React Query layer of each consumer.

import { http as apiClient } from "@/lib/http";

export const fetchCategories = async (_forceRefresh = false) => {
  const response = await apiClient.get("/categories/getAll");
  const categories = response.data.data;
  return { categories };
};

// Category Service
export const categoryService = {
  createCategory: async (categoryData: {
    categoryName: string;
    categoryDescription?: string;
    categoryCode?: string;
    isActive?: boolean;
    courseNames?: string[];
  }) => {
    try {
      const response = await apiClient.post("/categories/create", categoryData);
      return response.data;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  },

  getAllCategories: async () => {
    const { categories } = await fetchCategories();
    return { data: categories };
  },

  getCategoryById: async (categoryId: string) => {
    try {
      const response = await apiClient.get(`/categories/getById/${categoryId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching category:", error);
      throw error;
    }
  },

  updateCategory: async (
    categoryId: string,
    updateData: {
      categoryName?: string;
      categoryDescription?: string;
      categoryCode?: string;
      isActive?: boolean;
      courseNames?: string[];
    }
  ) => {
    try {
      const response = await apiClient.put(
        `/categories/update/${categoryId}`,
        updateData
      );
      return response.data;
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  },

  deleteCategory: async (categoryId: string) => {
    try {
      const response = await apiClient.delete(
        `/categories/delete/${categoryId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  },
};
