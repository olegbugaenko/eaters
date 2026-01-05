export type MapUnlockCondition<TMapId extends string = string> = {
  readonly type: "map";
  readonly id: TMapId;
  readonly level: number;
};

export type SkillUnlockCondition<TSkillId extends string = string> = {
  readonly type: "skill";
  readonly id: TSkillId;
  readonly level: number;
};

export type UnlockCondition<
  TMapId extends string = string,
  TSkillId extends string = string
> = MapUnlockCondition<TMapId> | SkillUnlockCondition<TSkillId>;

export type UnlockConditionList<
  TMapId extends string = string,
  TSkillId extends string = string
> = readonly UnlockCondition<TMapId, TSkillId>[];
