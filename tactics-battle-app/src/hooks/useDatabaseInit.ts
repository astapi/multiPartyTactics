import { useEffect, useState } from "react";
import { initializeDatabase } from "@/db/database";

export const useDatabaseInit = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await initializeDatabase();
        if (active) setReady(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Database init failed");
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  return { ready, error };
};
