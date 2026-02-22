export type FloatingTextKind = "damage" | "heal";

export interface FloatingDamageTextEvent {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly amount: number;
  readonly targetType: string;
  readonly isCritical?: boolean;
  readonly kind?: FloatingTextKind;
}

export interface FloatingDamageTextBridgePayload {
  readonly revision: number;
  readonly events: FloatingDamageTextEvent[];
  readonly clear?: boolean;
}
