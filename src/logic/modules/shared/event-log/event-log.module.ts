import { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { GameModule } from "@core/logic/types";
import { sanitizeNonNegativeNumber } from "../../../../shared/helpers/numbers.helper";
import { TestTimeModule } from "../time/time.module";
import { EVENT_LOG_BRIDGE_KEY } from "./event-log.const";
import type { EventLogEntry, EventLogEntryType, EventLogSaveData } from "./event-log.types";

interface EventLogModuleOptions {
  bridge: DataBridge;
  time: TestTimeModule;
}

export class EventLogModule implements GameModule {
  public readonly id = "eventLog";

  private readonly bridge: DataBridge;
  private readonly time: TestTimeModule;
  private events: EventLogEntry[] = [];

  constructor(options: EventLogModuleOptions) {
    this.bridge = options.bridge;
    this.time = options.time;
  }

  public initialize(): void {
    this.push();
  }

  public reset(): void {
    this.events = [];
    this.push();
  }

  public load(data: unknown | undefined): void {
    if (data && typeof data === "object" && "events" in data) {
      const parsed = (data as EventLogSaveData).events;
      this.events = this.sanitizeEvents(parsed);
    } else {
      this.events = [];
    }
    this.push();
  }

  public save(): unknown {
    return {
      events: [...this.events],
    } satisfies EventLogSaveData;
  }

  public tick(): void {
    // no-op
  }

  public registerEvent(type: EventLogEntryType, text: string): void {
    const next: EventLogEntry = {
      realTimeMs: Date.now(),
      gameTimeMs: this.time.getTimePlayedMs(),
      type,
      text,
    };
    this.events = [...this.events, next];
    this.push();
  }

  public getEvents(): EventLogEntry[] {
    return [...this.events];
  }

  private sanitizeEvents(entries: unknown): EventLogEntry[] {
    if (!Array.isArray(entries)) {
      return [];
    }
    return entries
      .map((entry) => {
        if (typeof entry !== "object" || entry === null) {
          return null;
        }
        const typed = entry as Partial<EventLogEntry>;
        const realTimeMs = sanitizeNonNegativeNumber(typed.realTimeMs);
        const gameTimeMs = sanitizeNonNegativeNumber(typed.gameTimeMs);
        const text = typeof typed.text === "string" ? typed.text : "";
        const type =
          typed.type === "map-cleared" || typed.type === "skill-obtained"
            ? typed.type
            : null;
        if (!type || !text) {
          return null;
        }
        return { realTimeMs, gameTimeMs, text, type };
      })
      .filter((entry): entry is EventLogEntry => Boolean(entry));
  }

  private push(): void {
    DataBridgeHelpers.pushState(this.bridge, EVENT_LOG_BRIDGE_KEY, [...this.events]);
  }
}
