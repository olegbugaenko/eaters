import { ObjectRenderer, ObjectRegistration } from "../../ObjectRenderer";
import type {
  SceneFill,
  SceneObjectInstance,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createDynamicRectanglePrimitive } from "../../../primitives";
import { hasStroke, createStrokeFill, expandSize } from "./helpers";
import { BRICK_CRACK_VARIANTS_PER_STAGE } from "@logic/modules/active-map/bricks/bricks.const";
import { withCrackMask } from "@shared/helpers/scene-fill.helper";
import { textureAtlasRegistry } from "@ui/renderers/textures/TextureAtlasRegistry";

type BrickCustomData = {
  damageStage?: number;
  crackVariant?: number;
  cracksEnabled?: boolean;
  crackDesat?: number;
  crackDarken?: number;
};

export class BrickObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const size = instance.data.size ?? { width: 0, height: 0 };
    const dynamicPrimitives = [];

    if (hasStroke(instance.data.stroke)) {
      const initialSize = size;
      dynamicPrimitives.push(
        createDynamicRectanglePrimitive(instance, {
          getSize: (target) => {
            const sizeSource = target.data.size ?? initialSize;
            const strokeSource = target.data.stroke; // rely on current stroke only
            const strokeWidth = strokeSource?.width ?? 0;
            if (!strokeSource || strokeWidth <= 0) {
              return { ...sizeSource };
            }
            return expandSize(sizeSource, strokeWidth);
          },
          getFill: (target) => {
            const strokeSource = target.data.stroke; // rely on current stroke only
            return strokeSource ? createStrokeFill(strokeSource) : target.data.fill;
          },
        })
      );
    }

    const variantsPerStage = Math.max(BRICK_CRACK_VARIANTS_PER_STAGE, 1);
    let cachedDamageStage = Number.NaN;
    let cachedCrackVariant = Number.NaN;
    let cachedBaseFill: SceneFill | null = null;
    let cachedFill: SceneFill | null = null;
    dynamicPrimitives.push(
      createDynamicRectanglePrimitive(instance, {
        getFill: (target) => {
          const customData = target.data.customData as BrickCustomData | undefined;
          const damageStage = customData?.damageStage ?? 0;
          const crackVariant = customData?.crackVariant ?? 0;
          const cracksEnabled = customData?.cracksEnabled !== false;
          const crackDesat = customData?.crackDesat ?? 2.0;
          const crackDarken = customData?.crackDarken ?? 0.5;
          const baseFill = target.data.fill ?? instance.data.fill;

          if (
            cachedFill &&
            damageStage === cachedDamageStage &&
            crackVariant === cachedCrackVariant &&
            baseFill === cachedBaseFill
          ) {
            return cachedFill;
          }

          if (!cracksEnabled || damageStage === 0) {
            cachedFill = baseFill;
            cachedDamageStage = damageStage;
            cachedCrackVariant = crackVariant;
            cachedBaseFill = baseFill;
            return cachedFill;
          }

          const atlasId = textureAtlasRegistry.getAtlasIndex("cracks");
          const tileIndex = Math.max(damageStage - 1, 0) * variantsPerStage + crackVariant;
          const crackStrength = 0.75;
          cachedFill = withCrackMask(baseFill, {
            atlasId,
            tileIndex,
            strength: crackStrength,
            desat: crackDesat,
            darken: crackDarken,
          });
          cachedDamageStage = damageStage;
          cachedCrackVariant = crackVariant;
          cachedBaseFill = baseFill;
          return cachedFill;
        },
      })
    );

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
