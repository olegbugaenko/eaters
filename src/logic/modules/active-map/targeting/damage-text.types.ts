export interface FloatingDamageTextEvent {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly amount: number;
  readonly targetType: string;
}

export interface FloatingDamageTextBridgePayload {
  readonly revision: number;
  readonly events: FloatingDamageTextEvent[];
}
