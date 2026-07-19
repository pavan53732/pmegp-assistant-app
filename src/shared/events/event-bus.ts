import type { AnyAppEvent, EventHandler, EventTypeMap } from "./event-types";

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();
  private history: AnyAppEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory = 100) { this.maxHistory = maxHistory; }

  on<K extends keyof EventTypeMap>(eventType: K, handler: EventHandler<EventTypeMap[K]>): () => void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType)!.add(handler as EventHandler);
    return () => { this.handlers.get(eventType)?.delete(handler as EventHandler); };
  }

  onAny(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => { this.wildcardHandlers.delete(handler); };
  }

  emit(event: AnyAppEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();

    const typedHandlers = this.handlers.get(event.type);
    if (typedHandlers) for (const h of typedHandlers) { try { h(event); } catch (e) { console.error(`[EventBus] ${event.type}:`, e); } }
    for (const h of this.wildcardHandlers) { try { h(event); } catch (e) { console.error(`[EventBus] wildcard:`, e); } }
  }

  off(eventType: string): void { this.handlers.delete(eventType); }
  clear(): void { this.handlers.clear(); this.wildcardHandlers.clear(); }
  getHistory(): readonly AnyAppEvent[] { return this.history; }
  listenerCount(eventType?: string): number {
    if (eventType) return this.handlers.get(eventType)?.size ?? 0;
    let t = 0; for (const h of this.handlers.values()) t += h.size;
    return t + this.wildcardHandlers.size;
  }
}

let _instance: EventBus | null = null;
export function getEventBus(): EventBus { if (!_instance) _instance = new EventBus(); return _instance; }