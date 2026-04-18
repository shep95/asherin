import { useEffect, useRef, useCallback } from "react";

/**
 * WebGL-powered liquid ripple displacement overlay.
 * On click, a ripple wave emanates from the click point and distorts
 * the page content beneath via a displacement shader.
 * Adapted from the reference video for Aureon's dark glassmorphic theme.
 */

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 v_uv;

  #define MAX_RIPPLES 8

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_ripples[MAX_RIPPLES];
  uniform float u_rippleTimes[MAX_RIPPLES];
  uniform float u_rippleStrengths[MAX_RIPPLES];
  uniform int u_rippleCount;

  void main() {
    vec2 uv = v_uv;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 st = uv;
    st.x *= aspect;

    float totalDisp = 0.0;
    vec2 totalOffset = vec2(0.0);

    for (int i = 0; i < MAX_RIPPLES; i++) {
      if (i >= u_rippleCount) break;

      vec2 center = u_ripples[i];
      center.x *= aspect;
      float t = u_time - u_rippleTimes[i];
      float strength = u_rippleStrengths[i];

      if (t < 0.0 || t > 2.5) continue;

      float dist = distance(st, center);
      float radius = t * 0.6;
      float wave = sin((dist - radius) * 25.0) * exp(-dist * 2.5) * exp(-t * 1.8) * strength;

      // Sharper falloff near the wavefront
      float edge = smoothstep(radius - 0.15, radius, dist) * smoothstep(radius + 0.3, radius, dist);
      wave *= edge * 2.0 + (1.0 - edge) * wave;

      vec2 dir = normalize(st - center + 0.001);
      totalOffset += dir * wave * 0.04;
      totalDisp += abs(wave);
    }

    // Neutral monochrome refraction — no color tint
    float alpha = clamp(totalDisp * 1.0, 0.0, 0.35);
    float shimmer = totalDisp * 0.6;
    vec3 color = vec3(shimmer);

    gl_FragColor = vec4(color, alpha * 0.25);
  }
`;

interface Ripple {
  x: number; // normalized 0-1
  y: number;
  time: number;
  strength: number;
}

const ClickRippleEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const startTimeRef = useRef(performance.now() / 1000);
  const rafRef = useRef<number>();
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return false;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn("Ripple shader compile error:", gl.getShaderInfoLog(fs));
      return false;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Ripple program link error");
      return false;
    }

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);

    // Cache uniforms
    uniformsRef.current = {
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_time: gl.getUniformLocation(program, "u_time"),
      u_rippleCount: gl.getUniformLocation(program, "u_rippleCount"),
    };
    for (let i = 0; i < 8; i++) {
      uniformsRef.current[`u_ripples_${i}`] = gl.getUniformLocation(program, `u_ripples[${i}]`);
      uniformsRef.current[`u_rippleTimes_${i}`] = gl.getUniformLocation(program, `u_rippleTimes[${i}]`);
      uniformsRef.current[`u_rippleStrengths_${i}`] = gl.getUniformLocation(program, `u_rippleStrengths[${i}]`);
    }

    glRef.current = gl;
    programRef.current = program;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio, 1.5); // cap DPR for performance
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    glRef.current?.viewport(0, 0, canvas.width, canvas.height);
  }, []);

  const render = useCallback(() => {
    const gl = glRef.current;
    if (!gl) return;

    const now = performance.now() / 1000;
    const time = now - startTimeRef.current;

    // Prune old ripples
    ripplesRef.current = ripplesRef.current.filter(
      (r) => time - r.time < 2.5
    );

    const u = uniformsRef.current;
    gl.uniform2f(u.u_resolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(u.u_time, time);
    gl.uniform1i(u.u_rippleCount, ripplesRef.current.length);

    for (let i = 0; i < 8; i++) {
      if (i < ripplesRef.current.length) {
        const r = ripplesRef.current[i];
        gl.uniform2f(u[`u_ripples_${i}`]!, r.x, r.y);
        gl.uniform1f(u[`u_rippleTimes_${i}`]!, r.time);
        gl.uniform1f(u[`u_rippleStrengths_${i}`]!, r.strength);
      } else {
        gl.uniform2f(u[`u_ripples_${i}`]!, 0, 0);
        gl.uniform1f(u[`u_rippleTimes_${i}`]!, -10);
        gl.uniform1f(u[`u_rippleStrengths_${i}`]!, 0);
      }
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    rafRef.current = requestAnimationFrame(render);
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      // Don't trigger on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a") ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("select") ||
        target.closest("[role='button']") ||
        target.closest("[data-no-ripple]")
      ) {
        return;
      }

      const now = performance.now() / 1000 - startTimeRef.current;
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - e.clientY / window.innerHeight; // flip Y for GL

      ripplesRef.current.push({
        x,
        y,
        time: now,
        strength: 0.8 + Math.random() * 0.4,
      });

      // Cap at 8 simultaneous ripples
      if (ripplesRef.current.length > 8) {
        ripplesRef.current = ripplesRef.current.slice(-8);
      }
    },
    []
  );

  useEffect(() => {
    const ok = initGL();
    if (!ok) return;

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("click", handleClick);
    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", handleClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [initGL, resize, render, handleClick]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
};

export default ClickRippleEffect;
