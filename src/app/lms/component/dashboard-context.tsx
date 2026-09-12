"use client";

import { createContext, useContext } from "react";

export const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  hasSidebar: boolean;
}>({ isCollapsed: true, setIsCollapsed: () => {}, hasSidebar: false });

export const useSidebar = () => useContext(SidebarContext);
