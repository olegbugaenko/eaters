# Framework Overview

This document summarizes the core building blocks that power the eater's prototype
framework. Every system is designed for reusability so modules can combine without
forming tight coupling between UI and logic.

## Core runtime

### `ServiceContainer`
A lightweight registry responsible for constructing and providing shared services
(singletons). Modules request dependencies by token, avoiding manual dependency
chains. The container owns service lifetimes and prevents circular import issues.

### `Application`
Coordinates module lifecycle and service wiring. It registers modules, forwards
save/load/reset calls, and exposes hooks for selecting save slots. When a slot is
opened the application clears module state, restores saves, and starts the autosave
cycle (every 10 seconds). Returning to the main menu tears down timers and scene
objects so different saves never leak into one another.

### `DataBridge`
Implements a pub/sub store that logic modules can push values into. React
components subscribe via `useBridgeValue`, which internally uses
`useSyncExternalStore` for safe updates without modules referencing React. Any
module can publish derived data while keeping save logic encapsulated in its own
class.

## Services

### `SaveManager`
Serializes per-module payloads for each save slot. It asks modules to `save` and
`load` themselves and persists the combined payload in `localStorage`. Autosave
and manual transitions both flow through this service to keep storage logic in
one place.

### `GameLoop`
Runs a ticking scheduler that calls registered module `tick` handlers every
100 ms. Modules can opt in to periodic updates without owning their own timers.

### `SceneObjectManager`
Owns the world map description, camera state, and a registry of renderable scene
objects. Modules add/update/remove objects by identifier while the scene UI reads
the pool directly for high-frequency rendering. The manager also tracks map size,
viewport scaling, and camera panning limits so world-space coordinates stay
consistent across devices.

## Modules

### `TestTimeModule`
Demonstrates a stateful module that increments the in-game timer on each tick,
saves and loads its elapsed time, and publishes the formatted value through the
bridge for UI consumption.

### `BricksModule`
Generates a batch of demo bricks during `reset`, assigns them random positions
within the current map bounds, and saves their definitions. The module also
pushes the current brick count into the bridge so the UI can display aggregate
statistics.

## UI integration

`AppLogicContext` wires the application instance into React and provides the
`scene` service plus the shared data bridge. Screens use `useBridgeValue` to react
to logic updates, while the WebGL scene accesses the scene service directly to
render using the live object pool. Camera position, zoom, and geometry updates are
all derived from the service so UI components remain thin and reusable.
