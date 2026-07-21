"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "@/hooks/usePlayer";
import { useTheme } from "@/hooks/useTheme";
import { extractColorsFromImage, DEFAULT_COLORS, type ExtractedColors } from "@/app/lib/colorExtractor";

// WebGL 着色器 - 大波纹流动效果
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;

#define T time

float noise(vec2 p){
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float smoothNoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = noise(i);
  float b = noise(i + vec2(1.0, 0.0));
  float c = noise(i + vec2(0.0, 1.0));
  float d = noise(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p){
  float val = 0.0;
  float amp = 0.5;
  for(int i = 0; i < 4; i++){
    val += amp * smoothNoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return val;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
  float t = T * 0.15;

  // 3 层大波纹 - 每层用不同的颜色
  float n1 = fbm(uv * 1.5 + vec2(t * 0.3, t * 0.2));
  float n2 = fbm(uv * 1.2 + vec2(-t * 0.2, t * 0.15) + 3.0);
  float n3 = fbm(uv * 1.0 + vec2(t * 0.1, -t * 0.25) + 6.0);

  // 背景底层 - 主色调深色
  vec3 col = u_color1 * 0.12;

  // 波纹层1 - 主色调
  col += u_color1 * smoothstep(0.3, 0.7, n1) * 0.3;

  // 波纹层2 - 副色调
  col += u_color2 * smoothstep(0.35, 0.75, n2) * 0.25;

  // 波纹层3 - 第三色调
  col += u_color3 * smoothstep(0.4, 0.8, n3) * 0.2;

  // 边缘淡出
  float vig = 1.0 - dot(uv * 0.7, uv * 0.7);
  col *= smoothstep(0.0, 0.5, vig);

  O = vec4(col, 1.0);
}`;

const VERTEX_SHADER = `#version 300 es
in vec4 position;
void main(){ gl_Position = position; }`;

export function SilkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const colorsRef = useRef<ExtractedColors>(DEFAULT_COLORS);
  const { currentSong } = usePlayer();
  const { dynamicBg } = useTheme();
  const prevCover = useRef("");

  // 如果动态背景关闭，不渲染
  if (!dynamicBg) return null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2");
    if (!gl) return;
    glRef.current = gl;

    // 编译着色器
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("Fragment shader error:", gl.getShaderInfoLog(fs));
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    programRef.current = program;

    // 顶点缓冲
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    // 尺寸
    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // 缓存 uniform location（避免每帧字符串查找）
    const uResolution = gl.getUniformLocation(program, "resolution");
    const uTime = gl.getUniformLocation(program, "time");
    const uColor1 = gl.getUniformLocation(program, "u_color1");
    const uColor2 = gl.getUniformLocation(program, "u_color2");
    const uColor3 = gl.getUniformLocation(program, "u_color3");

    // 渲染循环
    let frame: number;
    const render = (now: number) => {
      gl.useProgram(program);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 0.001);

      const c = colorsRef.current;
      gl.uniform3f(uColor1, c.primary[0]/255, c.primary[1]/255, c.primary[2]/255);
      gl.uniform3f(uColor2, c.secondary[0]/255, c.secondary[1]/255, c.secondary[2]/255);
      gl.uniform3f(uColor3, c.accent[0]/255, c.accent[1]/255, c.accent[2]/255);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
      // Clean up WebGL resources
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (buffer) gl.deleteBuffer(buffer);
    };
  }, []);

  // 封面变化时提取颜色
  useEffect(() => {
    const url = currentSong?.coverUrl;
    if (!url || url === prevCover.current) return;
    prevCover.current = url;

    extractColorsFromImage(url).then((colors) => {
      console.log("New colors for song:", currentSong?.title, colors);
      colorsRef.current = colors;
    });
  }, [currentSong?.coverUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
