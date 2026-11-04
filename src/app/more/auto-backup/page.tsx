"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** «Автокопия» is a part of «Копия данных» now (mockup КД2): the old address leads there. */
export default function AutoBackupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/more/backup/");
  }, [router]);
  return null;
}
