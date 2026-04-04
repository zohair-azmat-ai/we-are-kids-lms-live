"use client";

import { useEffect } from "react";


const BASE_TITLE = "We Are Kids Nursery";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ${BASE_TITLE}`;
  }, [title]);
}
