import { compileShader, linkProgram } from "./webglProgram";
import {
  RADIATION_POST_PROCESS_FRAGMENT_SHADER,
  RADIATION_POST_PROCESS_VERTEX_SHADER,
} from "../shaders/radiationPostProcess.glsl";
import type { MapEffectPostProcessConfig } from "@db/map-effects-db";

interface PostProcessResources {
  program: WebGLProgram;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  vertexBuffer: WebGLBuffer;
  vertexArray: WebGLVertexArrayObject;
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
}

export class RadiationPostProcess {
  private resources: PostProcessResources | null = null;
  private width = 0;
  private height = 0;

  public beginFrame(gl: WebGL2RenderingContext, width: number, height: number): boolean {
    if (!this.ensureResources(gl)) {
      return false;
    }
    this.resize(gl, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resources!.framebuffer);
    gl.viewport(0, 0, width, height);
    return true;
  }

  public render(
    gl: WebGL2RenderingContext,
    timeSeconds: number,
    intensity: number,
    config: MapEffectPostProcessConfig,
  ): void {
    if (!this.resources || intensity <= 0) {
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.resources.program);
    gl.bindVertexArray(this.resources.vertexArray);

    const textureLocation = gl.getUniformLocation(
      this.resources.program,
      "u_sceneTexture"
    );
    if (textureLocation) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.resources.texture);
      gl.uniform1i(textureLocation, 0);
    }

    this.setUniform(gl, "u_time", timeSeconds);
    this.setUniform(gl, "u_intensity", intensity);
    this.setUniform2(gl, "u_resolution", this.width, this.height);
    this.setUniform(gl, "u_waveAmplitude", config.waveAmplitude);
    this.setUniform(gl, "u_waveFrequency", config.waveFrequency);
    this.setUniform(gl, "u_waveSpeed", config.waveSpeed);
    this.setUniform(gl, "u_jitterStrength", config.jitterStrength);
    this.setUniform(gl, "u_jitterFrequency", config.jitterFrequency);
    this.setUniform(gl, "u_bandSpeed", config.bandSpeed);
    this.setUniform(gl, "u_bandWidth", config.bandWidth);
    this.setUniform(gl, "u_bandIntensity", config.bandIntensity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public dispose(gl: WebGL2RenderingContext): void {
    if (!this.resources) {
      return;
    }
    gl.deleteBuffer(this.resources.vertexBuffer);
    gl.deleteVertexArray(this.resources.vertexArray);
    gl.deleteTexture(this.resources.texture);
    gl.deleteFramebuffer(this.resources.framebuffer);
    gl.deleteProgram(this.resources.program);
    gl.deleteShader(this.resources.vertexShader);
    gl.deleteShader(this.resources.fragmentShader);
    this.resources = null;
  }

  private ensureResources(gl: WebGL2RenderingContext): boolean {
    if (this.resources) {
      return true;
    }
    const vertexShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      RADIATION_POST_PROCESS_VERTEX_SHADER
    );
    const fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      RADIATION_POST_PROCESS_FRAGMENT_SHADER
    );
    const program = linkProgram(gl, vertexShader, fragmentShader);

    const vertexBuffer = gl.createBuffer();
    const vertexArray = gl.createVertexArray();
    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();

    if (!vertexBuffer || !vertexArray || !framebuffer || !texture) {
      return false;
    }

    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    const vertices = new Float32Array([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1,
      -1, 1, 0, 1,
      1, -1, 1, 0,
      1, 1, 1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const uvLocation = gl.getAttribLocation(program, "a_uv");
    if (positionLocation >= 0) {
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    }
    if (uvLocation >= 0) {
      gl.enableVertexAttribArray(uvLocation);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);
    }

    this.resources = {
      program,
      vertexShader,
      fragmentShader,
      vertexBuffer,
      vertexArray,
      framebuffer,
      texture,
    };
    return true;
  }

  private resize(gl: WebGL2RenderingContext, width: number, height: number): void {
    if (!this.resources || (this.width === width && this.height === height)) {
      return;
    }
    this.width = width;
    this.height = height;
    gl.bindTexture(gl.TEXTURE_2D, this.resources.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resources.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.resources.texture,
      0
    );
  }

  private setUniform(gl: WebGL2RenderingContext, name: string, value: number): void {
    if (!this.resources) {
      return;
    }
    const location = gl.getUniformLocation(this.resources.program, name);
    if (location) {
      gl.uniform1f(location, value);
    }
  }

  private setUniform2(
    gl: WebGL2RenderingContext,
    name: string,
    x: number,
    y: number
  ): void {
    if (!this.resources) {
      return;
    }
    const location = gl.getUniformLocation(this.resources.program, name);
    if (location) {
      gl.uniform2f(location, x, y);
    }
  }
}
