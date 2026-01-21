import { TO_CLIP_GLSL } from "../../../shaders/common.glsl";
import type { SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BulletVisualConfig } from "./bullet.types";

export const DEFAULT_BATCH_CAPACITY = 256;

// Instance data layout: posX, posY, movementRotation, visualRotation, radius, active
export const INSTANCE_FLOATS = 6;
export const INSTANCE_STRIDE = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

export const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

// Per-vertex (unit quad)
in vec2 a_unitPosition;

// Per-instance
in vec2 a_instancePosition;
in float a_instanceMovementRotation;
in float a_instanceVisualRotation;
in float a_instanceRadius;
in float a_instanceActive;

// Uniforms
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_tailLengthMul;
uniform float u_tailWidthMul;
uniform float u_tailTaperMul;
uniform float u_tailOffsetMul;
uniform int u_shapeType; // 0 = circle, 1 = sprite
uniform int u_renderPass; // 0 = tail, 1 = bullet

// Outputs
out vec2 v_tailPos;
out vec2 v_tailLocalPos;
out vec2 v_bulletPos;
out vec2 v_bulletLocalPos;
out vec2 v_uv;
out float v_radius;
out float v_tailLength;
out float v_tailWidth;
out float v_tailOffset;

` + TO_CLIP_GLSL + `

void main() {
  if (a_instanceActive < 0.5) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }
  
  float tailLength = a_instanceRadius * u_tailLengthMul;
  float tailWidth = a_instanceRadius * u_tailWidthMul;
  float tailOffset = a_instanceRadius * u_tailOffsetMul;
  
  // Scale local position to cover bullet + tail
  float tailScaleX = a_instanceRadius + tailLength;
  float tailScaleY = max(a_instanceRadius, tailWidth);
  
  vec2 unitPosition = a_unitPosition * 2.0;
  vec2 tailLocalPos = unitPosition * vec2(tailScaleX, tailScaleY) + vec2(tailOffset, 0.0);
  vec2 bulletLocalPos = unitPosition * vec2(a_instanceRadius, a_instanceRadius);
  
  // Rotate
  float tailC = cos(a_instanceMovementRotation);
  float tailS = sin(a_instanceMovementRotation);
  vec2 rotatedTailPos = vec2(
    tailLocalPos.x * tailC - tailLocalPos.y * tailS,
    tailLocalPos.x * tailS + tailLocalPos.y * tailC
  );
  float bulletC = cos(a_instanceVisualRotation);
  float bulletS = sin(a_instanceVisualRotation);
  vec2 rotatedBulletPos = vec2(
    bulletLocalPos.x * bulletC - bulletLocalPos.y * bulletS,
    bulletLocalPos.x * bulletS + bulletLocalPos.y * bulletC
  );
  
  vec2 worldPos = u_renderPass == 0
    ? a_instancePosition + rotatedTailPos
    : a_instancePosition + rotatedBulletPos;
  
  // To clip space (same formula as PetalAuraGpuRenderer)
  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  v_tailPos = rotatedTailPos;
  v_tailLocalPos = tailLocalPos;
  v_bulletPos = rotatedBulletPos;
  v_bulletLocalPos = bulletLocalPos;
  // UV for sprite sampling: map [-1,1] to [0,1]
  v_uv = unitPosition * 0.5 + 0.5;
  v_radius = a_instanceRadius;
  v_tailLength = tailLength;
  v_tailWidth = tailWidth;
  v_tailOffset = tailOffset;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_tailPos;
in vec2 v_tailLocalPos;
in vec2 v_bulletPos;
in vec2 v_bulletLocalPos;
in vec2 v_uv;
in float v_radius;
in float v_tailLength;
in float v_tailWidth;
in float v_tailOffset;

uniform vec4 u_bodyColor;
uniform vec4 u_tailStartColor;
uniform vec4 u_tailEndColor;
uniform float u_tailTaperMul;
uniform int u_shapeType; // 0 = circle, 1 = sprite
uniform int u_renderPass; // 0 = tail, 1 = bullet
uniform vec4 u_centerColor;
uniform vec4 u_edgeColor;
uniform int u_useRadialGradient;
uniform highp sampler2DArray u_spriteArray;
uniform int u_spriteIndex;

out vec4 fragColor;

void main() {
  if (u_renderPass == 1) {
    vec2 pos = v_bulletPos;
    float dist = length(pos);

    if (u_shapeType == 0) {
      if (dist < v_radius) {
        float edge = smoothstep(v_radius, v_radius - 1.0, dist);

        vec4 bodyCol;
        if (u_useRadialGradient == 1) {
          float t = dist / v_radius;
          bodyCol = mix(u_centerColor, u_edgeColor, t);
        } else {
          bodyCol = u_bodyColor;
        }

        fragColor = vec4(bodyCol.rgb, bodyCol.a * edge);
        return;
      }
    } else {
      float spriteHalf = v_radius * 0.5;
      vec2 spritePos = v_bulletLocalPos;

      if (abs(spritePos.x) < spriteHalf && abs(spritePos.y) < spriteHalf) {
        float u = (spritePos.x / spriteHalf) * 0.5 + 0.5;
        float v = (spritePos.y / spriteHalf) * 0.5 + 0.5;
        v = 1.0 - v;

        vec4 spriteColor = texture(u_spriteArray, vec3(u, v, float(u_spriteIndex)));
        if (spriteColor.a > 0.01) {
          fragColor = spriteColor;
          return;
        }
      }
    }

    discard;
  }

  vec2 pos = v_tailLocalPos;
  float tailStartX = v_tailOffset;
  float tailEndX = v_tailOffset - v_tailLength;

  if (pos.x < tailStartX && pos.x > tailEndX) {
    float t = (tailStartX - pos.x) / v_tailLength;
    float tailWidthAtX = v_tailWidth * (1.0 - t * u_tailTaperMul);

    if (abs(pos.y) < tailWidthAtX) {
      float edgeFade = 1.0 - abs(pos.y) / tailWidthAtX;
      vec4 tailColor = mix(u_tailStartColor, u_tailEndColor, t);
      fragColor = vec4(tailColor.rgb, tailColor.a * edgeFade);
      return;
    }
  }

  discard;
}
`;

export const DEFAULT_BULLET_VISUAL: BulletVisualConfig = {
  visualKey: "default",
  bodyColor: { r: 0.4, g: 0.6, b: 1.0, a: 1.0 },
  tailStartColor: { r: 0.25, g: 0.45, b: 1.0, a: 0.65 },
  tailEndColor: { r: 0.05, g: 0.15, b: 0.6, a: 0.0 },
  tailLengthMultiplier: 4.5,
  tailWidthMultiplier: 2,
  tailTaperMultiplier: 0.7,
  shape: "circle",
};

export const createBulletVisualConfig = (
  visualKey: string,
  overrides: Partial<Omit<BulletVisualConfig, "visualKey">> = {}
): BulletVisualConfig => ({
  ...DEFAULT_BULLET_VISUAL,
  ...overrides,
  visualKey,
});
