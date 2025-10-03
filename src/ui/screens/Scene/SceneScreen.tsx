import { useEffect, useMemo, useRef, useState } from "react";
import { useAppLogic } from "../../contexts/AppLogicContext";
import { useBridgeValue } from "../../shared/useBridgeValue";
import { TIME_BRIDGE_KEY } from "../../../logic/modules/TestTimeModule";
import { BRICK_COUNT_BRIDGE_KEY } from "../../../logic/modules/BricksModule";
import {
  SceneCameraState,
  SceneObjectManager,
} from "../../../logic/services/SceneObjectManager";
import {
  COLOR_COMPONENTS,
  POSITION_COMPONENTS,
  VERTEX_COMPONENTS,
  createObjectsRendererManager,
} from "../../renderers/objects";
import { Button } from "../../shared/Button";
import "./SceneScreen.css";

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_color;
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
varying vec4 v_color;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  gl_Position = vec4(toClip(a_position), 0.0, 1.0);
  v_color = a_color;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec4 v_color;
void main() {
  gl_FragColor = v_color;
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

const cameraEquals = (
  a: SceneCameraState,
  b: SceneCameraState | undefined,
  epsilon = 0.01
): boolean => {
  if (a === b) {
    return true;
  }
  if (!b) {
    return false;
  }
  return (
    Math.abs(a.position.x - b.position.x) <= epsilon &&
    Math.abs(a.position.y - b.position.y) <= epsilon &&
    Math.abs(a.scale - b.scale) <= epsilon &&
    Math.abs(a.viewportSize.width - b.viewportSize.width) <= epsilon &&
    Math.abs(a.viewportSize.height - b.viewportSize.height) <= epsilon
  );
};

export const SceneScreen: React.FC<SceneScreenProps> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { bridge, scene } = useAppLogic();
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);
  const brickCount = useBridgeValue<number>(bridge, BRICK_COUNT_BRIDGE_KEY, 0);
  const formatted = useMemo(() => formatTime(timePlayed), [timePlayed]);
  const [scale, setScale] = useState(() => scene.getCamera().scale);
  const [cameraInfo, setCameraInfo] = useState(() => scene.getCamera());
  const cameraInfoRef = useRef(cameraInfo);
  const scaleRef = useRef(scale);

  useEffect(() => {
    cameraInfoRef.current = cameraInfo;
  }, [cameraInfo]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

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

    const staticBuffer = gl.createBuffer();
    const dynamicBuffer = gl.createBuffer();
    if (!staticBuffer || !dynamicBuffer) {
      throw new Error("Unable to create buffers");
    }

    const objectsRenderer = createObjectsRendererManager();

    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const colorLocation = gl.getAttribLocation(program, "a_color");
    const stride = VERTEX_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    const colorOffset = POSITION_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

    if (positionLocation < 0 || colorLocation < 0) {
      throw new Error("Unable to resolve vertex attribute locations");
    }

    const enableAttributes = (buffer: WebGLBuffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(
        positionLocation,
        POSITION_COMPONENTS,
        gl.FLOAT,
        false,
        stride,
        0
      );
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(
        colorLocation,
        COLOR_COMPONENTS,
        gl.FLOAT,
        false,
        stride,
        colorOffset
      );
    };

    const cameraPositionLocation = gl.getUniformLocation(
      program,
      "u_cameraPosition"
    );
    const viewportSizeLocation = gl.getUniformLocation(
      program,
      "u_viewportSize"
    );

    if (!cameraPositionLocation || !viewportSizeLocation) {
      throw new Error("Unable to resolve camera uniforms");
    }

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

    const applySync = () => {
      const sync = objectsRenderer.consumeSyncInstructions();
      if (sync.staticData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sync.staticData, gl.STATIC_DRAW);
      }
      if (sync.dynamicData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sync.dynamicData, gl.DYNAMIC_DRAW);
      } else if (sync.dynamicUpdates.length > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
        sync.dynamicUpdates.forEach(({ offset, data }) => {
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            offset * Float32Array.BYTES_PER_ELEMENT,
            data
          );
        });
      }
    };

    objectsRenderer.applyChanges(scene.flushChanges());
    applySync();

    const render = (timestamp: number) => {
      if (previousTime === null) {
        previousTime = timestamp;
      }
      const deltaMs = Math.min(timestamp - previousTime, 100);
      previousTime = timestamp;

      applyCameraMovement(pointerState, scene, deltaMs, canvas.width, canvas.height);

      const cameraState = scene.getCamera();
      const changes = scene.flushChanges();
      objectsRenderer.applyChanges(changes);
      applySync();

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(
        cameraPositionLocation,
        cameraState.position.x,
        cameraState.position.y
      );
      gl.uniform2f(
        viewportSizeLocation,
        cameraState.viewportSize.width,
        cameraState.viewportSize.height
      );

      const drawBuffer = (buffer: WebGLBuffer, vertexCount: number) => {
        if (vertexCount <= 0) {
          return;
        }
        enableAttributes(buffer);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      };

      drawBuffer(staticBuffer, objectsRenderer.getStaticVertexCount());
      drawBuffer(dynamicBuffer, objectsRenderer.getDynamicVertexCount());

      if (!cameraEquals(cameraState, cameraInfoRef.current)) {
        setCameraInfo(cameraState);
      }
      if (Math.abs(cameraState.scale - scaleRef.current) > 0.0001) {
        setScale(cameraState.scale);
      }
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
      setCameraInfo(current);
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
      gl.deleteBuffer(staticBuffer);
      gl.deleteBuffer(dynamicBuffer);
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
                setCameraInfo(current);
              }}
            />
          </label>
          <span>
            Camera: x {cameraInfo.position.x.toFixed(1)}, y {cameraInfo.position.y.toFixed(1)}
          </span>
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
