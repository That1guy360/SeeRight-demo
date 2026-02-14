        import React, { useRef, useEffect } from "react";

        export default function WebGLCore({
          canvasId = "glcanvas",
          imageElement,
          sph = -2.0,
          cyl = 0.0,
          axisDeg = 0,
          eyeOffset = { x: 0, y: 0 },
          width = 640,
          height = 480
        }) {
          const canvasRef = useRef(null);
          const programRef = useRef(null);
          const textureRef = useRef(null);

          useEffect(() => {
            const canvas = canvasRef.current;
            const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
            if (!gl) {
              console.error("WebGL not supported");
              return;
            }

            const vsSource = `
              attribute vec2 a_position;
              attribute vec2 a_texCoord;
              varying vec2 v_texCoord;
              void main() {
                gl_Position = vec4(a_position, 0, 1);
                v_texCoord = a_texCoord;
              }
            `;
            const fsSource = `#ifdef GL_ES
precision mediump float;
#endif
uniform sampler2D u_image;
varying vec2 v_texCoord;

uniform float u_sph;        // spherical strength
uniform float u_cyl;        // cylinder strength
uniform float u_axis;       // axis in radians
uniform vec2  u_eyeOffset;  // normalized eye offset (-1..1)
uniform vec2  u_resolution; // canvas size

vec2 radial_distort(vec2 uv, float k) {
  vec2 center = vec2(0.5, 0.5) + u_eyeOffset * 0.02;
  vec2 v = uv - center;
  float r = length(v);
  float r2 = r * r;
  float factor = 1.0 + k * r2;
  return center + v * factor;
}

vec2 anisotropic_warp(vec2 uv, float cyl, float axis) {
  vec2 center = vec2(0.5, 0.5) + u_eyeOffset * 0.02;
  vec2 v = uv - center;
  float ca = cos(-axis);
  float sa = sin(-axis);
  vec2 vr = vec2(ca * v.x - sa * v.y, sa * v.x + ca * v.y);
  float s = cyl;
  vr.x = vr.x * (1.0 + s);
  float ca2 = cos(axis);
  float sa2 = sin(axis);
  vec2 v2 = vec2(ca2 * vr.x - sa2 * vr.y, sa2 * vr.x + ca2 * vr.y);
  return center + v2;
}

vec4 directional_blur(sampler2D img, vec2 uv, float amount, float axis) {
  int samples = 8;
  vec4 col = vec4(0.0);
  float total = 0.0;
  vec2 dir = vec2(cos(axis), sin(axis)) * amount;
  for (int i = -4; i <= 4; i++) {
    float fi = float(i);
    vec2 sampleUV = uv + dir * fi;
    col += texture2D(img, sampleUV);
    total += 1.0;
  }
  return col / total;
}

void main() {
  vec2 uv = v_texCoord;
  float k = -0.6 * u_sph;
  vec2 uv_rad = radial_distort(uv, k);
  vec2 uv_aniso = anisotropic_warp(uv_rad, u_cyl, u_axis);
  float blurAmount = abs(u_cyl) * 0.01;
  vec4 color;
  if (abs(u_cyl) > 0.001) {
    color = directional_blur(u_image, uv_aniso, blurAmount, u_axis + 1.5708);
  } else {
    color = texture2D(u_image, uv_aniso);
  }
  gl_FragColor = color;
}
`;

            function compileShader(type, src) {
              const sh = gl.createShader(type);
              gl.shaderSource(sh, src);
              gl.compileShader(sh);
              if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(sh));
                return null;
              }
              return sh;
            }

            const vs = compileShader(gl.VERTEX_SHADER, vsSource);
            const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
            const program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
              console.error(gl.getProgramInfoLog(program));
              return;
            }
            gl.useProgram(program);
            programRef.current = program;

            // quad
            const posBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
              gl.STATIC_DRAW
            );
            const aPos = gl.getAttribLocation(program, "a_position");
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

            // texcoord
            const texBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
              gl.STATIC_DRAW
            );
            const aTex = gl.getAttribLocation(program, "a_texCoord");
            gl.enableVertexAttribArray(aTex);
            gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

            // create texture
            const tex = gl.createTexture();
            textureRef.current = tex;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            // uniforms
            const uImage = gl.getUniformLocation(program, "u_image");
            const uSph = gl.getUniformLocation(program, "u_sph");
            const uCyl = gl.getUniformLocation(program, "u_cyl");
            const uAxis = gl.getUniformLocation(program, "u_axis");
            const uEyeOffset = gl.getUniformLocation(program, "u_eyeOffset");
            const uRes = gl.getUniformLocation(program, "u_resolution");

            let rafId;
            function render() {
              if (!imageElement) {
                rafId = requestAnimationFrame(render);
                return;
              }

              canvas.width = width;
              canvas.height = height;
              gl.viewport(0, 0, canvas.width, canvas.height);

              gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
              try {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);
              } catch (err) {
                // ignore cross-origin issues for local testing
              }

              gl.uniform1i(uImage, 0);
              gl.uniform1f(uSph, sph);
              gl.uniform1f(uCyl, cyl);
              gl.uniform1f(uAxis, axisDeg * Math.PI / 180.0);
              gl.uniform2f(uEyeOffset, eyeOffset.x, eyeOffset.y);
              gl.uniform2f(uRes, canvas.width, canvas.height);

              gl.drawArrays(gl.TRIANGLES, 0, 6);
              rafId = requestAnimationFrame(render);
            }
            render();

            return () => cancelAnimationFrame(rafId);
          }, [imageElement, sph, cyl, axisDeg, eyeOffset, width, height]);

          return <canvas ref={canvasRef} id={canvasId} style={{ width: "100%", height: "100%" }} />;
        }
