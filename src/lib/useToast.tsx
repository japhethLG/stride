/**
 * useToast (CP5) — a tiny in-page replacement for the design's
 * `nav('__toast', { msg })`. The prototype had a single app-level toast host; the
 * production shell has none, so a page that needs the transient confirmation
 * messages the design fired (e.g. "Edit profile", "Local cache cleared") owns a
 * local toast via this hook and renders the returned `<toast />` node (the CP4
 * `Toast` chrome) inside its scroll container.
 *
 * Auto-dismisses after 2.2s to match the design's timer.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@/components/chrome";

export interface UseToast {
  /** Show a transient message. */
  show: (msg: string) => void;
  /** Render this where the toast should appear (absolute-positioned). */
  node: React.ReactNode;
}

export function useToast(): UseToast {
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2200);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { show, node: <Toast msg={msg} /> };
}
