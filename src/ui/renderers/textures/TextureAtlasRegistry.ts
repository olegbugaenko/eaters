type AtlasGrid = { cols: number; rows: number };

interface TextureAtlasEntry {
  id: string;
  imagePath: string;
  grid: AtlasGrid;
  index: number;
}

class TextureAtlasRegistry {
  private atlases = new Map<string, TextureAtlasEntry>();
  private orderedAtlases: TextureAtlasEntry[] = [];

  public registerAtlas(id: string, imagePath: string, grid: AtlasGrid): void {
    const existing = this.atlases.get(id);
    if (existing) {
      return;
    }
    const entry: TextureAtlasEntry = {
      id,
      imagePath,
      grid: { ...grid },
      index: this.orderedAtlases.length,
    };
    this.atlases.set(id, entry);
    this.orderedAtlases.push(entry);
  }

  public getAtlasIndex(id: string): number {
    const entry = this.atlases.get(id);
    if (!entry) {
      throw new Error(`[TextureAtlasRegistry] Missing atlas: ${id}`);
    }
    return entry.index;
  }

  public getAtlasGrid(id: string): AtlasGrid {
    const entry = this.atlases.get(id);
    if (!entry) {
      throw new Error(`[TextureAtlasRegistry] Missing atlas: ${id}`);
    }
    return { ...entry.grid };
  }
}

export const textureAtlasRegistry = new TextureAtlasRegistry();
