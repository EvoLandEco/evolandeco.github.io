const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 matrix;
layout(location=2) in vec2 origin;
layout(location=3) in vec4 metrics;
layout(location=4) in vec4 state;
uniform float time;
out vec2 point;
flat out vec4 measures;
flat out vec4 node;
flat out vec2 pulse;

// CSS ease-out is cubic-bezier(0, 0, .58, 1).
float ease(float p) {
  if (p <= 0.) return 0.;
  if (p >= 1.) return 1.;
  float t = p;
  for (int i = 0; i < 10; i++) {
    float error = 1.74 * t * t - .74 * t * t * t - p;
    float derivative = 3.48 * t - 2.22 * t * t;
    t = clamp(t - error / derivative, 0., 1.);
  }
  return 3. * t * t - 2. * t * t * t;
}

void main() {
  point = corner * 25.;
  vec2 screen = mat2(matrix) * point + origin;
  gl_Position = vec4(screen / 1000. * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
  measures = metrics;
  node = state;
  float p = state.x < 0. ? -1. : ease(mod(time + state.x, 3.6) / 3.6);
  pulse = p < 0. ? vec2(1., .25) : vec2(.7 + .95 * p, .65 * (1. - p));
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 point;
flat in vec4 measures;
flat in vec4 node;
flat in vec2 pulse;
uniform vec3 markerColor;
uniform vec3 background;
uniform vec3 haloColor;
uniform vec3 rimColor;
uniform vec3 focusColor;
uniform vec3 sparkColor;
out vec4 outputColor;

vec4 over(vec4 base, vec3 rgb, float alpha) {
  return vec4(rgb * alpha + base.rgb * (1. - alpha), alpha + base.a * (1. - alpha));
}
float coverage(float distance) {
  return clamp(.5 + distance / max(fwidth(distance), .00001), 0., 1.);
}
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 delta = b - a;
  return length(p - a - delta * clamp(dot(p - a, delta) / dot(delta, delta), 0., 1.));
}

void main() {
  if (node.y < 0.) discard;
  vec4 c = vec4(0.);
  if (node.y > 1.5) {
    float radius = length(point);
    float along = mod(atan(point.y, point.x) + 6.28318530718, 6.28318530718) * 11.;
    float dash = mod(along, 8.);
    outputColor = over(c, focusColor,
      (coverage(12. - radius) - coverage(10. - radius)) * coverage(min(dash, 4. - dash)));
    return;
  }
  if (node.y > 0.) {
    float d = min(segment(point, vec2(-3., -5.), vec2(2., 0.)),
      segment(point, vec2(2., 0.), vec2(-3., 5.)));
    c = over(c, rimColor, coverage(2.5 - d) * node.z);
    c = over(c, rimColor, coverage(.85 - d) * node.w);
    outputColor = c * measures.w;
    return;
  }
  float radius = length(point);
  c = over(c, haloColor, .45 * clamp(1. - radius / measures.x, 0., 1.));
  float outer = 10.6 * pulse.x, inner = 9.4 * pulse.x;
  c = over(c, markerColor, (coverage(outer - radius) - coverage(inner - radius)) * pulse.y);
  c = over(c, background, .9 * coverage(measures.y - radius));
  c = over(c, markerColor, coverage(measures.y + measures.z * .5 - radius)
    - coverage(measures.y - measures.z * .5 - radius));
  c = over(c, markerColor, coverage(3.5 - radius));
  c = over(c, sparkColor, coverage(1.3 - radius));
  outputColor = c;
}`;

const stride = 14;

/** Surface markers share one draw; SVG owns their labels and pointer targets. */
export function createGlobeMarkers(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = 1;
  const colorPaint = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!colorPaint) return null;
  const program = gl.createProgram();
  const vertices = gl.createBuffer(), instances = gl.createBuffer(), vao = gl.createVertexArray();
  if (!program || !vertices || !instances || !vao) {
    gl.deleteProgram(program); gl.deleteBuffer(vertices); gl.deleteBuffer(instances); gl.deleteVertexArray(vao);
    return null;
  }
  const destroy = () => {
    gl.deleteBuffer(vertices); gl.deleteBuffer(instances); gl.deleteVertexArray(vao); gl.deleteProgram(program);
  };
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(kind);
    if (!shader) { destroy(); return null; }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (compiled) gl.attachShader(program, shader);
    gl.deleteShader(shader);
    if (!compiled) { destroy(); return null; }
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { destroy(); return null; }
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  for (const [index, size, offset] of [[1, 4, 0], [2, 2, 4], [3, 4, 6], [4, 4, 10]]) {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride * 4, offset * 4);
    gl.vertexAttribDivisor(index, 1);
  }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  const time = gl.getUniformLocation(program, "time");
  const colors = ["markerColor", "background", "haloColor", "rimColor", "focusColor", "sparkColor"].map(name => gl.getUniformLocation(program, name));
  const epoch = performance.now();
  let poses = new Float32Array(0), packed = new Float32Array(0), focused = -1, selected = -1, count = 0, length = 0;
  let playing = false;
  let births = new Map<string, number>();
  return {
    configure(ids: string[], motion: boolean, selectedId?: string) {
      const now = (performance.now() - epoch) / 1000;
      const nextBirths = new Map<string, number>();
      length = ids.length;
      selected = ids.indexOf(selectedId ?? "");
      focused = -1;
      if (poses.length < length * stride) poses = new Float32Array(length * stride);
      if (packed.length < (length + 1) * stride) {
        packed = new Float32Array((length + 1) * stride);
        gl.bindBuffer(gl.ARRAY_BUFFER, instances);
        gl.bufferData(gl.ARRAY_BUFFER, packed.byteLength, gl.DYNAMIC_DRAW);
      }
      ids.forEach((id, i) => {
        const birth = motion && playing ? births.get(id) ?? now : now;
        nextBirths.set(id, birth);
        poses[i * stride + 10] = motion ? ((i * .37 - birth) % 3.6 + 3.6) % 3.6 : -1;
      });
      births = nextBirths;
      playing = motion;
    },
    palette(style: CSSStyleDeclaration) {
      for (const [i, property] of ["--atlas-marker", "--background", "--atlas-marker-halo", "--atlas-rim", "--primary", "--atlas-marker-spark"].entries()) {
        colorPaint.clearRect(0, 0, 1, 1);
        colorPaint.fillStyle = style.getPropertyValue(property).trim();
        colorPaint.fillRect(0, 0, 1, 1);
        const [r, g, b] = colorPaint.getImageData(0, 0, 1, 1).data;
        gl.uniform3f(colors[i], r / 255, g / 255, b / 255);
      }
    },
    pose(index: number, x: number, y: number, rotation: number, scale: number, kind: number, opacity: number) {
      const offset = index * stride, cosine = Math.cos(rotation), sine = Math.sin(rotation);
      poses[offset] = cosine * scale; poses[offset + 1] = sine * scale;
      poses[offset + 2] = -sine; poses[offset + 3] = cosine;
      poses[offset + 4] = x; poses[offset + 5] = y;
      poses[offset + 9] = opacity; poses[offset + 11] = kind;
    },
    active(index: number, active: boolean, focus: boolean) {
      const offset = index * stride;
      poses[offset + 6] = active ? 24 : 18;
      poses[offset + 7] = active ? 8.5 : 7;
      poses[offset + 8] = active ? 2 : 1.7;
      poses[offset + 12] = active ? .18 : .07;
      poses[offset + 13] = active ? .95 : .5;
      if (index === focused && !focus) focused = -1;
      if (focus) focused = index;
    },
    upload() {
      count = 0;
      const append = (index: number) => {
        const offset = index * stride;
        for (let i = 0; i < stride; i++) packed[count * stride + i] = poses[offset + i];
        count++;
        if (index === focused && poses[offset + 11] >= 0) {
          const at = count++ * stride;
          packed.fill(0, at, at + stride);
          packed[at] = packed[at + 3] = 1;
          packed[at + 4] = poses[offset + 4]; packed[at + 5] = poses[offset + 5];
          packed[at + 10] = -1; packed[at + 11] = 2;
        }
      };
      for (let i = 0; i < length; i++) if (i !== selected) append(i);
      if (selected >= 0) append(selected);
      gl.bindBuffer(gl.ARRAY_BUFFER, instances);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed, 0, count * stride);
    },
    resize(width: number, height: number) {
      const w = Math.round(width * devicePixelRatio), h = Math.round(height * devicePixelRatio);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    },
    draw(now = performance.now()) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(time, (now - epoch) / 1000);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    },
    destroy,
  };
}
