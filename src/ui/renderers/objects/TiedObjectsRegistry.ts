/**
 * Registry for managing parent-child relationships between scene objects.
 * Objects can be "tied" to a parent object, meaning they should follow
 * the parent's position during interpolation.
 * 
 * All operations are O(1).
 */
export class TiedObjectsRegistry {
  // parentId → Set<childId>
  private readonly parentToChildren = new Map<string, Set<string>>();
  // childId → parentId (for O(1) unregister)
  private readonly childToParent = new Map<string, string>();

  /**
   * Register a child object as tied to a parent.
   * @param childId - The ID of the child object
   * @param parentId - The ID of the parent object to tie to
   */
  public register(childId: string, parentId: string): void {
    // Add to parent → children mapping
    let children = this.parentToChildren.get(parentId);
    if (!children) {
      children = new Set();
      this.parentToChildren.set(parentId, children);
    }
    children.add(childId);

    // Add reverse mapping for O(1) unregister
    this.childToParent.set(childId, parentId);
  }

  /**
   * Unregister a child object.
   * @param childId - The ID of the child object to unregister
   */
  public unregisterChild(childId: string): void {
    const parentId = this.childToParent.get(childId);
    if (parentId === undefined) {
      return;
    }

    // Remove from parent's children set
    const children = this.parentToChildren.get(parentId);
    if (children) {
      children.delete(childId);
      // Cleanup empty sets
      if (children.size === 0) {
        this.parentToChildren.delete(parentId);
      }
    }

    // Remove reverse mapping
    this.childToParent.delete(childId);
  }

  /**
   * Unregister a parent object. All children become orphaned
   * (they will be cleaned up when they are individually unregistered).
   * @param parentId - The ID of the parent object to unregister
   */
  public unregisterParent(parentId: string): void {
    const children = this.parentToChildren.get(parentId);
    if (children) {
      // Remove reverse mappings for all children
      children.forEach((childId) => {
        this.childToParent.delete(childId);
      });
      // Remove parent entry
      this.parentToChildren.delete(parentId);
    }
  }

  /**
   * Get all children tied to a parent.
   * @param parentId - The ID of the parent object
   * @returns Set of child IDs, or undefined if no children
   */
  public getChildren(parentId: string): ReadonlySet<string> | undefined {
    return this.parentToChildren.get(parentId);
  }

  /**
   * Check if a child is tied to any parent.
   * @param childId - The ID of the child object
   * @returns The parent ID, or undefined if not tied
   */
  public getParent(childId: string): string | undefined {
    return this.childToParent.get(childId);
  }

  /**
   * Clear all registrations.
   */
  public clear(): void {
    this.parentToChildren.clear();
    this.childToParent.clear();
  }
}
