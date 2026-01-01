import { SkillId } from "../../../../../db/skills-db";
import { SpellcastingModule } from "../../../../modules/active-map/spells/SpellcastingModule";
import { SkillTreeModule } from "../../../../modules/camp/SkillTreeModule";
import { ServiceDefinition } from "../../types";

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
