import { TO_CLIP_GLSL } from "../../../shaders/common.glsl";

// Unit quad для пелюстки (вертикальний трикутник-пелюстка, більший)
export const PETAL_VERTICES = new Float32Array([
  -0.5, -0.5,  // лівий низ
   0.5, -0.5,  // правий низ
   0.0,  1.0,  // верх (верхівка пелюстки, подовжена)
]);

// Структура instance: center(2), basePhase(1), petalIndex(1), petalCount(1),
// innerRadius(1), outerRadius(1), petalWidth(1), rotationSpeed(1), color(3), alpha(1), active(1), pointInward(1)
export const INSTANCE_COMPONENTS = 15;
export const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
export const DEFAULT_BATCH_CAPACITY = 512;

export const PETAL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPosition;
in vec2 a_center;
in float a_basePhase;
in float a_petalIndex;
in float a_petalCount;
in float a_innerRadius;
in float a_outerRadius;
in float a_petalWidth;
in float a_rotationSpeed;
in vec3 a_color;
in float a_alpha;
in float a_active;
in float a_pointInward;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_time;

out vec2 v_localPosition;
out vec3 v_color;
out float v_alpha;
out float v_distance;

` + TO_CLIP_GLSL + `

void main() {
  if (a_active < 0.5) {
    v_localPosition = vec2(0.0);
    v_color = vec3(0.0);
    v_alpha = 0.0;
    v_distance = 0.0;
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  float petalCount = max(a_petalCount, 1.0);
  float innerRadius = max(a_innerRadius, 0.0);
  float outerRadius = max(a_outerRadius, innerRadius);
  float petalWidth = max(a_petalWidth, 1.0);
  float rotationSpeed = a_rotationSpeed;
  
  // Обчислюємо кут для цієї пелюстки
  float anglePerPetal = (2.0 * 3.14159265359) / petalCount;
  float petalAngle = a_petalIndex * anglePerPetal;
  
  // Обертання навколо центру
  float time = u_time * 0.001; // Конвертуємо мс в секунди
  float rotation = petalAngle + a_basePhase + time * rotationSpeed;
  
  // Позиція центру пелюстки на радіусі (середина між innerRadius і outerRadius)
  // Центр завжди на середньому радіусі в напрямку rotation
  float petalRadius = (innerRadius + outerRadius) * 0.5;
  vec2 petalCenter = a_center + vec2(
    cos(rotation) * petalRadius,
    sin(rotation) * petalRadius
  );
  
  // Розмір пелюстки: ширина = petalWidth, висота (довжина) = різниця радіусів
  // Базова геометрія має висоту 1.5 (від -0.5 до 1.0), тому масштабуємо на petalLength / 1.5
  float petalLength = outerRadius - innerRadius;
  vec2 petalSize = vec2(petalWidth, petalLength / 1.5);
  
  // Локальні координати в "юнитах" (без масштабування)
  // Центруємо базову геометрію навколо 0 по Y (з -0.5..1.0 до -0.75..0.75),
  // щоб petalCenter був рівно посередині між inner та outer
  vec2 unitOffset = vec2(a_unitPosition.x, a_unitPosition.y - 0.25);
  
  // Обертаємо пелюстку навколо її центру
  // Базова геометрія спрямована вздовж +Y (верхівка в (0, 1.0))
  // Для назовні: потрібен поворот на (rotation - 90°), щоб +Y дивився по radialDirection
  // Для всередину: додаємо 180°, щоб +Y дивився в протилежний бік (до центру)
  float baseRotation = rotation - 1.57079632679; // -90 градусів для назовні
  float petalRotation = baseRotation + (a_pointInward > 0.5 ? 3.14159265359 : 0.0); // +180° якщо всередину
  
  // Для позиції у світі СПОЧАТКУ масштабуємо локальні координати, а потім обертаємо (R * S)
  vec2 petalOffset = unitOffset * petalSize;
  vec2 rotatedOffset = vec2(
    petalOffset.x * cos(petalRotation) - petalOffset.y * sin(petalRotation),
    petalOffset.x * sin(petalRotation) + petalOffset.y * cos(petalRotation)
  );
  
  vec2 world = petalCenter + rotatedOffset;
  
  // У фрагментний шейдер передаємо центровані локальні координати в unit-просторі (без обертання)
  v_localPosition = unitOffset;
  v_color = max(a_color, vec3(0.0));
  v_alpha = clamp(a_alpha, 0.0, 1.0);
  v_distance = length(a_unitPosition);

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

export const PETAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPosition;
in vec3 v_color;
in float v_alpha;
in float v_distance;

out vec4 fragColor;

void main() {
  // Пелюстка має форму краплі/трикутника з м'яким затуханням
  // v_localPosition вже в unit координатах (без масштабування)
  vec2 localNorm = v_localPosition;
  float dist = length(localNorm);
  
  // Максимальна відстань від центру для базової форми трикутника
  // Базовий трикутник: (-0.5,-0.5), (0.5,-0.5), (0,1.0)
  // Максимальна відстань від центру ≈ sqrt(0.5^2 + 1.0^2) ≈ 1.12
  // Але додаємо трохи запас для smoothstep
  float maxDist = 1.2;
  if (dist > maxDist) {
    fragColor = vec4(0.0);
    return;
  }
  
  // М'яке затухання від центру до краю
  float falloff = smoothstep(maxDist, 0.2, dist);
  
  // Додаткове затухання від основи до верхівки пелюстки
  // Пелюстка витягнута вгору, тому затухаємо по Y
  float yNorm = localNorm.y / max(dist, 0.001);
  float tipFalloff = smoothstep(-0.3, 0.7, yNorm);
  
  // Додатково затухаємо по ширині (бокові краї)
  // Якщо пелюстка занадто широка відносно висоти
  float widthRatio = abs(localNorm.x) / max(abs(localNorm.y), 0.3);
  float widthFalloff = smoothstep(0.8, 0.2, widthRatio);
  
  float finalAlpha = v_alpha * falloff * tipFalloff * widthFalloff;
  
  fragColor = vec4(v_color, finalAlpha);
}
`;
