#Agents

## Global guidelines

### Technology stack
React, Typescript, WebGL

### General file structure
src/ - source files of the project
- logic/ - app logic. Working with saving, loading, calculations and updating game state
-- core/ - basic abstract classes and system classes
-- modules/ - classes implementing specific logic

- ui/ - react components and webgl shaders for drawing scene
-- shared/ - shared components
-- screens/ - screen specific components, each screen in separate sub-folder

### Code style gidelines
Use prettier
Use types
Use shared styles and components as much as possible.
UI should not work directly with logic, as well as logic with UI. We need to build and utilize interaction standart