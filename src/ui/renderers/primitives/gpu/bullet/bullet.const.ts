import { TO_CLIP_GLSL } from "../../../shaders/common.glsl";
import type { SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BulletVisualConfig } from "./bullet.types";

export const DEFAULT_BATCH_CAPACITY = 256;

// Instance data layout: posX, posY, rotation, radius, active
export const INSTANCE_FLOATS = 5;
export const INSTANCE_STRIDE = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

export const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

// Per-vertex (unit quad)
in vec2 a_unitPosition;

// Per-instance
in vec2 a_instancePosition;
in float a_instanceRotation;
in float a_instanceRadius;
in float a_instanceActive;

// Uniforms
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_tailLengthMul;
uniform float u_tailWidthMul;
uniform float u_tailOffsetMul;
uniform int u_shapeType; // 0 = circle, 1 = sprite

// Outputs
out vec2 v_localPos;
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
  float scaleX = a_instanceRadius + tailLength;
  float scaleY = max(a_instanceRadius, tailWidth);
  
  vec2 localPos = a_unitPosition * vec2(scaleX, scaleY);
  
  // Rotate
  float c = cos(a_instanceRotation);
  float s = sin(a_instanceRotation);
  vec2 rotatedPos = vec2(
    localPos.x * c - localPos.y * s,
    localPos.x * s + localPos.y * c
  );
  
  // World position
  vec2 worldPos = a_instancePosition + rotatedPos;
  
  // To clip space (same formula as PetalAuraGpuRenderer)
  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  v_localPos = a_unitPosition;
  // UV for sprite sampling: map [-1,1] to [0,1]
  v_uv = a_unitPosition * 0.5 + 0.5;
  v_radius = a_instanceRadius;
  v_tailLength = tailLength;
  v_tailWidth = tailWidth;
  v_tailOffset = tailOffset;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_localPos;
in vec2 v_uv;
in float v_radius;
in float v_tailLength;
in float v_tailWidth;
in float v_tailOffset;

uniform vec4 u_bodyColor;
uniform vec4 u_tailStartColor;
uniform vec4 u_tailEndColor;
uniform int u_shapeType; // 0 = circle, 1 = sprite
uniform vec4 u_centerColor;
uniform vec4 u_edgeColor;
uniform int u_useRadialGradient;
uniform highp sampler2DArray u_spriteArray;
uniform int u_spriteIndex;

out vec4 fragColor;

void main() {
  float scaleX = v_radius + v_tailLength;
  float scaleY = max(v_radius, v_tailWidth);
  
  // Convert back to world-relative coords
  vec2 pos = v_localPos * vec2(scaleX, scaleY);
  
  // Distance from center for body
  float dist = length(pos);
  
  // Body (circle or sprite at front)
  if (u_shapeType == 0) {
    // Circle body
    if (dist < v_radius) {
      float edge = smoothstep(v_radius, v_radius - 1.0, dist);
      
      // Radial gradient or solid color
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
    // Sprite body - sample from texture array
    // pos is in world-relative coords (pixels)
    
    // Sprite is square, sized to be visible (3x radius so it's not too tiny)
    vec2 spritePos = v_localPos * vec2(v_radius, v_radius);
    float spriteHalf = v_radius;
    
    // Sprite center is at origin (where bullet center is)
    if (abs(spritePos.x) < spriteHalf && abs(spritePos.y) < spriteHalf) {
      // Map pos to UV [0,1]
      // pos.x from -spriteHalf to +spriteHalf -> u from 0 to 1
      float u = (spritePos.x / spriteHalf) * 0.5 + 0.5;
      float v = (spritePos.y / spriteHalf) * 0.5 + 0.5;
      // Flip V for correct orientation (texture Y is inverted)
      v = 1.0 - v;
      
      vec4 spriteColor = texture(u_spriteArray, vec3(u, v, float(u_spriteIndex)));
      if (spriteColor.a > 0.01) {
        fragColor = spriteColor;
        return;
      }
    }
  }
  
  // Tail (behind the bullet, with offset)
  // tailOffset > 0 moves tail forward, < 0 moves it backward
  float tailStartX = v_tailOffset;
  float tailEndX = v_tailOffset - v_tailLength;
  
  if (pos.x < tailStartX && pos.x > tailEndX) {
    float t = (tailStartX - pos.x) / v_tailLength; // 0 at start, 1 at end
    float tailWidthAtX = v_tailWidth * (1.0 - t * 0.7); // Taper
    
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
  tailWidthMultiplier: 1.75,
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
