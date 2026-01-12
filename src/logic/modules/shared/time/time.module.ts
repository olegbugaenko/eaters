import { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { GameModule } from "@core/logic/types";
import { TIME_BRIDGE_KEY, TIME_PLAYED_PUBLISH_INTERVAL_MS } from "./time.const";

interface TestTimeModuleOptions {
  bridge: DataBridge;
}

export class TestTimeModule implements GameModule {
  public readonly id = "test-time";
  private timePlayedMs = 0;
  private lastPublishedMs = 0;

  constructor(private readonly options: TestTimeModuleOptions) {}

  public initialize(): void {
    this.pushState();
  }

  public reset(): void {
    this.timePlayedMs = 0;
    this.lastPublishedMs = 0;
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    if (typeof data === "object" && data !== null && "timePlayedMs" in data) {
      const typed = data as { timePlayedMs: number };
      this.timePlayedMs = typed.timePlayedMs ?? 0;
    }
    this.lastPublishedMs = this.timePlayedMs;
    this.pushState();
  }

  public save(): unknown {
    return {
      timePlayedMs: this.timePlayedMs,
    };
  }

  public tick(deltaMs: number): void {
    this.timePlayedMs += deltaMs;
    if (this.timePlayedMs - this.lastPublishedMs >= TIME_PLAYED_PUBLISH_INTERVAL_MS) {
      this.lastPublishedMs = this.timePlayedMs;
      this.pushState();
    }
  }

  public getTimePlayedMs(): number {
    return this.timePlayedMs;
  }

  private pushState(): void {
    DataBridgeHelpers.pushState(this.options.bridge, TIME_BRIDGE_KEY, this.timePlayedMs);
  }
}

export { TIME_BRIDGE_KEY } from "./time.const";
