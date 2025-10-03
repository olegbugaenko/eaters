import { useEffect, useMemo, useRef, useState } from "react";
import { useAppLogic } from "../../contexts/AppLogicContext";
import { useBridgeValue } from "../../shared/useBridgeValue";
import { TIME_BRIDGE_KEY } from "../../../logic/modules/TestTimeModule";
import { BRICK_COUNT_BRIDGE_KEY } from "../../../logic/modules/BricksModule";
import {
  SceneCameraState,
  SceneObjectInstance,
  SceneObjectManager,
} from "../../../logic/services/SceneObjectManager";
import { Button } from "../../shared/Button";
import "./SceneScreen.css";

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

const EMPTY_GEOMETRY = new Float32Array(0);

const buildGeometry = (
  objects: readonly SceneObjectInstance[],
  camera: SceneCameraState
): Float32Array => {
  if (objects.length === 0) {
    return EMPTY_GEOMETRY;
  }

  const data: number[] = [];
  const viewLeft = camera.position.x;
  const viewTop = camera.position.y;
  const viewRight = viewLeft + camera.viewportSize.width;
  const viewBottom = viewTop + camera.viewportSize.height;

  objects.forEach((object) => {
    const { position, size } = object.data;
    const width = size?.width ?? 0;
    const height = size?.height ?? 0;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const leftWorld = position.x - halfWidth;
    const rightWorld = position.x + halfWidth;
    const topWorld = position.y - halfHeight;
    const bottomWorld = position.y + halfHeight;

    if (
      rightWorld < viewLeft ||
      leftWorld > viewRight ||
      bottomWorld < viewTop ||
      topWorld > viewBottom
    ) {
      return;
    }

    const left = toClipX(leftWorld, camera);
    const right = toClipX(rightWorld, camera);
    const top = toClipY(topWorld, camera);
    const bottom = toClipY(bottomWorld, camera);

    data.push(
      left,
      bottom,
      right,
      bottom,
      left,
      top,
      left,
      top,
      right,
      bottom,
      right,
      top
    );
  });

  if (data.length === 0) {
    return EMPTY_GEOMETRY;
  }

  return new Float32Array(data);
};

const toClipX = (value: number, camera: SceneCameraState): number =>
  clamp(((value - camera.position.x) / camera.viewportSize.width) * 2 - 1, -1, 1);

const toClipY = (value: number, camera: SceneCameraState): number =>
  clamp(1 - ((value - camera.position.y) / camera.viewportSize.height) * 2, -1, 1);

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

interface SceneScreenProps {
  onExit: () => void;
}

export const SceneScreen: React.FC<SceneScreenProps> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { bridge, scene } = useAppLogic();
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);
  const brickCount = useBridgeValue<number>(bridge, BRICK_COUNT_BRIDGE_KEY, 0);
  const formatted = useMemo(() => formatTime(timePlayed), [timePlayed]);
  const [scale, setScale] = useState(() => scene.getCamera().scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL is not supported");
      return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      throw new Error("Unable to create buffer");
    }

    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let frame = 0;
    let previousTime: number | null = null;

    const pointerState = {
      x: 0,
      y: 0,
      inside: false,
    };

    const render = (timestamp: number) => {
      if (previousTime === null) {
        previousTime = timestamp;
      }
      const deltaMs = Math.min(timestamp - previousTime, 100);
      previousTime = timestamp;

      const cameraState = scene.getCamera();
      const geometry = buildGeometry(scene.getObjects(), cameraState);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.DYNAMIC_DRAW);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (geometry.length > 0) {
        gl.drawArrays(gl.TRIANGLES, 0, geometry.length / 2);
      }
      applyCameraMovement(pointerState, scene, deltaMs, canvas.width, canvas.height);
      frame = window.requestAnimationFrame(render);
    };

    const baseWidth = canvas.width || 1;
    const baseHeight = canvas.height || 1;
    const aspectRatio = baseWidth / baseHeight;

    const resize = () => {
      const wrapper = wrapperRef.current ?? canvas.parentElement;
      if (!wrapper) {
        return;
      }
      const { clientWidth, clientHeight } = wrapper;
      let targetWidth = clientWidth;
      let targetHeight = targetWidth / aspectRatio;

      if (targetHeight > clientHeight) {
        targetHeight = clientHeight;
        targetWidth = targetHeight * aspectRatio;
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;
      canvas.width = Math.max(1, Math.round(targetWidth * dpr));
      canvas.height = Math.max(1, Math.round(targetHeight * dpr));

      gl.viewport(0, 0, canvas.width, canvas.height);
      scene.setViewportScreenSize(canvas.width, canvas.height);
      scene.setMapSize({
        width: Math.max(canvas.width, canvas.height, 1000),
        height: Math.max(canvas.width, canvas.height, 1000),
      });
      const current = scene.getCamera();
      setScale(current.scale);
    };

    resize();
    frame = window.requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerState.x = (x / rect.width) * canvas.width;
      pointerState.y = (y / rect.height) * canvas.height;
      pointerState.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    };

    const handlePointerLeave = () => {
      pointerState.inside = false;
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("pointerout", handlePointerLeave);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("pointerout", handlePointerLeave);
    };
  }, [scene]);

  return (
    <div className="scene-screen">
      <div className="scene-toolbar">
        <Button onClick={onExit}>Main Menu</Button>
        <div className="scene-status">
          <span>Time played: {formatted}</span>
          <span>Bricks: {brickCount}</span>
          <label className="scene-zoom">
            Zoom: {scale.toFixed(2)}x
            <input
              type="range"
              min={scene.getScaleRange().min}
              max={scene.getScaleRange().max}
              step={0.05}
              value={scale}
              onChange={(event) => {
                const next = Number.parseFloat(event.target.value);
                scene.setScale(next);
                const current = scene.getCamera();
                setScale(current.scale);
              }}
            />
          </label>
        </div>
      </div>
      <div className="scene-canvas-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} width={512} height={512} className="scene-canvas" />
      </div>
    </div>
  );
};

const EDGE_THRESHOLD = 48;
const CAMERA_SPEED = 400; // world units per second

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
}

const applyCameraMovement = (
  pointer: PointerState,
  scene: SceneObjectManager,
  deltaMs: number,
  canvasWidthPx: number,
  canvasHeightPx: number
) => {
  if (!pointer.inside || deltaMs <= 0) {
    return;
  }
  const deltaSeconds = deltaMs / 1000;
  let moveX = 0;
  let moveY = 0;

  if (pointer.x < EDGE_THRESHOLD) {
    moveX -= CAMERA_SPEED * deltaSeconds;
  } else if (pointer.x > canvasWidthPx - EDGE_THRESHOLD) {
    moveX += CAMERA_SPEED * deltaSeconds;
  }

  if (pointer.y < EDGE_THRESHOLD) {
    moveY -= CAMERA_SPEED * deltaSeconds;
  } else if (pointer.y > canvasHeightPx - EDGE_THRESHOLD) {
    moveY += CAMERA_SPEED * deltaSeconds;
  }

  if (moveX !== 0 || moveY !== 0) {
    scene.panCamera(moveX, moveY);
  }
};
