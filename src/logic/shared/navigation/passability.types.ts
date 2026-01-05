export type PassabilityTag = "enemy" | string;

export interface PassabilityProfile {
  /**
   * Tags that describe which actors may move through an obstacle.
   * Empty/undefined means the obstacle is blocking for everyone.
   */
  readonly passableFor?: readonly PassabilityTag[];
}

export const isPassableFor = (
  profile: PassabilityProfile | undefined,
  tag: PassabilityTag
): boolean => profile?.passableFor?.includes(tag) ?? false;

