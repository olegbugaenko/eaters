import { SkillId } from "../../../db/skills-db";
import { ServiceDefinition } from "../../core/loader/types";
import { SkillTreeModule } from "../skill-tree/skill-tree.module";
import { SpellcastingModule } from "./spellcasting.module";

export const createSpellcastingDefinition = (): ServiceDefinition<SpellcastingModule> => ({
  token: "spellcasting",
  factory: (container) =>
    new SpellcastingModule({
      bridge: container.get("bridge"),
      scene: container.get("sceneObjects"),
      necromancer: container.get("necromancer"),
      bricks: container.get("bricks"),
      bonuses: container.get("bonuses"),
      explosions: container.get("explosion"),
      runState: container.get("mapRunState"),
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
    }),
  registerAsModule: true,
});
