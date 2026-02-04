import type { SceneCameraState } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { compileShader, linkProgram } from "@ui/renderers/utils/webglProgram";
import {
  SCENE_VERTEX_SHADER,
  createSceneFragmentShader,
} from "@ui/renderers/shaders/fillEffects.glsl";
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

export type PolygonGpuHandle = {
  vao: WebGLVertexArrayObject;
  outputBuffer: WebGLBuffer;
  fillBuffer: WebGLBuffer;
  vertexCount: number;
};

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

  public setContext(gl: WebGL2RenderingContext | null): void {
    if (this.gl === gl) {
      return;
    }
    this.dispose();
    this.gl = gl;
    if (!gl) {
      return;
    }

    this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, SCENE_VERTEX_SHADER);
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
  }

  public acquireHandle(options: {
    outputBuffer: WebGLBuffer;
    fillBuffer: WebGLBuffer;
    vertexCount: number;
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

    gl.bindBuffer(gl.ARRAY_BUFFER, options.outputBuffer);
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
      outputBuffer: options.outputBuffer,
      fillBuffer: options.fillBuffer,
      vertexCount: options.vertexCount,
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
