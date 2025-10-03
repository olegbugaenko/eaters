import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";

const BRIDGE_KEY = "time-played";

interface TestTimeModuleOptions {
  bridge: DataBridge;
}

export class TestTimeModule implements GameModule {
  public readonly id = "test-time";
  private timePlayedMs = 0;

  constructor(private readonly options: TestTimeModuleOptions) {}

  public initialize(): void {
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    if (typeof data === "object" && data !== null && "timePlayedMs" in data) {
      const typed = data as { timePlayedMs: number };
      this.timePlayedMs = typed.timePlayedMs ?? 0;
    }
    this.pushState();
  }

  public save(): unknown {
    return {
      timePlayedMs: this.timePlayedMs,
    };
  }

  public tick(deltaMs: number): void {
    this.timePlayedMs += deltaMs;
    this.pushState();
  }

  private pushState(): void {
    this.options.bridge.setValue(BRIDGE_KEY, this.timePlayedMs);
  }
}

export const TIME_BRIDGE_KEY = BRIDGE_KEY;
