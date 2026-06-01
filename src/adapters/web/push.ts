/**
 * WebPushService — no-op stub today (CLAUDE.md §4, plan §4.1).
 *
 * The interface exists so feature code needs no later branching. FCM wiring lands
 * with the Capacitor shell (NativePushService).
 */
import type { PushService, PushPermission } from "@/adapters/types";

export class WebPushService implements PushService {
  async requestPermission(): Promise<PushPermission> {
    return "unsupported";
  }

  async getToken(): Promise<string | null> {
    return null;
  }
}
