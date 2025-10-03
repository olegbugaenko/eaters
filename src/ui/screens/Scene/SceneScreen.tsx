import { useEffect, useMemo, useRef } from "react";
import { useAppLogic } from "../../contexts/AppLogicContext";
import { useBridgeValue } from "../../shared/useBridgeValue";
import { TIME_BRIDGE_KEY } from "../../../logic/modules/TestTimeModule";
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
  gl_FragColor = vec4(0.2, 0.6, 0.9, 0.6);
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

interface SceneScreenProps {
  onExit: () => void;
}

export const SceneScreen: React.FC<SceneScreenProps> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { bridge } = useAppLogic();
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);
  const formatted = useMemo(() => formatTime(timePlayed), [timePlayed]);

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

    const positions = new Float32Array([
      -0.5, -0.5,
      0.5, -0.5,
      -0.5, 0.5,
      -0.5, 0.5,
      0.5, -0.5,
      0.5, 0.5,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const drawScene = () => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
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
      drawScene();
    };

    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <div className="scene-screen">
      <div className="scene-toolbar">
        <Button onClick={onExit}>Main Menu</Button>
        <div className="scene-status">Time played: {formatted}</div>
      </div>
      <div className="scene-canvas-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} width={512} height={512} className="scene-canvas" />
      </div>
    </div>
  );
};
