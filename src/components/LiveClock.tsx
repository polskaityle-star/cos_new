"use client";

import { useState, useEffect } from "react";

export default function LiveClock() {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString("pl-PL", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timePart = now.toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setTimeStr(`${datePart} • ${timePart}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) {
    return (
      <span className="text-xs bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-lg font-mono text-cyan-300">
        🕒 Wczytywanie czasu...
      </span>
    );
  }

  return (
    <span className="text-xs bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg font-mono text-cyan-300 flex items-center gap-1.5 shadow-xs">
      <span>🕒</span>
      <span>{timeStr}</span>
    </span>
  );
}
