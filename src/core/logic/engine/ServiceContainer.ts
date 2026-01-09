export class ServiceContainer<Services extends Record<string, any> = Record<string, any>> {
  private services = new Map<string, unknown>();

  public register<T>(token: string, service: T): void {
    if (this.services.has(token)) {
      throw new Error(`Service with token ${token} is already registered`);
    }
    this.services.set(token, service);
  }

  public get<T>(token: string): T {
    const service = this.services.get(token);
    if (!service) {
      throw new Error(`Service with token ${token} is not registered`);
    }
    return service as T;
  }

  public getOptional<T>(token: string): T | null {
    return (this.services.get(token) as T | undefined) ?? null;
  }
}
