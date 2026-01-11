import { textureResourceManager } from "@ui/renderers/textures/TextureResourceManager";

/**
 * Manages sprite texture array for efficient rendering of multiple sprites
 */
class SpriteTextureManager {
  private gl: WebGL2RenderingContext | null = null;
  private textureArray: WebGLTexture | null = null;
  private textureSize = 256; // All sprites will be resized to this size
  private maxTextures = 16; // Maximum number of textures in the array
  private loadedPaths: string[] = [];

  setContext(gl: WebGL2RenderingContext | null): void {
    if (this.gl === gl) {
      return;
    }

    // Dispose old resources
    if (this.gl && this.textureArray) {
      this.gl.deleteTexture(this.textureArray);
    }

    this.gl = gl;
    this.textureArray = null;
    this.loadedPaths = [];

    if (gl) {
      this.createTextureArray(gl);
    }
  }

  private createTextureArray(gl: WebGL2RenderingContext): void {
    const texture = gl.createTexture();
    if (!texture) {
      console.error("[SpriteTextureManager] Failed to create texture array");
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    
    // Allocate storage for texture array
    gl.texStorage3D(
      gl.TEXTURE_2D_ARRAY,
      1, // mipmap levels
      gl.RGBA8,
      this.textureSize,
      this.textureSize,
      this.maxTextures
    );

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

    this.textureArray = texture;
    console.log(`[SpriteTextureManager] Created texture array ${this.textureSize}x${this.textureSize} x ${this.maxTextures}`);
  }

  /**
   * Updates the texture array with loaded textures from cache
   */
  updateFromCache(): void {
    if (!this.gl || !this.textureArray) {
      return;
    }

    const paths = textureResourceManager.getTexturePaths();

    // Find new textures that need to be added
    const newPaths = paths.filter(path => !this.loadedPaths.includes(path));
    
    if (newPaths.length === 0) {
      return;
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textureArray);

    for (const path of newPaths) {
      const index = this.loadedPaths.length;
      if (index >= this.maxTextures) {
        console.warn(`[SpriteTextureManager] Texture limit reached (${this.maxTextures})`);
        break;
      }

      const cached = textureResourceManager.getTexture(path);
      if (!cached) {
        continue;
      }

      // Create a canvas to resize the texture
      const canvas = document.createElement('canvas');
      canvas.width = this.textureSize;
      canvas.height = this.textureSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }

      // Draw the texture onto the canvas (this requires loading it as an image)
      // For now, we'll upload a placeholder and update it when the image loads
      const img = new Image();
      img.onload = () => {
        if (!this.gl || !this.textureArray) {
          return;
        }

        ctx.clearRect(0, 0, this.textureSize, this.textureSize);
        ctx.drawImage(img, 0, 0, this.textureSize, this.textureSize);

        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.textureArray);
        this.gl.texSubImage3D(
          this.gl.TEXTURE_2D_ARRAY,
          0, // mipmap level
          0, 0, index, // xoffset, yoffset, zoffset
          this.textureSize,
          this.textureSize,
          1, // depth
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          canvas
        );
        this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, null);

        console.log(`[SpriteTextureManager] Updated texture at index ${index}: ${path}`);
      };
      img.src = path;

      this.loadedPaths.push(path);
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, null);
  }

  getTextureArray(): WebGLTexture | null {
    return this.textureArray;
  }

  dispose(): void {
    if (this.gl && this.textureArray) {
      this.gl.deleteTexture(this.textureArray);
    }
    this.gl = null;
    this.textureArray = null;
    this.loadedPaths = [];
  }
}

export const spriteTextureManager = new SpriteTextureManager();
