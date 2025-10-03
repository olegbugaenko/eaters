export class ServiceContainer {
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
}
