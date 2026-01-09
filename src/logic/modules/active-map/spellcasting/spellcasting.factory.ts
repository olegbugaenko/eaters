import { SkillId } from "../../../../db/skills-db";
import { ServiceDefinition } from "../../../core/loader/types";
import { SkillTreeModule } from "../../camp/skill-tree/skill-tree.module";
import { SpellcastingModule } from "./spellcasting.module";

export const createSpellcastingDefinition = (): ServiceDefinition<SpellcastingModule, "spellcasting"> => ({
  token: "spellcasting",
  factory: (container) =>
    new SpellcastingModule({
      bridge: container.get("bridge"),
      scene: container.get("sceneObjects"),
      necromancer: container.get("necromancer"),
      bricks: container.get("bricks"),
      bonuses: container.get("bonuses"),
      explosions: container.get("explosion"),
      projectiles: container.get("unitProjectiles"),
      runState: container.get("mapRunState"),
      getSkillLevel: (id: SkillId) => container.get<SkillTreeModule>("skillTree").getLevel(id),
    }),
  registerAsModule: true,
  dependsOn: ["necromancer", "bricks", "bonuses", "explosion", "unitProjectiles", "skillTree"],
});
