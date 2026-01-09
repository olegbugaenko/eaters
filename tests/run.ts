import Module from "module";
import path from "path";
import { run } from "./testRunner";

const ModuleCtor = Module as typeof Module & {
  _resolveFilename?: (
    request: string,
    parent: NodeModule | null | undefined,
    isMain: boolean,
    options?: { paths?: string[] },
  ) => string;
};

const originalResolve = ModuleCtor._resolveFilename?.bind(ModuleCtor);

if (originalResolve) {
  const aliasRoot = path.resolve(__dirname, "../src");
  const aliases: Record<string, string> = {
    "@": aliasRoot,
    "@core": path.join(aliasRoot, "core"),
    "@ui": path.join(aliasRoot, "ui"),
    "@screens": path.join(aliasRoot, "ui", "screens"),
    "@ui-shared": path.join(aliasRoot, "ui", "shared"),
    "@shared": path.join(aliasRoot, "shared"),
    "@logic": path.join(aliasRoot, "logic"),
    "@db": path.join(aliasRoot, "db"),
  };

  ModuleCtor._resolveFilename = (
    request: string,
    parent: NodeModule | null | undefined,
    isMain: boolean,
    options?: { paths?: string[] },
  ) => {
    const aliasEntry = Object.entries(aliases).find(
      ([prefix]) => request === prefix || request.startsWith(`${prefix}/`),
    );
    if (aliasEntry) {
      const [prefix, target] = aliasEntry;
      const suffix = request.slice(prefix.length);
      const rewritten = path.join(target, suffix);
      return originalResolve(rewritten, parent, isMain, options);
    }
    return originalResolve(request, parent, isMain, options);
  };
}

import "./SceneObjectManager.test";
import "./fill.test";
import "./BulletModule.test";
import "./FireballModule.test";
import "./ExplosionModule.test";
import "./BricksModule.test";
import "./PlayerUnitsModule.test";
import "./MapModule.test";
import "./UnitAutomationModule.test";
import "./Application.test";
import "./ResourcesModule.test";
import "./UnitModuleWorkshopModule.test";
import "./formatNumber.test";
import "./ParticleEmitterPrimitive.test";

void run();
