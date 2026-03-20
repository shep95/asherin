import { useEffect, useRef, useCallback } from "react";

/**
 * WebGL animated wallpaper: dark organic fluid vortex with golden edge highlights.
 * Inspired by Unreal 5 / Blender fluid simulation aesthetic.
 */

const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
  precision highp float;
  uniform vec2 u_res;
  uniform float u_time;

  // Simplex-ish noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5000 * snoise(p); p *= 2.01;
    f += 0.2500 * snoise(p); p *= 2.02;
    f += 0.1250 * snoise(p); p *= 2.03;
    f += 0.0625 * snoise(p);
    return f;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    float aspect = u_res.x / u_res.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    float t = u_time * 0.15;

    // Swirling distortion
    float angle = atan(p.y, p.x);
    float dist = length(p);

    // Warp coordinates with turbulence
    vec2 warp = p;
    warp += vec2(
      fbm(p * 2.0 + t * 0.7),
      fbm(p * 2.0 + t * 0.5 + 5.0)
    ) * 0.35;

    // Add rotation
    float swirl = dist * 3.0 - t * 2.0;
    float cs = cos(swirl * 0.5);
    float sn = sin(swirl * 0.5);
    warp = mat2(cs, -sn, sn, cs) * warp;

    // Main fluid noise
    float n1 = fbm(warp * 3.0 + t);
    float n2 = fbm(warp * 2.5 - t * 0.8 + 10.0);
    float n3 = fbm(warp * 4.0 + t * 1.2 + 20.0);

    // Organic blob shape — morphing radius
    float blobR = 0.28 + 0.08 * sin(t * 1.5) + 0.06 * sin(t * 2.3 + 1.0);
    blobR += 0.05 * n1;

    // Edge detection for highlights
    float edge = smoothstep(blobR + 0.12, blobR, dist) * smoothstep(blobR - 0.15, blobR, dist);

    // Inner darkness
    float inner = smoothstep(blobR + 0.05, blobR - 0.1, dist);

    // Fluid texture inside the blob
    float fluid = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    fluid = fluid * 0.5 + 0.5;

    // Golden/amber edge highlights
    vec3 edgeColor = vec3(0.85, 0.65, 0.35); // warm gold
    vec3 edgeColor2 = vec3(0.95, 0.85, 0.7); // bright gold
    vec3 highlight = mix(edgeColor, edgeColor2, n3 * 0.5 + 0.5);

    // Edge glow intensity — varies with noise for organic feel
    float edgeGlow = edge * (0.6 + 0.4 * n2);
    edgeGlow *= smoothstep(0.6, 0.0, dist); // fade at extremes

    // Inner subtle texture (very dark with slight structure)
    float innerTex = inner * fluid * 0.04;

    // Outer dark tendrils
    float tendrils = smoothstep(0.5, 0.25, dist) * fbm(p * 5.0 + t * 0.3) * 0.02;

    // Compose
    vec3 col = vec3(0.02, 0.015, 0.01); // near-black base
    col += highlight * edgeGlow * 0.7;
    col += vec3(0.03, 0.025, 0.02) * innerTex;
    col += vec3(0.04, 0.03, 0.02) * tendrils;

    // Subtle purple ambient in outer areas
    float outerGlow = smoothstep(0.15, 0.5, dist) * 0.015;
    col += vec3(0.08, 0.02, 0.12) * outerGlow;

    // Vignette
    float vig = 1.0 - smoothstep(0.3, 0.85, dist);
    col *= 0.7 + 0.3 * vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const AnimatedVortexWallpaper = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const startRef = useRef(performance.now() / 1000);
  const uniformsRef = useRef<{ u_res: WebGLUniformLocation | null; u_time: WebGLUniformLocation | null }>({ u_res: null, u_time: null });

  const init = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return false;
    const gl = c.getContext("webgl", { alpha: false, antialias: false });
    if (!gl) return false;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERT);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAG);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn("Vortex shader error:", gl.getShaderInfoLog(fs));
      return false;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog);

    uniformsRef.current.u_res = gl.getUniformLocation(prog, "u_res");
    uniformsRef.current.u_time = gl.getUniformLocation(prog, "u_time");
    glRef.current = gl;
    return true;
  }, []);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    glRef.current?.viewport(0, 0, c.width, c.height);
  }, []);

  const render = useCallback(() => {
    const gl = glRef.current;
    if (!gl) return;
    const t = performance.now() / 1000 - startRef.current;
    gl.uniform2f(uniformsRef.current.u_res, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(uniformsRef.current.u_time, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    rafRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    if (!init()) return;
    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [init, resize, render]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0"
      style={{ zIndex: 0 }}
    />
  );
};

export default AnimatedVortexWallpaper;
