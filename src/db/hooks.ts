"use client";

import { useEffect, useState, type DependencyList } from "react";
import type { StoreName } from "@/domain/types";
import { onChange } from "./events";

export interface LiveResult<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * Runs an async query and re-runs it when deps change or when any of `stores` is written to.
 * Without `stores`, any write triggers a refresh.
 */
export function useLive<T>(query: () => Promise<T>, deps: DependencyList, stores?: StoreName[]): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ data: undefined, error: undefined, loading: true });
  const [version, setVersion] = useState(0);
  const storesKey = stores?.join(",") ?? "*";

  useEffect(() => {
    const watched = storesKey === "*" ? null : storesKey.split(",");
    return onChange((changed) => {
      if (!watched || watched.some((s) => changed.has(s as StoreName))) setVersion((v) => v + 1);
    });
  }, [storesKey]);

  useEffect(() => {
    let alive = true;
    query().then(
      (data) => alive && setState({ data, error: undefined, loading: false }),
      (error) => {
        console.error(error);
        if (alive) setState((s) => ({ data: s.data, error, loading: false }));
      },
    );
    return () => {
      alive = false;
    };
    // The query closure changes every render; deps describe what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return state;
}
