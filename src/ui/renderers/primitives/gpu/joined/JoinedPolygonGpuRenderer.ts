import type { SceneCameraState } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
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

interface AttributeConfig {
  location: number;
  size: number;
  offset: number;
}

export type JoinedPolygonGpuHandle = {
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer;
  fillBuffer: WebGLBuffer;
  vertexCount: number;
  anchorIndex: number;
  joinOffset: { x: number; y: number };
  instancePosition: { x: number; y: number };
  instanceRotation: number;
  drawMode: number;
};

export type AnchorTextureInfo = {
  texture: WebGLTexture;
  width: number;
};

const FRAGMENT_SHADER = createSceneFragmentShader();

const JOINED_VERTEX_SHADER = `${SCENE_VERTEX_SHADER_HEADER}
uniform sampler2D u_anchorTexture;
uniform float u_anchorTexWidth;
uniform float u_anchorIndex;
uniform vec2 u_joinOffset;
uniform vec2 u_instancePosition;
uniform float u_instanceRotation;

vec2 rotateVec(vec2 v, float r) {
  float c = cos(r);
  float s = sin(r);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

vec2 fetchAnchor() {
  int idx = int(u_anchorIndex + 0.5);
  return texelFetch(u_anchorTexture, ivec2(idx, 0), 0).rg;
}

${TO_CLIP_GLSL}
void main() {
  vec2 anchorPos = fetchAnchor();
  vec2 anchorOffset = anchorPos + u_joinOffset;
  vec2 localPos = a_position + anchorOffset;
  vec2 rotatedPos = rotateVec(localPos, u_instanceRotation);
  vec2 worldPos = u_instancePosition + rotatedPos;

  float fillType = a_fillInfo.x;
  vec4 fillParams0 = a_fillParams0;
  vec4 fillParams1 = a_fillParams1;

  if (fillType > 0.5 && fillType < 1.5) {
    vec2 startLocal = a_fillParams0.xy + anchorOffset;
    vec2 endLocal = a_fillParams0.zw + anchorOffset;
    vec2 startWorld = u_instancePosition + rotateVec(startLocal, u_instanceRotation);
    vec2 endWorld = u_instancePosition + rotateVec(endLocal, u_instanceRotation);
    vec2 dir = endWorld - startWorld;
    float lenSq = dot(dir, dir);
    fillParams0 = vec4(startWorld, endWorld);
    fillParams1 = vec4(dir, lenSq > 0.0 ? 1.0 / lenSq : 0.0, fillParams1.w);
  } else if (fillType < 3.5) {
    vec2 centerLocal = a_fillParams0.xy + anchorOffset;
    vec2 centerWorld = u_instancePosition + rotateVec(centerLocal, u_instanceRotation);
    fillParams0.xy = centerWorld;
  }

  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  v_worldPosition = worldPos;
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

class JoinedPolygonGpuRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private handles = new Set<JoinedPolygonGpuHandle>();
  private positionLocation = -1;
  private fillAttributeConfigs: AttributeConfig[] = [];
  private fillStride = 0;
  private cameraPositionLocation: WebGLUniformLocation | null = null;
  private viewportSizeLocation: WebGLUniformLocation | null = null;
  private spriteTextureLocation: WebGLUniformLocation | null = null;
  private crackAtlasIndexLocation: WebGLUniformLocation | null = null;
  private crackAtlasGridLocation: WebGLUniformLocation | null = null;
  private crackAtlasSamplerLocation: WebGLUniformLocation | null = null;
  private anchorTextureLocation: WebGLUniformLocation | null = null;
  private anchorTexWidthLocation: WebGLUniformLocation | null = null;
  private anchorIndexLocation: WebGLUniformLocation | null = null;
  private joinOffsetLocation: WebGLUniformLocation | null = null;
  private instancePositionLocation: WebGLUniformLocation | null = null;
  private instanceRotationLocation: WebGLUniformLocation | null = null;
  private lastDrawCalls = 0;
  private lastRenderMs = 0;
  private lastAnchorUploadMs = 0;

  public setContext(gl: WebGL2RenderingContext | null): void {
    if (this.gl === gl) {
      return;
    }
    this.dispose();
    this.gl = gl;
    if (!gl) {
      return;
    }

    this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, JOINED_VERTEX_SHADER);
    this.fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    this.program = linkProgram(gl, this.vertexShader, this.fragmentShader);

    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    if (this.positionLocation < 0) {
      throw new Error("[JoinedPolygonGpuRenderer] Unable to resolve position attribute");
    }

    this.fillAttributeConfigs = this.createFillAttributeConfigs(gl, this.program);
    this.fillStride = FILL_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

    this.cameraPositionLocation = gl.getUniformLocation(this.program, "u_cameraPosition");
    this.viewportSizeLocation = gl.getUniformLocation(this.program, "u_viewportSize");
    this.spriteTextureLocation = gl.getUniformLocation(this.program, "u_spriteTexture");
    this.crackAtlasIndexLocation = gl.getUniformLocation(this.program, "u_crackAtlasIndex");
    this.crackAtlasGridLocation = gl.getUniformLocation(this.program, "u_crackAtlasGrid");
    this.crackAtlasSamplerLocation = gl.getUniformLocation(this.program, "u_cracksAtlas");
    this.anchorTextureLocation = gl.getUniformLocation(this.program, "u_anchorTexture");
    this.anchorTexWidthLocation = gl.getUniformLocation(this.program, "u_anchorTexWidth");
    this.anchorIndexLocation = gl.getUniformLocation(this.program, "u_anchorIndex");
    this.joinOffsetLocation = gl.getUniformLocation(this.program, "u_joinOffset");
    this.instancePositionLocation = gl.getUniformLocation(this.program, "u_instancePosition");
    this.instanceRotationLocation = gl.getUniformLocation(this.program, "u_instanceRotation");
  }

  public acquireHandle(options: {
    positionBuffer: WebGLBuffer;
    fillBuffer: WebGLBuffer;
    vertexCount: number;
    anchorIndex: number;
    joinOffset: { x: number; y: number };
    drawMode?: number;
  }): JoinedPolygonGpuHandle | null {
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

    const handle: JoinedPolygonGpuHandle = {
      vao,
      positionBuffer: options.positionBuffer,
      fillBuffer: options.fillBuffer,
      vertexCount: options.vertexCount,
      anchorIndex: options.anchorIndex,
      joinOffset: options.joinOffset,
      instancePosition: { x: 0, y: 0 },
      instanceRotation: 0,
      drawMode: options.drawMode ?? gl.TRIANGLE_FAN,
    };
    this.handles.add(handle);
    return handle;
  }

  /**
   * Unified acquire API (alias for acquireHandle).
   */
  public acquire(options: {
    positionBuffer: WebGLBuffer;
    fillBuffer: WebGLBuffer;
    vertexCount: number;
    anchorIndex: number;
    joinOffset: { x: number; y: number };
    drawMode?: number;
  }): JoinedPolygonGpuHandle | null {
    return this.acquireHandle(options);
  }

  public updateHandle(handle: JoinedPolygonGpuHandle, vertexCount: number): void {
    handle.vertexCount = vertexCount;
  }

  /**
   * Unified update API (alias for updateHandle).
   */
  public update(handle: JoinedPolygonGpuHandle, vertexCount: number): void {
    this.updateHandle(handle, vertexCount);
  }

  public releaseHandle(handle: JoinedPolygonGpuHandle): void {
    if (!this.gl) {
      return;
    }
    if (this.handles.has(handle)) {
      this.handles.delete(handle);
    }
    this.gl.deleteVertexArray(handle.vao);
  }

  /**
   * Unified release API (alias for releaseHandle).
   */
  public release(handle: JoinedPolygonGpuHandle): void {
    this.releaseHandle(handle);
  }

  public hasHandles(): boolean {
    return this.handles.size > 0;
  }

  public setAnchorUploadMs(ms: number): void {
    this.lastAnchorUploadMs = ms;
  }

  public getStats(): {
    handles: number;
    drawCalls: number;
    renderMs: number;
    anchorUploadMs: number;
  } {
    return {
      handles: this.handles.size,
      drawCalls: this.lastDrawCalls,
      renderMs: this.lastRenderMs,
      anchorUploadMs: this.lastAnchorUploadMs,
    };
  }

  public render(
    gl: WebGL2RenderingContext,
    cameraState: SceneCameraState,
    anchorTexture: AnchorTextureInfo
  ): void {
    if (!this.program || this.handles.size === 0) {
      return;
    }
    const renderStart = performance.now();
    let drawCalls = 0;
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

    if (this.anchorTextureLocation) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, anchorTexture.texture);
      gl.uniform1i(this.anchorTextureLocation, 2);
    }
    if (this.anchorTexWidthLocation) {
      gl.uniform1f(this.anchorTexWidthLocation, anchorTexture.width);
    }

    this.handles.forEach((handle) => {
      if (handle.vertexCount < 3) {
        return;
      }
      if (this.anchorIndexLocation) {
        gl.uniform1f(this.anchorIndexLocation, handle.anchorIndex);
      }
      if (this.joinOffsetLocation) {
        gl.uniform2f(this.joinOffsetLocation, handle.joinOffset.x, handle.joinOffset.y);
      }
      if (this.instancePositionLocation) {
        gl.uniform2f(
          this.instancePositionLocation,
          handle.instancePosition.x,
          handle.instancePosition.y
        );
      }
      if (this.instanceRotationLocation) {
        gl.uniform1f(this.instanceRotationLocation, handle.instanceRotation);
      }
      gl.bindVertexArray(handle.vao);
      gl.drawArrays(handle.drawMode, 0, handle.vertexCount);
      drawCalls += 1;
    });
    gl.bindVertexArray(null);
    this.lastDrawCalls = drawCalls;
    this.lastRenderMs = performance.now() - renderStart;
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
      throw new Error("[JoinedPolygonGpuRenderer] Unable to resolve fill attribute locations");
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

export const joinedPolygonGpuRenderer = new JoinedPolygonGpuRenderer();
