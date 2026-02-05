import type { SceneCameraState, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { compileShader, linkProgram } from "@ui/renderers/utils/webglProgram";
import {
  SCENE_VERTEX_SHADER_HEADER,
  createSceneFragmentShader,
} from "@ui/renderers/shaders/fillEffects.glsl";
import { TO_CLIP_GLSL } from "@ui/renderers/shaders/common.glsl";
import {
  POSITION_COMPONENTS,
  FILL_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  FILL_FILAMENTS0_COMPONENTS,
  FILL_FILAMENTS1_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  STOP_COLOR_COMPONENTS,
  CRACK_UV_COMPONENTS,
  CRACK_MASK_COMPONENTS,
  CRACK_EFFECTS_COMPONENTS,
} from "@ui/renderers/objects";
import { textureAtlasRegistry } from "@ui/renderers/textures/TextureAtlasRegistry";
import { textureResourceManager } from "@ui/renderers/textures/TextureResourceManager";
import { loadSpriteTexture } from "@ui/renderers/primitives/basic/SpritePrimitive";
import type { RendererLayerAnimationConfig } from "@shared/types/renderer.types";

interface AttributeConfig {
  location: number;
  size: number;
  offset: number;
}

export type PolygonAnimationParams = {
  timeMs: number;
  periodMs: number;
  phase: number;
  amplitude: number;
  amplitudePercent: number;
  phaseStep: number;
  animType: number; // 0 = sway, 1 = pulse
  axisType: number; // 0 = normal, 1 = tangent, 2 = movement
  useVertexPhase: number;
  center: SceneVector2;
  origin: SceneVector2;
  rotation: number;
  movementDir: SceneVector2; // normalized movement direction
};

export type PolygonGpuHandle = {
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer; // Now stores LOCAL vertices (not TF output)
  fillBuffer: WebGLBuffer;
  vertexCount: number;
  // Animation parameters (updated each frame)
  anim: PolygonAnimationParams;
};

// Vertex shader with animation built-in (no Transform Feedback needed)
const ANIMATED_VERTEX_SHADER = `${SCENE_VERTEX_SHADER_HEADER}
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

${TO_CLIP_GLSL}

void main() {
  // Animation calculation (moved from Transform Feedback)
  vec2 basePos = a_position;
  float omega = 6.28318530718 / max(u_periodMs, 1.0);
  float baseAngle = omega * u_timeMs + u_phase;
  float phaseOffset = (u_useVertexPhase == 1) ? (u_phaseStep * float(gl_VertexID)) : 0.0;
  float angle = baseAngle + phaseOffset;
  float s = sin(angle);

  vec2 offset;
  if (u_axisType == 2 || u_axisType == 3) {
    // Movement-based axis - vertices on opposite sides move in opposite directions (squeeze/expand)
    // axisType 2 = movement-tangent: movePerp = {0, 1} (perpendicular to movement in local coords)
    // axisType 3 = movement-normal: movePerp = {-1, 0} (along movement in local coords)
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
  
  // Apply rotation
  float cosR = cos(u_rotation);
  float sinR = sin(u_rotation);
  vec2 rotated = vec2(
    localPos.x * cosR - localPos.y * sinR,
    localPos.x * sinR + localPos.y * cosR
  );
  
  // Transform to world space
  vec2 worldPos = u_origin + rotated;

  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  v_worldPosition = worldPos;
  
  // Transform fill params from local to world coordinates
  float fillType = a_fillInfo.x;
  vec4 fillParams0 = a_fillParams0;
  vec4 fillParams1 = a_fillParams1;
  
  if (fillType > 0.5 && fillType < 1.5) {
    // LINEAR_GRADIENT: transform start/end from local to world
    vec2 startLocal = a_fillParams0.xy;
    vec2 endLocal = a_fillParams0.zw;
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
    // RADIAL_GRADIENT or DIAMOND_GRADIENT: transform center from local to world
    vec2 centerLocal = a_fillParams0.xy;
    vec2 centerWorld = u_origin + vec2(
      centerLocal.x * cosR - centerLocal.y * sinR,
      centerLocal.x * sinR + centerLocal.y * cosR
    );
    fillParams0.xy = centerWorld;
  } else if (fillType < 0.5) {
    // SOLID: transform center (used for noise anchor)
    vec2 centerLocal = a_fillParams0.xy;
    vec2 centerWorld = u_origin + vec2(
      centerLocal.x * cosR - centerLocal.y * sinR,
      centerLocal.x * sinR + centerLocal.y * cosR
    );
    fillParams0.xy = centerWorld;
  }
  
  v_uv = fillParams0.xy;
  v_fillInfo = a_fillInfo;
  v_fillParams0 = fillParams0;
  v_fillParams1 = fillParams1;
  v_filaments0 = a_filaments0;
  v_filamentEdgeBlur = a_filamentEdgeBlur;
  v_stopOffsets = a_stopOffsets;
  v_stopColor0 = a_stopColor0;
  v_stopColor1 = a_stopColor1;
  v_stopColor2 = a_stopColor2;
  v_crackUv = a_crackUv;
  v_crackMask = a_crackMask;
  v_crackEffects = a_crackEffects;
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
  private fillAttributeConfigs: AttributeConfig[] = [];
  private fillStride = 0;
  private cameraPositionLocation: WebGLUniformLocation | null = null;
  private viewportSizeLocation: WebGLUniformLocation | null = null;
  private spriteTextureLocation: WebGLUniformLocation | null = null;
  private crackAtlasIndexLocation: WebGLUniformLocation | null = null;
  private crackAtlasGridLocation: WebGLUniformLocation | null = null;
  private crackAtlasSamplerLocation: WebGLUniformLocation | null = null;
  // Animation uniform locations
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

    this.fillAttributeConfigs = this.createFillAttributeConfigs(gl, this.program);
    this.fillStride = FILL_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

    this.cameraPositionLocation = gl.getUniformLocation(this.program, "u_cameraPosition");
    this.viewportSizeLocation = gl.getUniformLocation(this.program, "u_viewportSize");
    this.spriteTextureLocation = gl.getUniformLocation(this.program, "u_spriteTexture");
    this.crackAtlasIndexLocation = gl.getUniformLocation(this.program, "u_crackAtlasIndex");
    this.crackAtlasGridLocation = gl.getUniformLocation(this.program, "u_crackAtlasGrid");
    this.crackAtlasSamplerLocation = gl.getUniformLocation(this.program, "u_cracksAtlas");
    
    // Animation uniforms
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
  }

  public acquireHandle(options: {
    positionBuffer: WebGLBuffer;
    fillBuffer: WebGLBuffer;
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

    gl.bindBuffer(gl.ARRAY_BUFFER, options.fillBuffer);
    this.fillAttributeConfigs.forEach(({ location, size, offset }) => {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, this.fillStride, offset);
    });

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const handle: PolygonGpuHandle = {
      vao,
      positionBuffer: options.positionBuffer,
      fillBuffer: options.fillBuffer,
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
    };
    this.handles.add(handle);
    return handle;
  }

  public updateHandle(handle: PolygonGpuHandle, vertexCount: number): void {
    handle.vertexCount = vertexCount;
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
      
      // Set animation uniforms for this handle
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

  private createFillAttributeConfigs(
    gl: WebGL2RenderingContext,
    program: WebGLProgram
  ): AttributeConfig[] {
    const fillInfoLocation = gl.getAttribLocation(program, "a_fillInfo");
    const fillParams0Location = gl.getAttribLocation(program, "a_fillParams0");
    const fillParams1Location = gl.getAttribLocation(program, "a_fillParams1");
    const filaments0Location = gl.getAttribLocation(program, "a_filaments0");
    const filamentEdgeBlurLocation = gl.getAttribLocation(program, "a_filamentEdgeBlur");
    const stopOffsetsLocation = gl.getAttribLocation(program, "a_stopOffsets");
    const stopColor0Location = gl.getAttribLocation(program, "a_stopColor0");
    const stopColor1Location = gl.getAttribLocation(program, "a_stopColor1");
    const stopColor2Location = gl.getAttribLocation(program, "a_stopColor2");
    const crackUvLocation = gl.getAttribLocation(program, "a_crackUv");
    const crackMaskLocation = gl.getAttribLocation(program, "a_crackMask");
    const crackEffectsLocation = gl.getAttribLocation(program, "a_crackEffects");

    const attributeLocations = [
      fillInfoLocation,
      fillParams0Location,
      fillParams1Location,
      filaments0Location,
      filamentEdgeBlurLocation,
      stopOffsetsLocation,
      stopColor0Location,
      stopColor1Location,
      stopColor2Location,
      crackUvLocation,
      crackMaskLocation,
      crackEffectsLocation,
    ];

    if (attributeLocations.some((location) => location < 0)) {
      throw new Error("[PolygonGpuRenderer] Unable to resolve fill attribute locations");
    }

    let offset = 0;
    const configs: AttributeConfig[] = [];
    configs.push({ location: fillInfoLocation, size: FILL_INFO_COMPONENTS, offset });
    offset += FILL_INFO_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: fillParams0Location, size: FILL_PARAMS0_COMPONENTS, offset });
    offset += FILL_PARAMS0_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: fillParams1Location, size: FILL_PARAMS1_COMPONENTS, offset });
    offset += FILL_PARAMS1_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: filaments0Location, size: FILL_FILAMENTS0_COMPONENTS, offset });
    offset += FILL_FILAMENTS0_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: filamentEdgeBlurLocation, size: FILL_FILAMENTS1_COMPONENTS, offset });
    offset += FILL_FILAMENTS1_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: stopOffsetsLocation, size: STOP_OFFSETS_COMPONENTS, offset });
    offset += STOP_OFFSETS_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: stopColor0Location, size: STOP_COLOR_COMPONENTS, offset });
    offset += STOP_COLOR_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: stopColor1Location, size: STOP_COLOR_COMPONENTS, offset });
    offset += STOP_COLOR_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: stopColor2Location, size: STOP_COLOR_COMPONENTS, offset });
    offset += STOP_COLOR_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: crackUvLocation, size: CRACK_UV_COMPONENTS, offset });
    offset += CRACK_UV_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: crackMaskLocation, size: CRACK_MASK_COMPONENTS, offset });
    offset += CRACK_MASK_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    configs.push({ location: crackEffectsLocation, size: CRACK_EFFECTS_COMPONENTS, offset });

    return configs;
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
