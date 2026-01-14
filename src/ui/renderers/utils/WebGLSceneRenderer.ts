import type { ObjectsRendererManager } from "../objects";
import { compileShader, linkProgram } from "./webglProgram";
import { applySyncInstructions } from "./webglSync";
import {
  SCENE_VERTEX_SHADER,
  createSceneFragmentShader,
} from "../shaders/fillEffects.glsl";
import {
  VERTEX_COMPONENTS,
  POSITION_COMPONENTS,
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
} from "../objects";
import type { SceneCameraState } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { textureAtlasRegistry } from "../textures/TextureAtlasRegistry";
import { loadSpriteTexture } from "../primitives/basic/SpritePrimitive";
import { textureResourceManager } from "../textures/TextureResourceManager";

const VERTEX_SHADER = SCENE_VERTEX_SHADER;
const FRAGMENT_SHADER = createSceneFragmentShader();

interface AttributeConfig {
  location: number;
  size: number;
  offset: number;
}

/**
 * WebGLSceneRenderer encapsulates common WebGL initialization and rendering logic
 * shared between useSceneCanvas and SaveSlotBackgroundScene.
 * 
 * This class handles:
 * - WebGL context initialization
 * - Shader compilation and program linking
 * - Buffer creation and management
 * - Attribute configuration
 * - Basic rendering loop
 */
export class WebGLSceneRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vertexShader: WebGLShader;
  private fragmentShader: WebGLShader;
  private staticBuffer: WebGLBuffer;
  private dynamicBuffer: WebGLBuffer;
  private attributeConfigs: AttributeConfig[];
  private stride: number;
  private cameraPositionLocation: WebGLUniformLocation;
  private viewportSizeLocation: WebGLUniformLocation;
  private spriteTextureLocation: WebGLUniformLocation | null;
  private crackAtlasIndexLocation: WebGLUniformLocation | null;
  private crackAtlasGridLocation: WebGLUniformLocation | null;
  private crackAtlasSamplerLocation: WebGLUniformLocation | null;
  private objectsRenderer: ObjectsRendererManager;
  private bufferState = { staticBytes: 0, dynamicBytes: 0 };

  constructor(
    gl: WebGL2RenderingContext,
    objectsRenderer: ObjectsRendererManager
  ) {
    this.gl = gl;
    this.objectsRenderer = objectsRenderer;

    // Compile shaders
    this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    this.fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    this.logTranslatedShaders();
    this.program = linkProgram(gl, this.vertexShader, this.fragmentShader);

    // Get attribute locations
    const positionLocation = gl.getAttribLocation(this.program, "a_position");
    const fillInfoLocation = gl.getAttribLocation(this.program, "a_fillInfo");
    const fillParams0Location = gl.getAttribLocation(this.program, "a_fillParams0");
    const fillParams1Location = gl.getAttribLocation(this.program, "a_fillParams1");
    const filaments0Location = gl.getAttribLocation(this.program, "a_filaments0");
    const filamentEdgeBlurLocation = gl.getAttribLocation(
      this.program,
      "a_filamentEdgeBlur"
    );
    const stopOffsetsLocation = gl.getAttribLocation(this.program, "a_stopOffsets");
    const stopColor0Location = gl.getAttribLocation(this.program, "a_stopColor0");
    const stopColor1Location = gl.getAttribLocation(this.program, "a_stopColor1");
    const stopColor2Location = gl.getAttribLocation(this.program, "a_stopColor2");
    const crackUvLocation = gl.getAttribLocation(this.program, "a_crackUv");
    const crackMaskLocation = gl.getAttribLocation(this.program, "a_crackMask");
    const crackEffectsLocation = gl.getAttribLocation(
      this.program,
      "a_crackEffects"
    );

    const attributeLocations = [
      positionLocation,
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
      throw new Error("Unable to resolve vertex attribute locations");
    }

    // Create attribute configs
    this.stride = VERTEX_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    this.attributeConfigs = this.createAttributeConfigs([
      { location: positionLocation, size: POSITION_COMPONENTS },
      { location: fillInfoLocation, size: FILL_INFO_COMPONENTS },
      { location: fillParams0Location, size: FILL_PARAMS0_COMPONENTS },
      { location: fillParams1Location, size: FILL_PARAMS1_COMPONENTS },
      { location: filaments0Location, size: FILL_FILAMENTS0_COMPONENTS },
      { location: filamentEdgeBlurLocation, size: FILL_FILAMENTS1_COMPONENTS },
      { location: stopOffsetsLocation, size: STOP_OFFSETS_COMPONENTS },
      { location: stopColor0Location, size: STOP_COLOR_COMPONENTS },
      { location: stopColor1Location, size: STOP_COLOR_COMPONENTS },
      { location: stopColor2Location, size: STOP_COLOR_COMPONENTS },
      { location: crackUvLocation, size: CRACK_UV_COMPONENTS },
      { location: crackMaskLocation, size: CRACK_MASK_COMPONENTS },
      { location: crackEffectsLocation, size: CRACK_EFFECTS_COMPONENTS },
    ]);

    // Create buffers
    const staticBuffer = gl.createBuffer();
    const dynamicBuffer = gl.createBuffer();

    if (!staticBuffer || !dynamicBuffer) {
      throw new Error("Unable to allocate buffers");
    }

    this.staticBuffer = staticBuffer;
    this.dynamicBuffer = dynamicBuffer;

    // Get uniform locations
    const cameraPositionLocation = gl.getUniformLocation(
      this.program,
      "u_cameraPosition"
    );
    const viewportSizeLocation = gl.getUniformLocation(
      this.program,
      "u_viewportSize"
    );
    const spriteTextureLocation = gl.getUniformLocation(
      this.program,
      "u_spriteTexture"
    );
    const crackAtlasIndexLocation = gl.getUniformLocation(
      this.program,
      "u_crackAtlasIndex"
    );
    const crackAtlasGridLocation = gl.getUniformLocation(
      this.program,
      "u_crackAtlasGrid"
    );
    const crackAtlasSamplerLocation = gl.getUniformLocation(
      this.program,
      "u_cracksAtlas"
    );

    if (!cameraPositionLocation || !viewportSizeLocation) {
      throw new Error("Unable to resolve camera uniforms");
    }

    this.cameraPositionLocation = cameraPositionLocation;
    this.viewportSizeLocation = viewportSizeLocation;
    this.spriteTextureLocation = spriteTextureLocation;
    this.crackAtlasIndexLocation = crackAtlasIndexLocation;
    this.crackAtlasGridLocation = crackAtlasGridLocation;
    this.crackAtlasSamplerLocation = crackAtlasSamplerLocation;

    // Setup WebGL state
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
  }

  private logTranslatedShaders(): void {
    const debugExtension = this.gl.getExtension("WEBGL_debug_shaders");
    if (!debugExtension) {
      return;
    }

    const vertexSource = debugExtension.getTranslatedShaderSource(this.vertexShader);
    const fragmentSource = debugExtension.getTranslatedShaderSource(this.fragmentShader);

    console.debug("[WebGLSceneRenderer] Translated vertex shader source:", vertexSource);
    console.debug("[WebGLSceneRenderer] Translated fragment shader source:", fragmentSource);
  }

  private createAttributeConfigs(
    attributes: Array<{ location: number; size: number }>
  ): AttributeConfig[] {
    let offset = 0;
    const configs: AttributeConfig[] = [];
    for (const attr of attributes) {
      configs.push({ location: attr.location, size: attr.size, offset });
      offset += attr.size * Float32Array.BYTES_PER_ELEMENT;
    }
    return configs;
  }

  /**
   * Syncs object renderer changes to WebGL buffers
   */
  public syncBuffers(): void {
    this.bufferState = applySyncInstructions(
      this.gl,
      this.objectsRenderer,
      this.staticBuffer,
      this.dynamicBuffer,
      this.bufferState
    );
  }

  /**
   * Renders the scene with the given camera state
   */
  public render(cameraState: SceneCameraState): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.useProgram(this.program);
    this.gl.uniform2f(
      this.cameraPositionLocation,
      cameraState.position.x,
      cameraState.position.y
    );
    this.gl.uniform2f(
      this.viewportSizeLocation,
      cameraState.viewportSize.width,
      cameraState.viewportSize.height
    );

    if (this.crackAtlasIndexLocation !== null || this.crackAtlasGridLocation !== null) {
      const crackAtlasIndex = textureAtlasRegistry.getAtlasIndex("cracks");
      const crackAtlasGrid = textureAtlasRegistry.getAtlasGrid("cracks");
      if (this.crackAtlasIndexLocation !== null) {
        this.gl.uniform1i(this.crackAtlasIndexLocation, crackAtlasIndex);
      }
      if (this.crackAtlasGridLocation !== null) {
        this.gl.uniform2f(this.crackAtlasGridLocation, crackAtlasGrid.cols, crackAtlasGrid.rows);
      }
    }

    if (this.crackAtlasSamplerLocation !== null) {
      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.uniform1i(this.crackAtlasSamplerLocation, 1);

      const crackPath = "/images/sprites/cracks/cracks_atlas.png";
      const crackTexture = textureResourceManager.getTexture(crackPath);
      
      if (crackTexture?.texture && crackTexture.gl === this.gl) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, crackTexture.texture);
      } else {
        if (!crackTexture || crackTexture.gl !== this.gl) {
          loadSpriteTexture(this.gl, crackPath).catch(() => {});
        }
        const dummyTexture = this.gl.createTexture();
        if (dummyTexture) {
          this.gl.bindTexture(this.gl.TEXTURE_2D, dummyTexture);
          this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            1,
            1,
            0,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255])
          );
        }
      }
    }
    
    // Bind sprite texture if available (texture unit 0)
    if (this.spriteTextureLocation !== null) {
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.uniform1i(this.spriteTextureLocation, 0);
      
      const firstTexture = textureResourceManager.getAnyTexture();
      if (firstTexture?.texture) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, firstTexture.texture);
      } else {
        // Create a dummy 1x1 white texture if none loaded yet
        const dummyTexture = this.gl.createTexture();
        if (dummyTexture) {
          this.gl.bindTexture(this.gl.TEXTURE_2D, dummyTexture);
          this.gl.texImage2D(
            this.gl.TEXTURE_2D, 
            0, 
            this.gl.RGBA, 
            1, 
            1, 
            0, 
            this.gl.RGBA, 
            this.gl.UNSIGNED_BYTE, 
            new Uint8Array([255, 255, 255, 255])
          );
        }
      }
    }

    this.drawBuffer(this.staticBuffer, this.objectsRenderer.getStaticVertexCount());
    this.drawBuffer(this.dynamicBuffer, this.objectsRenderer.getDynamicVertexCount());
  }

  /**
   * Draws a buffer with the given vertex count
   */
  private drawBuffer(buffer: WebGLBuffer, vertexCount: number): void {
    if (vertexCount <= 0) {
      return;
    }
    this.enableAttributes(buffer);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, vertexCount);
  }

  /**
   * Enables and configures vertex attributes for a buffer
   */
  private enableAttributes(buffer: WebGLBuffer): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.attributeConfigs.forEach(({ location, size, offset }) => {
      this.gl.enableVertexAttribArray(location);
      this.gl.vertexAttribPointer(
        location,
        size,
        this.gl.FLOAT,
        false,
        this.stride,
        offset
      );
    });
  }

  /**
   * Gets the WebGL context (for advanced operations)
   */
  public getGl(): WebGL2RenderingContext {
    return this.gl;
  }

  /**
   * Gets the objects renderer (for applying changes)
   */
  public getObjectsRenderer(): ObjectsRendererManager {
    return this.objectsRenderer;
  }

  /**
   * Loads a sprite texture
   */
  public async loadTexture(spritePath: string): Promise<void> {
    try {
      await loadSpriteTexture(this.gl, spritePath);
    } catch (error) {
      console.warn(`[WebGLSceneRenderer] Failed to load texture: ${spritePath}`, error);
    }
  }

  /**
   * Disposes all WebGL resources
   */
  public dispose(): void {
    this.gl.deleteBuffer(this.staticBuffer);
    this.gl.deleteBuffer(this.dynamicBuffer);
    this.gl.deleteProgram(this.program);
    this.gl.deleteShader(this.vertexShader);
    this.gl.deleteShader(this.fragmentShader);
  }
}
