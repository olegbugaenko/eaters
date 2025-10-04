# Logic API Reference

This document describes the runtime classes that power the eater's prototype. It
focuses on constructor dependencies, important methods, and the data contracts
that modules exchange through the services layer.

## Core architecture

### `Application`
Coordinates wiring between services and game modules. The constructor builds the
shared services (`SaveManager`, `GameLoop`, `SceneObjectManager`,
`MovementService`) and modules (`TestTimeModule`, `ExplosionModule`,
`BricksModule`, `PlayerUnitsModule`, `MapModule`, `BulletModule`). Key methods:

- `initialize()` — calls `initialize` on every registered module.
- `reset()` — clears the scene graph and forwards `reset` to modules.
- `selectSlot(slot)` — changes save slot, reloads data, restarts the game loop.
- `returnToMainMenu()` — saves the current slot, clears it, stops the loop.
- `selectMap(mapId)` — forwards the selection to `MapModule`.
- `getBridge()`, `getSceneObjects()`, `getGameLoop()`, `getSaveManager()` —
  expose the shared services for UI and tests.

Modules are registered through a private helper that wires them into the save
manager and the game loop at the same time.

### `ServiceContainer`
A lightweight registry that stores singleton instances by string key. It offers
`register(key, instance)` and `get<T>(key)` to retrieve the service. The
container prevents accidental duplicates and centralizes dependency lookup,
allowing modules to remain decoupled.

### `DataBridge`
A type-agnostic publish/subscribe bus. Modules push derived data through
`setValue(key, value)`, React components subscribe with `subscribe(key, cb)` and
consume values through `getValue(key)`. The bridge decouples UI reactivity from
module internals.

### `GameLoop`
Owns the ticking scheduler. Modules register via `registerModule(module)` and
receive `tick(deltaMs)` callbacks when the loop is running. The loop can be
started and stopped, and it automatically skips updates when `deltaMs` is zero
or negative.

### `SaveManager`
Persists per-module save payloads to `localStorage`. Modules register themselves
so the manager can call `save()` and `load(data)` for each slot. The manager
supports manual saves, slot switching, and timed autosaves.

### `SceneObjectManager`
Maintains the world map and renderable objects. Important capabilities:

- `addObject(type, config)` — inserts a new renderable and returns its id.
- `updateObject(id, patch)` — mutates existing objects in place.
- `removeObject(id)` — deletes renderables when they expire or are destroyed.
- `clear()` — wipes the scene (used when resetting modules).
- `getMapSize()` — returns `{width, height}` for clamping positions.

Scene objects are pure data records consumed by the WebGL renderer, which keeps
logic isolated from presentation.

## Modules

### Module lifecycle
Every module implements the `GameModule` interface:

- `id` — unique identifier used in save payloads.
- `initialize()` — called once when the application boots.
- `reset()` — clears state when switching saves or returning to menu.
- `load(data)` / `save()` — serialization hooks for the `SaveManager`.
- `tick(deltaMs)` — optional update hook, called by the `GameLoop`.

### `TestTimeModule`
A sample module that increments an in-game timer on each tick, persists the
elapsed time, and pushes a formatted string via the bridge key
`time/elapsedLabel`.

### `BricksModule`
Manages destructible map bricks. Responsibilities:

- `setBricks(bricks)` / `load(data)` — sanitize brick definitions and build
  immutable runtime state.
- `getBrickStates()` / `getBrickState(id)` — expose defensive copies for other
  systems (e.g., unit AI).
- `findNearestBrick(position)` — spatial query helper for targeting.
- `applyDamage(brickId, rawDamage)` — subtracts armor, applies damage, spawns
  explosion effects, updates bridge stats, and removes bricks when health reaches
  zero.

Each brick stores knock-back parameters, base damage, and physical size derived
from `bricks-db.ts`. Destructible configs now define
`damageExplosion` / `destructionExplosion`, providing explosion type references
and radius tuning. The module spawns those effects via `ExplosionModule` using
the brick's position, so all visual logic is centralized in the explosion
system.

### `MapModule`
Loads map definitions, wires brick groups, and resets dependent modules when the
player selects a new map. It ensures the scene graph reflects the currently
active map configuration.

### `PlayerUnitsModule`
Controls friendly units. Core features include movement towards target bricks,
attack resolution (`applyDamage` on `BricksModule`), knock-back handling, and
bridge updates for unit stats. It depends on `MovementService` for pathing.

### `ExplosionModule`
Creates persistent explosion effects that animate their radius, opacity, and
particle emitters over time. Public API:

- `spawnExplosion({ position, initialRadius })` — convenience wrapper that uses
  the default "plasmoid" config.
- `spawnExplosionByType(type, { position, initialRadius? })` — loads the config
  from `explosions-db.ts`, spawns a wave renderable, and configures optional
  particle emitters.

The module tracks active explosions, updates them each tick, and removes them
when their lifetimes expire.

### `BulletModule`
Handles projectile spawning and updates. Bullets move across the map, expire
after their configured lifetime or when they leave bounds, and trigger
explosions via `ExplosionModule` (using the type defined in `bullets-db.ts`).

### `Map` and `Player` databases
- `maps-db.ts` defines map layouts and groups of bricks to spawn.
- `player-units-db.ts` stores unit archetypes with stats such as damage, attack
  delay, and speed. `PlayerUnitsModule` reads these configs when creating units.

### Brick configuration database
`bricks-db.ts` describes the visual and gameplay properties of each brick type.
Destructible metadata includes:

- `maxHp`, `hp`, and `armor` — durability parameters.
- `baseDamage` — melee damage inflicted when units collide with the brick.
- `brickKnockBackDistance` / `brickKnockBackSpeed` — knock-back tuning.
- `physicalSize` — collision radius for targeting.
- `damageExplosion` / `destructionExplosion` — references to explosion effects
  with optional radius overrides. These values are consumed by `BricksModule`
  and resolved by `ExplosionModule`.

## Interaction flow summary

1. A unit attacks a brick through `PlayerUnitsModule`.
2. `BricksModule.applyDamage` reduces health and (if configured) calls
   `ExplosionModule.spawnExplosionByType` with the damage or destruction effect.
3. `ExplosionModule` creates a wave scene object and optional particle emitter
   that the renderer animates automatically.
4. `BricksModule` updates bridge statistics so UI counters stay in sync.

This pipeline ensures all visual effects are centralized while logic modules only
own gameplay state and intent.
