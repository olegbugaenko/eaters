import type { SceneCameraState, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { compileShader, linkProgram } from "@ui/renderers/utils/webglProgram";
import { createSceneFragmentShader } from "@ui/renderers/shaders/fillEffects.glsl";
import { TO_CLIP_GLSL } from "@ui/renderers/shaders/common.glsl";
import { FILL_COMPONENTS, POSITION_COMPONENTS } from "@ui/renderers/objects";
import {
  FILL_UNIFORM_VERTEX_HEADER,
  POPULATE_FILL_VARYINGS_GLSL,
  FILL_VEC4_COUNT,
} from "@ui/renderers/shaders/fillUniforms.glsl";
import { EXPANDED_COLOR_ANIM_FLOATS } from "@ui/renderers/primitives/utils/fill";
import { textureAtlasRegistry } from "@ui/renderers/textures/TextureAtlasRegistry";
import { textureResourceManager } from "@ui/renderers/textures/TextureResourceManager";
import { loadSpriteTexture } from "@ui/renderers/primitives/basic/SpritePrimitive";
import type { RendererLayerAnimationConfig } from "@shared/types/renderer.types";
import type { PolygonAnimParams } from "@ui/renderers/primitives/core/animation.types";

/** @deprecated Use PolygonAnimParams from animation.types.ts */
export type PolygonAnimationParams = PolygonAnimParams;

export type PolygonGpuHandle = {
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer;
  vertexCount: number;
  anim: PolygonAnimationParams;
  /** Packed fill data (FILL_COMPONENTS floats). Uploaded as uniform per draw. */
  fillData: Float32Array;
  /** Expanded 4-keyframe animation data (7 vec4s = 28 floats). */
  expandedAnimData: Float32Array;
};

const ANIMATED_VERTEX_SHADER = `${FILL_UNIFORM_VERTEX_HEADER}
// Animation uniforms
uniform float u_timeMs;
uniform float u_periodMs;
uniform float u_phase;
uniform float u_amplitude;
uniform float u_amplitudePercent;
uniform float u_phaseStep;
uniform int u_animType; // 0 sway, 1 pulse
uniform int u_axisType; // 0 normal, 1 tangent, 2 movement
uniform int u_useVertexPhase;
uniform vec2 u_center;
uniform vec2 u_origin;
uniform float u_rotation;
uniform vec2 u_movementDir;

vec2 resolveNormal(vec2 pos, vec2 center) {
  vec2 d = pos - center;
  float len = length(d);
  if (len < 1e-6) {
    return vec2(0.0, 0.0);
  }
  return d / len;
}

${POPULATE_FILL_VARYINGS_GLSL}

${TO_CLIP_GLSL}

void main() {
  populateFillVaryings();

  vec2 basePos = a_position;
  float omega = 6.28318530718 / max(u_periodMs, 1.0);
  float baseAngle = omega * u_timeMs + u_phase;
  float phaseOffset = (u_useVertexPhase == 1) ? (u_phaseStep * float(gl_VertexID)) : 0.0;
  float angle = baseAngle + phaseOffset;
  float s = sin(angle);

  vec2 offset;
  if (u_axisType == 2 || u_axisType == 3) {
    vec2 movePerp = (u_axisType == 2) ? vec2(0.0, 1.0) : vec2(-1.0, 0.0);
    float signedDist = dot(basePos - u_center, movePerp);
    float mag = u_amplitudePercent > 0.0 ? abs(signedDist) * u_amplitudePercent : u_amplitude;
    float moveToward = signedDist > 0.0 ? -1.0 : (signedDist < 0.0 ? 1.0 : 0.0);
    offset = movePerp * (mag * s * moveToward);
  } else {
    vec2 normal = resolveNormal(basePos, u_center);
    vec2 axis = (u_axisType == 1) ? vec2(-normal.y, normal.x) : normal;
    float magnitude = u_amplitude;
    if (u_amplitudePercent > 0.0) {
      float radius = length(basePos - u_center);
      magnitude = radius * u_amplitudePercent;
    }
    offset = axis * (magnitude * s);
  }
  vec2 localPos = basePos + offset;

  float cosR = cos(u_rotation);
  float sinR = sin(u_rotation);
  vec2 rotated = vec2(
    localPos.x * cosR - localPos.y * sinR,
    localPos.x * sinR + localPos.y * cosR
  );

  vec2 worldPos = u_origin + rotated;
  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  v_worldPosition = worldPos;

  // Transform fill params from local to world (read from uniform source)
  float fillType = u_fillData[0].x;
  vec4 fillParams0 = u_fillData[1];
  vec4 fillParams1 = u_fillData[2];

  if (fillType > 0.5 && fillType < 1.5) {
    vec2 startLocal = fillParams0.xy;
    vec2 endLocal = fillParams0.zw;
    vec2 startWorld = u_origin + vec2(
      startLocal.x * cosR - startLocal.y * sinR,
      startLocal.x * sinR + startLocal.y * cosR
    );
    vec2 endWorld = u_origin + vec2(
      endLocal.x * cosR - endLocal.y * sinR,
      endLocal.x * sinR + endLocal.y * cosR
    );
    vec2 dir = endWorld - startWorld;
    float lenSq = dot(dir, dir);
    fillParams0 = vec4(startWorld, endWorld);
    fillParams1 = vec4(dir, lenSq > 0.0 ? 1.0 / lenSq : 0.0, fillParams1.w);
  } else if (fillType > 1.5 && fillType < 3.5) {
    vec2 centerLocal = fillParams0.xy;
    vec2 centerWorld = u_origin + vec2(
      centerLocal.x * cosR - centerLocal.y * sinR,
      centerLocal.x * sinR + centerLocal.y * cosR
    );
    fillParams0.xy = centerWorld;
  } else if (fillType < 0.5) {
    vec2 centerLocal = fillParams0.xy;
    vec2 centerWorld = u_origin + vec2(
      centerLocal.x * cosR - centerLocal.y * sinR,
      centerLocal.x * sinR + centerLocal.y * cosR
    );
    fillParams0.xy = centerWorld;
  }

  v_uv = fillParams0.xy;
  v_fillParams0 = fillParams0;
  v_fillParams1 = fillParams1;
}
`;

const FRAGMENT_SHADER = createSceneFragmentShader();

class PolygonGpuRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private handles = new Set<PolygonGpuHandle>();
  private positionLocation = -1;
  private fillDataLocation: WebGLUniformLocation | null = null;
  private cameraPositionLocation: WebGLUniformLocation | null = null;
  private viewportSizeLocation: WebGLUniformLocation | null = null;
  private spriteTextureLocation: WebGLUniformLocation | null = null;
  private crackAtlasIndexLocation: WebGLUniformLocation | null = null;
  private crackAtlasGridLocation: WebGLUniformLocation | null = null;
  private crackAtlasSamplerLocation: WebGLUniformLocation | null = null;
  private timeMsLocation: WebGLUniformLocation | null = null;
  private periodMsLocation: WebGLUniformLocation | null = null;
  private phaseLocation: WebGLUniformLocation | null = null;
  private amplitudeLocation: WebGLUniformLocation | null = null;
  private amplitudePercentLocation: WebGLUniformLocation | null = null;
  private phaseStepLocation: WebGLUniformLocation | null = null;
  private animTypeLocation: WebGLUniformLocation | null = null;
  private axisTypeLocation: WebGLUniformLocation | null = null;
  private useVertexPhaseLocation: WebGLUniformLocation | null = null;
  private centerLocation: WebGLUniformLocation | null = null;
  private originLocation: WebGLUniformLocation | null = null;
  private rotationLocation: WebGLUniformLocation | null = null;
  private movementDirLocation: WebGLUniformLocation | null = null;
  private colorAnimDataLocation: WebGLUniformLocation | null = null;

  public setContext(gl: WebGL2RenderingContext | null): void {
    if (this.gl === gl) {
      return;
    }
    this.dispose();
    this.gl = gl;
    if (!gl) {
      return;
    }

    this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, ANIMATED_VERTEX_SHADER);
    this.fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    this.program = linkProgram(gl, this.vertexShader, this.fragmentShader);

    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    if (this.positionLocation < 0) {
      throw new Error("[PolygonGpuRenderer] Unable to resolve position attribute");
    }

    this.fillDataLocation = gl.getUniformLocation(this.program, "u_fillData[0]");

    this.cameraPositionLocation = gl.getUniformLocation(this.program, "u_cameraPosition");
    this.viewportSizeLocation = gl.getUniformLocation(this.program, "u_viewportSize");
    this.spriteTextureLocation = gl.getUniformLocation(this.program, "u_spriteTexture");
    this.crackAtlasIndexLocation = gl.getUniformLocation(this.program, "u_crackAtlasIndex");
    this.crackAtlasGridLocation = gl.getUniformLocation(this.program, "u_crackAtlasGrid");
    this.crackAtlasSamplerLocation = gl.getUniformLocation(this.program, "u_cracksAtlas");

    this.timeMsLocation = gl.getUniformLocation(this.program, "u_timeMs");
    this.periodMsLocation = gl.getUniformLocation(this.program, "u_periodMs");
    this.phaseLocation = gl.getUniformLocation(this.program, "u_phase");
    this.amplitudeLocation = gl.getUniformLocation(this.program, "u_amplitude");
    this.amplitudePercentLocation = gl.getUniformLocation(this.program, "u_amplitudePercent");
    this.phaseStepLocation = gl.getUniformLocation(this.program, "u_phaseStep");
    this.animTypeLocation = gl.getUniformLocation(this.program, "u_animType");
    this.axisTypeLocation = gl.getUniformLocation(this.program, "u_axisType");
    this.useVertexPhaseLocation = gl.getUniformLocation(this.program, "u_useVertexPhase");
    this.centerLocation = gl.getUniformLocation(this.program, "u_center");
    this.originLocation = gl.getUniformLocation(this.program, "u_origin");
    this.rotationLocation = gl.getUniformLocation(this.program, "u_rotation");
    this.movementDirLocation = gl.getUniformLocation(this.program, "u_movementDir");
    this.colorAnimDataLocation = gl.getUniformLocation(this.program, "u_colorAnimData[0]");
  }

  public acquireHandle(options: {
    positionBuffer: WebGLBuffer;
    vertexCount: number;
    center: SceneVector2;
  }): PolygonGpuHandle | null {
    const gl = this.gl;
    if (!gl || !this.program) {
      return null;
    }
    const vao = gl.createVertexArray();
    if (!vao) {
      return null;
    }
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, options.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(
      this.positionLocation,
      POSITION_COMPONENTS,
      gl.FLOAT,
      false,
      POSITION_COMPONENTS * Float32Array.BYTES_PER_ELEMENT,
      0
    );

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const handle: PolygonGpuHandle = {
      vao,
      positionBuffer: options.positionBuffer,
      vertexCount: options.vertexCount,
      anim: {
        timeMs: 0,
        periodMs: 1500,
        phase: 0,
        amplitude: 6,
        amplitudePercent: -1,
        phaseStep: 0.3,
        animType: 0,
        axisType: 0,
        useVertexPhase: 1,
        center: { x: options.center.x, y: options.center.y },
        origin: { x: 0, y: 0 },
        rotation: 0,
        movementDir: { x: 0, y: 1 },
      },
      fillData: new Float32Array(FILL_COMPONENTS),
      expandedAnimData: new Float32Array(EXPANDED_COLOR_ANIM_FLOATS),
    };
    this.handles.add(handle);
    return handle;
  }

  public acquire(options: {
    positionBuffer: WebGLBuffer;
    vertexCount: number;
    center: SceneVector2;
  }): PolygonGpuHandle | null {
    return this.acquireHandle(options);
  }

  public updateHandle(handle: PolygonGpuHandle, vertexCount: number): void {
    handle.vertexCount = vertexCount;
  }

  public update(handle: PolygonGpuHandle, vertexCount: number): void {
    this.updateHandle(handle, vertexCount);
  }

  public releaseHandle(handle: PolygonGpuHandle): void {
    if (!this.gl) {
      return;
    }
    if (this.handles.has(handle)) {
      this.handles.delete(handle);
    }
    this.gl.deleteVertexArray(handle.vao);
  }

  public release(handle: PolygonGpuHandle): void {
    this.releaseHandle(handle);
  }

  public render(gl: WebGL2RenderingContext, cameraState: SceneCameraState): void {
    if (!this.program || this.handles.size === 0) {
      return;
    }
    gl.useProgram(this.program);
    if (this.cameraPositionLocation) {
      gl.uniform2f(
        this.cameraPositionLocation,
        cameraState.position.x,
        cameraState.position.y
      );
    }
    if (this.viewportSizeLocation) {
      gl.uniform2f(
        this.viewportSizeLocation,
        cameraState.viewportSize.width,
        cameraState.viewportSize.height
      );
    }

    if (this.crackAtlasIndexLocation !== null || this.crackAtlasGridLocation !== null) {
      const crackAtlasIndex = textureAtlasRegistry.getAtlasIndex("cracks");
      const crackAtlasGrid = textureAtlasRegistry.getAtlasGrid("cracks");
      if (this.crackAtlasIndexLocation !== null) {
        gl.uniform1i(this.crackAtlasIndexLocation, crackAtlasIndex);
      }
      if (this.crackAtlasGridLocation !== null) {
        gl.uniform2f(this.crackAtlasGridLocation, crackAtlasGrid.cols, crackAtlasGrid.rows);
      }
    }

    if (this.crackAtlasSamplerLocation !== null) {
      gl.activeTexture(gl.TEXTURE1);
      gl.uniform1i(this.crackAtlasSamplerLocation, 1);

      const crackPath = "images/sprites/cracks/cracks_atlas.png";
      const crackTexture = textureResourceManager.getTexture(crackPath);
      if (crackTexture?.texture && crackTexture.gl === gl) {
        gl.bindTexture(gl.TEXTURE_2D, crackTexture.texture);
      } else {
        if (!crackTexture || crackTexture.gl !== gl) {
          loadSpriteTexture(gl, crackPath).catch(() => {});
        }
        const dummyTexture = gl.createTexture();
        if (dummyTexture) {
          gl.bindTexture(gl.TEXTURE_2D, dummyTexture);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            1,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255])
          );
        }
      }
    }

    if (this.spriteTextureLocation !== null) {
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(this.spriteTextureLocation, 0);
      const firstTexture = textureResourceManager.getAnyTexture();
      if (firstTexture?.texture) {
        gl.bindTexture(gl.TEXTURE_2D, firstTexture.texture);
      } else {
        const dummyTexture = gl.createTexture();
        if (dummyTexture) {
          gl.bindTexture(gl.TEXTURE_2D, dummyTexture);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            1,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255])
          );
        }
      }
    }

    this.handles.forEach((handle) => {
      if (handle.vertexCount < 3) {
        return;
      }

      if (this.fillDataLocation !== null) {
        gl.uniform4fv(this.fillDataLocation, handle.fillData);
      }
      if (this.colorAnimDataLocation !== null) {
        gl.uniform4fv(this.colorAnimDataLocation, handle.expandedAnimData);
      }

      const anim = handle.anim;
      if (this.timeMsLocation !== null) {
        gl.uniform1f(this.timeMsLocation, anim.timeMs);
      }
      if (this.periodMsLocation !== null) {
        gl.uniform1f(this.periodMsLocation, anim.periodMs);
      }
      if (this.phaseLocation !== null) {
        gl.uniform1f(this.phaseLocation, anim.phase);
      }
      if (this.amplitudeLocation !== null) {
        gl.uniform1f(this.amplitudeLocation, anim.amplitude);
      }
      if (this.amplitudePercentLocation !== null) {
        gl.uniform1f(this.amplitudePercentLocation, anim.amplitudePercent);
      }
      if (this.phaseStepLocation !== null) {
        gl.uniform1f(this.phaseStepLocation, anim.phaseStep);
      }
      if (this.animTypeLocation !== null) {
        gl.uniform1i(this.animTypeLocation, anim.animType);
      }
      if (this.axisTypeLocation !== null) {
        gl.uniform1i(this.axisTypeLocation, anim.axisType);
      }
      if (this.useVertexPhaseLocation !== null) {
        gl.uniform1i(this.useVertexPhaseLocation, anim.useVertexPhase);
      }
      if (this.centerLocation !== null) {
        gl.uniform2f(this.centerLocation, anim.center.x, anim.center.y);
      }
      if (this.originLocation !== null) {
        gl.uniform2f(this.originLocation, anim.origin.x, anim.origin.y);
      }
      if (this.rotationLocation !== null) {
        gl.uniform1f(this.rotationLocation, anim.rotation);
      }
      if (this.movementDirLocation !== null) {
        gl.uniform2f(this.movementDirLocation, anim.movementDir.x, anim.movementDir.y);
      }

      gl.bindVertexArray(handle.vao);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, handle.vertexCount);
    });
    gl.bindVertexArray(null);
  }

  private dispose(): void {
    if (!this.gl) {
      return;
    }
    this.handles.forEach((handle) => {
      this.gl?.deleteVertexArray(handle.vao);
    });
    this.handles.clear();
    if (this.program) {
      this.gl.deleteProgram(this.program);
    }
    if (this.vertexShader) {
      this.gl.deleteShader(this.vertexShader);
    }
    if (this.fragmentShader) {
      this.gl.deleteShader(this.fragmentShader);
    }
    this.program = null;
    this.vertexShader = null;
    this.fragmentShader = null;
  }
}

export const polygonGpuRenderer = new PolygonGpuRenderer();
