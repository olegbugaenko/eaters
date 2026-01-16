import { getAssetUrl } from "@shared/helpers/assets.helper";

type TextureEntry = {
  texture: WebGLTexture;
  width: number;
  height: number;
  gl: WebGL2RenderingContext;
};

type TextureArrayEntry = {
  texture: WebGLTexture;
  size: number;
  paths: string[];
  gl: WebGL2RenderingContext;
};

interface LoadTextureOptions {
  baseDir?: string;
}

interface LoadTextureArrayOptions {
  size: number;
  baseDir?: string;
}

class TextureResourceManager {
  private gl: WebGL2RenderingContext | null = null;
  private textures = new Map<string, TextureEntry>();
  private textureIndex = new Map<string, number>();
  private textureArrays = new Map<string, TextureArrayEntry>();

  public setContext(gl: WebGL2RenderingContext | null): void {
    if (this.gl === gl) {
      return;
    }

    this.dispose();
    this.gl = gl;
  }

  public clearCache(resetIndices = true): void {
    this.dispose();
    if (resetIndices) {
      this.textureIndex.clear();
    }
  }

  public getTextureIndex(path: string, options?: LoadTextureOptions): number {
    const normalized = this.normalizePath(path, options);
    if (!this.textureIndex.has(normalized)) {
      this.textureIndex.set(normalized, this.textureIndex.size);
    }
    return this.textureIndex.get(normalized) ?? 0;
  }

  public getTexture(path: string, options?: LoadTextureOptions): TextureEntry | undefined {
    const normalized = this.normalizePath(path, options);
    return this.textures.get(normalized);
  }

  public getTexturePaths(): string[] {
    return Array.from(this.textures.keys());
  }

  public getAnyTexture(): TextureEntry | undefined {
    return this.textures.values().next().value;
  }

  public async loadTexture(
    gl: WebGL2RenderingContext,
    path: string,
    options?: LoadTextureOptions
  ): Promise<TextureEntry> {
    this.ensureContext(gl);

    const normalizedPath = this.normalizePath(path, options);
    const cached = this.textures.get(normalizedPath);
    if (cached && cached.gl === gl) {
      return cached;
    }
    if (cached) {
      this.safeDeleteTexture(cached.gl, cached.texture);
      this.textures.delete(normalizedPath);
    }

    const image = new Image();
    return new Promise<TextureEntry>((resolve, reject) => {
      image.onload = () => {
        if (!this.gl || this.gl !== gl) {
          reject(new Error("WebGL context changed while loading texture"));
          return;
        }
        const texture = gl.createTexture();
        if (!texture) {
          reject(new Error(`Failed to create texture for ${normalizedPath}`));
          return;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const result = {
          texture,
          width: image.width,
          height: image.height,
          gl,
        };
        this.textures.set(normalizedPath, result);
        this.getTextureIndex(normalizedPath);
        resolve(result);
      };
      image.onerror = () => {
        reject(new Error(`Failed to load image: ${normalizedPath}`));
      };
      image.src = normalizedPath;
    });
  }

  public loadTextureArray(
    gl: WebGL2RenderingContext,
    key: string,
    paths: string[],
    options: LoadTextureArrayOptions
  ): WebGLTexture | null {
    this.ensureContext(gl);

    const normalizedPaths = paths.map((path) => this.normalizePath(path, options));
    const existing = this.textureArrays.get(key);
    if (
      existing &&
      existing.gl === gl &&
      existing.size === options.size &&
      this.arePathsEqual(existing.paths, normalizedPaths)
    ) {
      return existing.texture;
    }
    if (existing) {
      this.safeDeleteTexture(existing.gl, existing.texture);
      this.textureArrays.delete(key);
    }

    const texture = gl.createTexture();
    if (!texture) {
      return null;
    }

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.RGBA,
      options.size,
      options.size,
      normalizedPaths.length,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

    const entry: TextureArrayEntry = {
      texture,
      size: options.size,
      paths: normalizedPaths,
      gl,
    };
    this.textureArrays.set(key, entry);

    normalizedPaths.forEach((path, index) => {
      const image = new Image();
      image.onload = () => {
        const current = this.textureArrays.get(key);
        if (!current || current.texture !== texture || this.gl !== gl) {
          return;
        }
        try {
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
          gl.texSubImage3D(
            gl.TEXTURE_2D_ARRAY,
            0,
            0,
            0,
            index,
            options.size,
            options.size,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
          );
        } catch {
          // Ignore if texture was deleted or context lost.
        } finally {
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        }
      };
      image.onerror = () => {
        console.error(`[TextureResourceManager] Failed to load sprite: ${path}`);
      };
      image.src = path;
    });

    return texture;
  }

  private ensureContext(gl: WebGL2RenderingContext): void {
    if (this.gl === gl) {
      return;
    }

    this.dispose();
    this.gl = gl;
  }

  private normalizePath(path: string, options?: LoadTextureOptions): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    if (path.startsWith("/")) {
      return getAssetUrl(path);
    }
    const baseDir = options?.baseDir ?? getAssetUrl("images/sprites");
    return `${baseDir.replace(/\/$/, "")}/${path}`;
  }

  private arePathsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  }

  private safeDeleteTexture(gl: WebGL2RenderingContext, texture: WebGLTexture): void {
    try {
      gl.deleteTexture(texture);
    } catch {
      // Ignore cleanup errors.
    }
  }

  private dispose(): void {
    this.textures.forEach((entry) => this.safeDeleteTexture(entry.gl, entry.texture));
    this.textureArrays.forEach((entry) => this.safeDeleteTexture(entry.gl, entry.texture));
    this.textures.clear();
    this.textureArrays.clear();
  }
}

export const textureResourceManager = new TextureResourceManager();
export type { TextureEntry };
