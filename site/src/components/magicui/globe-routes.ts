class RouteResourceError extends Error {}
type Segments = { values: Float32Array; length: number };
type RGB = [number, number, number];
type RGBA = [number, number, number, number];
type Stroke = { radius: number; alpha: number };
type Route = {
  group: SVGGElement;
  line: Segments; trail: Segments; arrow: Segments;
  gradient: Float32Array;
  anchor: [number, number, boolean];
  halo: Stroke; base: Stroke; beam: Stroke[]; arrowHalo: Stroke; arrowLine: Stroke;
  dash: number[]; dashOffset: number;
  color: RGB; start: RGB; end: RGB; shadow: RGBA; background: RGB;
  kind: number; opacity: number;
  text: string; font: string; fontSize: number;
  glyph: [number, number, number, number];
  animations: Animation[];
};
const empty = (): Segments => ({ values: new Float32Array(0), length: 0 });
const quad = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
const maskVertex = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 endpoints;
layout(location=2) in vec3 radii;
layout(location=3) in float kind;
layout(location=4) in vec4 clipBounds;
uniform vec2 size;
out vec2 point;
flat out vec4 segment;
flat out vec3 widths;
flat out float shape;
void main() {
  float padding=max(max(radii.x,radii.y),radii.z)+1.;
  point=mix(max(min(endpoints.xy,endpoints.zw)-padding,clipBounds.xy),
    min(max(endpoints.xy,endpoints.zw)+padding,clipBounds.zw),corner);
  segment=endpoints;widths=radii;shape=kind;
  gl_Position=vec4(point/size*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
}`;
const maskFragment = `#version 300 es
precision highp float;
in vec2 point;
flat in vec4 segment;
flat in vec3 widths;
flat in float shape;
layout(location=0) out vec4 strokes;
layout(location=1) out vec4 features;
void main() {
  vec2 delta=segment.zw-segment.xy;
  float square=dot(delta,delta);
  float distance=length(point-segment.xy-delta*(square>0.?clamp(dot(point-segment.xy,delta)/square,0.,1.):0.));
  vec3 coverage=clamp(.5+(widths-distance)/max(fwidth(distance),.00001),0.,1.);
  coverage=mix(vec3(0.),coverage,greaterThan(widths,vec3(0.)));
  strokes=vec4(0.);features=vec4(0.);
  if(shape<.5) strokes.rgb=coverage;
  else if(shape<1.5) {strokes.a=coverage.r;features.g=coverage.g;}
  else {features.b=coverage.r;features.a=coverage.g;}
}`;
const tileVertex = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 rectangle;
layout(location=2) in vec2 origin;
layout(location=3) in vec4 gradient;
layout(location=4) in vec4 alpha;
layout(location=5) in vec4 beamRectangle;
layout(location=6) in vec4 strokeAlpha;
layout(location=7) in vec3 lineColor;
layout(location=8) in vec3 startColor;
layout(location=9) in vec3 endColor;
layout(location=10) in vec4 shadowColor;
layout(location=11) in vec4 countData;
layout(location=12) in vec4 glyphRectangle;
layout(location=13) in vec3 backgroundColor;
layout(location=14) in float beamKind;
uniform vec2 size;
uniform int pass;
out vec2 point;
flat out vec4 tile;
flat out vec4 ramp;
flat out vec4 opacity;
flat out vec4 beam;
flat out vec4 paintAlpha;
flat out vec3 color;
flat out vec3 firstColor;
flat out vec3 lastColor;
flat out vec4 shadow;
flat out vec4 count;
flat out vec4 glyph;
flat out vec3 background;
flat out float kind;
void main() {
  tile=rectangle;ramp=gradient;opacity=alpha;beam=beamRectangle;paintAlpha=strokeAlpha;
  color=lineColor;firstColor=startColor;lastColor=endColor;shadow=shadowColor;
  count=countData;glyph=glyphRectangle;background=backgroundColor;kind=beamKind;
  vec4 bounds=pass==1?beamRectangle:rectangle;
  point=bounds.xy+corner*bounds.zw;
  vec2 screen=pass==1?point:origin+corner*rectangle.zw;
  gl_Position=vec4(screen/size*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);
}`;
const tileFragment = `
precision highp float;
in vec2 point;
flat in vec4 tile;
flat in vec4 ramp;
flat in vec4 opacity;
flat in vec4 beam;
flat in vec4 paintAlpha;
flat in vec3 color;
flat in vec3 firstColor;
flat in vec3 lastColor;
flat in vec4 shadow;
flat in vec4 count;
flat in vec4 glyph;
flat in vec3 background;
flat in float kind;
uniform vec2 atlasSize;
uniform vec2 glyphSize;
uniform float scale;
uniform int radius;
uniform sampler2D mask;
uniform sampler2D features;
uniform highp sampler2D kernel;
uniform sampler2D letters;
out vec4 outputColor;
vec2 uv(vec2 p) {return vec2(p.x,atlasSize.y-p.y)/atlasSize;}
bool inside(vec2 p,vec4 r) {return all(greaterThanEqual(p,r.xy))&&all(lessThan(p,r.xy+r.zw));}
vec4 gradientAt(vec2 p) {
  vec2 delta=ramp.zw-ramp.xy;float square=dot(delta,delta);
  float t=square>0.?dot(p-ramp.xy,delta)/square:1.;
  if(kind<.5) return vec4(0.);
  if(kind<1.5) return vec4(mix(firstColor,lastColor,clamp(t/.12,0.,1.)),t<0.?0.:clamp((1.-t)/.88,0.,1.));
  float a=t<.2?.3*t:t<.5?.06+.8*(t-.2):t<.8?.3+(t-.5)*4./3.:.7+1.5*(t-.8);
  return vec4(lastColor,clamp(a,0.,1.));
}
float alphaAt(vec2 p) {
  if(!inside(p,beam)) return 0.;
  vec3 a=texture(mask,uv(p)).rgb*opacity.yzw*gradientAt(p).a;
  return 1.-(1.-a.r)*(1.-a.g)*(1.-a.b);
}
vec4 over(vec4 base,vec3 rgb,float a) {return vec4(rgb*a+base.rgb*(1.-a),a+base.a*(1.-a));}
float coverage(float distance) {return clamp(.5+distance/max(fwidth(distance),.00001),0.,1.);}
`;
const blurFragment = `#version 300 es
${tileFragment}
void main() {
  float a=0.;
  for(int i=-radius;i<=radius;i++) a+=alphaAt(point+vec2(float(i),0.))*texelFetch(kernel,ivec2(i+radius,0),0).r;
  outputColor=vec4(a,0.,0.,0.);
}`;
const compositeFragment = `#version 300 es
${tileFragment}
void main() {
  vec4 masks=texture(mask,uv(point)),details=texture(features,uv(point));
  vec4 c=over(vec4(0.),color,masks.a*paintAlpha.x);
  c=over(c,color,details.g*paintAlpha.y);
  if(inside(point,beam)) {
    float blurred=0.;
    if(shadow.a>0.) for(int i=-radius;i<=radius;i++) {
      vec2 p=point+vec2(0.,float(i));
      if(inside(p,beam)) blurred+=texture(features,uv(p)).r*texelFetch(kernel,ivec2(i+radius,0),0).r;
    }
    c=over(c,shadow.rgb,blurred*shadow.a);
    c=over(c,gradientAt(point).rgb,alphaAt(point));
  }
  c=over(c,color,details.b*paintAlpha.z);
  c=over(c,lastColor,details.a*paintAlpha.w);
  if(count.w>0.) {
    float d=length(point-count.xy),r=count.z;
    c=over(c,background,coverage(r-d));
    c=over(c,color,coverage(r+.75*scale-d)-coverage(r-.75*scale-d));
    vec2 local=point-count.xy+glyph.zw*.5;
    if(all(greaterThanEqual(local,vec2(0.)))&&all(lessThan(local,glyph.zw)))
      c=over(c,color,texture(letters,(glyph.xy+local)/glyphSize).a);
  }
  outputColor=c*opacity.x;
}`;
const tileStride = 47;
/** Routes share GPU masks while SVG retains the native interaction targets. */
export function createGlobeRoutes(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: true, failIfMajorPerformanceCaveat: true });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  const buffers: WebGLBuffer[] = [], textures: WebGLTexture[] = [], frames: WebGLFramebuffer[] = [];
  const arrays: WebGLVertexArrayObject[] = [], programs: WebGLProgram[] = [];
  const destroy = () => {
    buffers.forEach(b => gl.deleteBuffer(b)); textures.forEach(t => gl.deleteTexture(t));
    frames.forEach(f => gl.deleteFramebuffer(f)); arrays.forEach(a => gl.deleteVertexArray(a));
    programs.forEach(p => gl.deleteProgram(p));
  };
  const compile = (vertex: string, fragment: string) => {
    const program = gl.createProgram();
    if (!program) throw new Error('Cannot create route shader program');
    programs.push(program);
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Cannot create route shader');
      gl.shaderSource(shader, source); gl.compileShader(shader);
      const valid = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      if (valid) gl.attachShader(program, shader);
      gl.deleteShader(shader);
      if (!valid) throw new Error('Cannot compile route shader');
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Cannot link route shader');
    return program;
  };
  try {
    const pipeline = [compile(maskVertex, maskFragment), compile(tileVertex, blurFragment), compile(tileVertex, compositeFragment)];
    const uniforms = pipeline.map(p => Object.fromEntries(['size', 'pass', 'atlasSize', 'glyphSize', 'scale', 'radius', 'mask', 'features', 'kernel', 'letters']
      .map(name => [name, gl.getUniformLocation(p, name)])));
    const buffer = () => { const b = gl.createBuffer(); if (!b) throw new Error('Cannot create route buffer'); buffers.push(b); return b; };
    const texture = () => { const t = gl.createTexture(); if (!t) throw new Error('Cannot create route texture'); textures.push(t); return t; };
    const framebuffer = () => { const f = gl.createFramebuffer(); if (!f) throw new Error('Cannot create route framebuffer'); frames.push(f); return f; };
    const vao = () => { const a = gl.createVertexArray(); if (!a) throw new Error('Cannot create route vertex array'); arrays.push(a); return a; };
    const vertices = buffer(), segments = buffer(), tiles = buffer(), segmentArray = vao(), tileArray = vao();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const attributes = (array: WebGLVertexArrayObject, data: WebGLBuffer, stride: number, fields: number[][]) => {
      gl.bindVertexArray(array); gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, data);
      for (const [index, size, offset] of fields) {
        gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride * 4, offset * 4);
        gl.vertexAttribDivisor(index, 1);
      }
    };
    attributes(segmentArray, segments, 12, [[1, 4, 0], [2, 3, 4], [3, 1, 7], [4, 4, 8]]);
    attributes(tileArray, tiles, tileStride, [[1, 4, 0], [2, 2, 4], [3, 4, 6], [4, 4, 10], [5, 4, 14],
      [6, 4, 18], [7, 3, 22], [8, 3, 25], [9, 3, 28], [10, 4, 31], [11, 4, 35], [12, 4, 39], [13, 3, 43], [14, 1, 46]]);
    const mask = texture(), features = texture(), kernel = texture(), letters = texture();
    const maskFrame = framebuffer(), blurFrame = framebuffer();
    const maximum = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const sample = (value: WebGLTexture, linear = false) => {
      gl.bindTexture(gl.TEXTURE_2D, value);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    function checkAllocation() {
      const error = gl.getError();
      if (error === gl.OUT_OF_MEMORY || error === gl.CONTEXT_LOST_WEBGL)
        throw new RouteResourceError('Cannot allocate route texture storage');
      if (error !== gl.NO_ERROR) throw new Error(`Route texture allocation failed: ${error}`);
    }
    let routes: Route[] = [], scale = 1, radius = 8, atlasWidth = 1, atlasHeight = 1;
    let dirty = true, glyphDirty = true, visibleTiles = 0, segmentCapacity = 0, tileCapacity = 0;
    let packedTiles = new Float32Array(0), drawnRoutes: Route[] = [];
    const glyphCanvas = document.createElement('canvas'), glyphContext = glyphCanvas.getContext('2d', { willReadFrequently: true });
    const colorCanvas = document.createElement('canvas'); colorCanvas.width = colorCanvas.height = 1;
    const colorPaint = colorCanvas.getContext('2d', { willReadFrequently: true });
    if (!glyphContext || !colorPaint) throw new Error('Cannot create route text canvas');
    const glyphPaint: CanvasRenderingContext2D = glyphContext;
    const colors = new Map<string, RGBA>();
    const rgba = (value: string): RGBA => {
      const known = colors.get(value); if (known) return known;
      colorPaint.clearRect(0, 0, 1, 1); colorPaint.fillStyle = value; colorPaint.fillRect(0, 0, 1, 1);
      const c = colorPaint.getImageData(0, 0, 1, 1).data;
      const result: RGBA = [c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255]; colors.set(value, result); return result;
    };
    const rgb = (value: string): RGB => { const c = rgba(value); return [c[0], c[1], c[2]]; };
    const stroke = (element: Element | null): Stroke => {
      if (!element) return { radius: 0, alpha: 0 };
      const s = getComputedStyle(element); return { radius: parseFloat(s.strokeWidth) / 2, alpha: Number(s.strokeOpacity) * Number(s.opacity) };
    };
    function styles() {
      for (const r of routes) {
        const s = getComputedStyle(r.group), line = r.group.querySelector('.atlas-route-line');
        const lineStyle = line ? getComputedStyle(line) : null;
        r.color = rgb(s.color); r.opacity = Number(s.opacity);
        r.halo = stroke(r.group.querySelector('.atlas-route-halo')); r.base = stroke(line);
        r.dash = lineStyle && lineStyle.strokeDasharray !== 'none' ? lineStyle.strokeDasharray.split(/[ ,]+/).map(parseFloat) : [];
        if (r.dash.length % 2) r.dash = [...r.dash, ...r.dash];
        r.dashOffset = lineStyle ? parseFloat(lineStyle.strokeDashoffset) : 0;
        const travel = r.group.querySelector('.atlas-travel-beam');
        const stops = [...r.group.querySelectorAll('linearGradient stop')];
        r.kind = travel ? 1 : stops.length ? 2 : 0;
        r.start = stops.length ? rgb(getComputedStyle(stops[0]).stopColor) : r.color;
        r.end = stops.length ? rgb(getComputedStyle(stops[stops.length - 1]).stopColor) : r.color;
        r.beam = travel ? [...travel.querySelectorAll(':scope > path')].map(stroke)
          : [stroke(r.group.querySelector('.atlas-route-trail-halo')), stroke(r.group.querySelector('.atlas-route-beam'))];
        while (r.beam.length < 3) r.beam.push({ radius: 0, alpha: 0 });
        const shadow = travel ? getComputedStyle(travel).filter.match(/rgba?\([^)]+\)|#[\da-f]+/i)?.[0] : undefined;
        r.shadow = shadow ? rgba(shadow) : [0, 0, 0, 0];
        r.arrowHalo = stroke(r.group.querySelector('.atlas-route-arrow-halo')); r.arrowLine = stroke(r.group.querySelector('.atlas-route-arrow'));
        const text = r.group.querySelector('.atlas-route-count text'), circle = r.group.querySelector('.atlas-route-count circle');
        r.text = text?.textContent ?? ''; r.background = circle ? rgb(getComputedStyle(circle).fill) : [0, 0, 0];
        if (text) { const t = getComputedStyle(text); r.font = t.font; r.fontSize = parseFloat(t.fontSize); }
        r.animations = r.group.getAnimations().filter(a => a.playState === 'running' || a.pending);
      }
      dirty = glyphDirty = true;
    }
    function glyphs() {
      const entries = new Map<string, { text: string; font: string; size: number; box: [number, number, number, number] }>();
      let area = 0, widest = 1;
      for (const r of routes) {
        if (!r.text) { r.glyph = [0, 0, 0, 0]; continue; }
        const key = r.font + '\n' + r.text;
        let entry = entries.get(key);
        if (!entry) {
          glyphPaint.font = r.font; glyphPaint.textAlign = 'center'; glyphPaint.textBaseline = 'alphabetic';
          const m = glyphPaint.measureText(r.text), halfWidth = Math.max(m.actualBoundingBoxLeft, m.actualBoundingBoxRight, m.width / 2);
          const halfHeight = Math.max(m.actualBoundingBoxAscent - .35 * r.fontSize, m.actualBoundingBoxDescent + .35 * r.fontSize);
          const w = Math.ceil(2 * halfWidth * scale + 4), h = Math.ceil(2 * halfHeight * scale + 4);
          entry = { text: r.text, font: r.font, size: r.fontSize, box: [0, 0, w, h] };
          entries.set(key, entry); area += w * h; widest = Math.max(widest, w);
        }
        r.glyph = entry.box;
      }
      const width = Math.max(widest, Math.ceil(Math.sqrt(area))), rows = [...entries.values()].sort((a, b) => b.box[3] - a.box[3]);
      let x = 0, y = 0, row = 0;
      for (const e of rows) {
        if (x + e.box[2] > width) { x = 0; y += row; row = 0; }
        e.box[0] = x; e.box[1] = y; x += e.box[2]; row = Math.max(row, e.box[3]);
      }
      if (width > maximum || y + row > maximum) throw new RouteResourceError('Route text exceeds the WebGL texture limit');
      glyphCanvas.width = Math.max(1, width); glyphCanvas.height = Math.max(1, y + row);
      for (const e of rows) {
        glyphPaint.setTransform(scale, 0, 0, scale, e.box[0], e.box[1]);
        glyphPaint.font = e.font; glyphPaint.textAlign = 'center'; glyphPaint.textBaseline = 'alphabetic'; glyphPaint.fillStyle = '#fff';
        glyphPaint.fillText(e.text, e.box[2] / (2 * scale), e.box[3] / (2 * scale) + .35 * e.size);
      }
      gl.activeTexture(gl.TEXTURE3); sample(letters, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyphCanvas);
      checkAllocation();
      glyphDirty = false;
    }
    function allocate(width: number, height: number) {
      if (width > maximum || height > maximum) throw new RouteResourceError('Route atlas exceeds the WebGL texture limit');
      if (width === atlasWidth && height === atlasHeight && allocated) return;
      atlasWidth = width; atlasHeight = height;
      for (const value of [mask, features]) { sample(value); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); }
      checkAllocation();
      gl.bindFramebuffer(gl.FRAMEBUFFER, maskFrame);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mask, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, features, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new RouteResourceError('Incomplete route mask framebuffer');
      gl.bindFramebuffer(gl.FRAMEBUFFER, blurFrame);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, features, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new RouteResourceError('Incomplete route blur framebuffer');
      allocated = true;
    }
    let allocated = false, kernelReady = false, packedSegments = new Float32Array(1024), segmentLength = 0;
    type Tile = { route: Route; bounds: number[]; beam: number[]; x: number; y: number };
    let layout: Tile[] = [], ordered: Tile[] = [];
    const expand = (bounds: number[], x: number, y: number, padding: number) => {
      bounds[0] = Math.min(bounds[0], x - padding); bounds[1] = Math.min(bounds[1], y - padding);
      bounds[2] = Math.max(bounds[2], x + padding); bounds[3] = Math.max(bounds[3], y + padding);
    };
    const boundsOf = (bounds: number[], source: Segments, padding: number) => {
      for (let i = 0; i < source.length * 4; i += 2) expand(bounds, source.values[i] * scale, source.values[i + 1] * scale, padding);
    };
    const clipBounds = (bounds: number[], padding: number) => {
      bounds[0] = Math.max(bounds[0], -padding); bounds[1] = Math.max(bounds[1], -padding);
      bounds[2] = Math.min(bounds[2], canvas.width + padding); bounds[3] = Math.min(bounds[3], canvas.height + padding);
      return bounds[0] < bounds[2] && bounds[1] < bounds[3];
    };
    const segmentClip = new Float32Array(4);
    const append = (x1: number, y1: number, x2: number, y2: number, radii: number[], kind: number, dx: number, dy: number) => {
      x1 = x1 * scale + dx; y1 = y1 * scale + dy; x2 = x2 * scale + dx; y2 = y2 * scale + dy;
      const padding = Math.max(radii[0], radii[1], radii[2]) * scale + 1;
      if (Math.max(x1, x2) + padding <= segmentClip[0] || Math.max(y1, y2) + padding <= segmentClip[1]
        || Math.min(x1, x2) - padding >= segmentClip[2] || Math.min(y1, y2) - padding >= segmentClip[3]) return;
      if (segmentLength + 12 > packedSegments.length) { const next = new Float32Array(packedSegments.length * 2); next.set(packedSegments); packedSegments = next; }
      packedSegments[segmentLength++] = x1; packedSegments[segmentLength++] = y1;
      packedSegments[segmentLength++] = x2; packedSegments[segmentLength++] = y2;
      packedSegments[segmentLength++] = radii[0] * scale; packedSegments[segmentLength++] = radii[1] * scale;
      packedSegments[segmentLength++] = radii[2] * scale; packedSegments[segmentLength++] = kind;
      packedSegments.set(segmentClip, segmentLength); segmentLength += 4;
    };
    function packPath(source: Segments, radii: number[], kind: number, dx: number, dy: number, dash: number[] = [], offset = 0) {
      const period = dash.reduce((sum, value) => sum + value, 0);
      let phase = 0, previousX = NaN, previousY = NaN;
      for (let i = 0; i < source.length * 4; i += 4) {
        const x1 = source.values[i], y1 = source.values[i + 1], x2 = source.values[i + 2], y2 = source.values[i + 3];
        if (!period) { append(x1, y1, x2, y2, radii, kind, dx, dy); continue; }
        if (x1 !== previousX || y1 !== previousY) phase = ((offset % period) + period) % period;
        previousX = x2; previousY = y2;
        const length = Math.hypot(x2 - x1, y2 - y1);
        let cursor = 0, at = 0, within = phase;
        while (within >= dash[at] && at < dash.length - 1) within -= dash[at++];
        while (cursor < length) {
          const span = Math.min(length - cursor, dash[at] - within);
          if (at % 2 === 0 && span > 0) append(x1 + (x2 - x1) * cursor / length, y1 + (y2 - y1) * cursor / length,
            x1 + (x2 - x1) * (cursor + span) / length, y1 + (y2 - y1) * (cursor + span) / length, radii, kind, dx, dy);
          cursor += span; within += span;
          if (within >= dash[at]) { within = 0; at = (at + 1) % dash.length; }
        }
        phase = (phase + length) % period;
      }
    }
    function rasterize() {
      if (glyphDirty) glyphs();
      ordered.length = 0;
      let area = 0, widest = 1;
      for (const t of layout) {
        const r = t.route, b = t.bounds, beam = t.beam;
        b[0] = b[1] = beam[0] = beam[1] = Infinity; b[2] = b[3] = beam[2] = beam[3] = -Infinity;
        boundsOf(b, r.line, Math.max(r.halo.radius, r.base.radius) * scale + 1);
        boundsOf(b, r.arrow, Math.max(r.arrowHalo.radius, r.arrowLine.radius) * scale + 1);
        boundsOf(beam, r.trail, Math.max(...r.beam.map(s => s.radius)) * scale + (r.shadow[3] ? radius : 0) + 1);
        if (r.trail.length) { expand(b, beam[0], beam[1], 0); expand(b, beam[2], beam[3], 0); }
        if (r.anchor[2] && r.text) expand(b, r.anchor[0] * scale, r.anchor[1] * scale,
          Math.max(13.75 * scale + 1, r.glyph[2] / 2 + 1, r.glyph[3] / 2 + 1));
        if (b[2] <= 0 || b[3] <= 0 || b[0] >= canvas.width || b[1] >= canvas.height) continue;
        // The separable blur reads source pixels outside the visible canvas.
        const support = r.trail.length && r.shadow[3] ? radius : 0;
        clipBounds(b, support);
        b[0] = Math.floor(b[0]); b[1] = Math.floor(b[1]); b[2] = Math.ceil(b[2]) - b[0]; b[3] = Math.ceil(b[3]) - b[1];
        if (r.trail.length && clipBounds(beam, support)) { beam[0] = Math.floor(beam[0]); beam[1] = Math.floor(beam[1]); beam[2] = Math.ceil(beam[2]) - beam[0]; beam[3] = Math.ceil(beam[3]) - beam[1]; }
        else beam.fill(0);
        area += b[2] * b[3]; widest = Math.max(widest, b[2]); ordered.push(t);
      }
      visibleTiles = ordered.length;
      if (!visibleTiles) { drawnRoutes.length = 0; dirty = false; return; }
      if (widest > maximum) throw new RouteResourceError('Route tile exceeds the WebGL texture limit');
      const packing = [...ordered].sort((a, b) => b.bounds[3] - a.bounds[3]);
      const pack = (width: number) => {
        let x = 0, y = 0, row = 0;
        for (const t of packing) {
          if (x + t.bounds[2] > width) { x = 0; y += row; row = 0; }
          t.x = x; t.y = y; x += t.bounds[2]; row = Math.max(row, t.bounds[3]);
        }
        return y + row;
      };
      const block = (value: number) => Math.ceil(value / 128) * 128;
      let width = atlasWidth, height = allocated && widest <= width ? pack(width) : Infinity;
      if (height > atlasHeight) {
        const candidateWidth = Math.min(maximum, block(Math.max(widest, Math.sqrt(area))));
        const candidateHeight = block(pack(candidateWidth));
        const grownHeight = block(Math.max(height, atlasHeight * 1.5));
        if (width >= widest && grownHeight <= maximum && width * grownHeight <= candidateWidth * candidateHeight) height = grownHeight;
        else { width = candidateWidth; height = candidateHeight; }
        allocate(width, height); pack(width);
      }
      if (packedTiles.length < visibleTiles * tileStride) packedTiles = new Float32Array(2 ** Math.ceil(Math.log2(visibleTiles * tileStride)));
      segmentLength = 0; drawnRoutes.length = 0;
      let at = 0;
      for (const t of ordered) {
        const r = t.route, b = t.bounds, dx = t.x - b[0], dy = t.y - b[1];
        segmentClip[0] = t.x; segmentClip[1] = t.y; segmentClip[2] = t.x + b[2]; segmentClip[3] = t.y + b[3];
        if (r.dash.length) {
          packPath(r.line, [r.halo.radius, 0, 0], 1, dx, dy);
          packPath(r.line, [0, r.base.radius, 0], 1, dx, dy, r.dash, r.dashOffset);
        } else packPath(r.line, [r.halo.radius, r.base.radius, 0], 1, dx, dy);
        packPath(r.trail, r.beam.map(s => s.radius), 0, dx, dy);
        packPath(r.arrow, [r.arrowHalo.radius, r.arrowLine.radius, 0], 2, dx, dy);
        packedTiles.set([t.x, t.y, b[2], b[3], b[0], b[1], r.gradient[0] * scale + dx, r.gradient[1] * scale + dy,
          r.gradient[2] * scale + dx, r.gradient[3] * scale + dy, r.opacity, ...r.beam.map(s => s.alpha),
          t.beam[0] + dx, t.beam[1] + dy, t.beam[2], t.beam[3], r.halo.alpha, r.base.alpha, r.arrowHalo.alpha, r.arrowLine.alpha,
          ...r.color, ...r.start, ...r.end, ...r.shadow, r.anchor[0] * scale + dx, r.anchor[1] * scale + dy, 13 * scale,
          Number(r.anchor[2] && !!r.text), ...r.glyph, ...r.background, r.kind], at);
        at += tileStride; drawnRoutes.push(r);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, segments);
      if (segmentCapacity < packedSegments.byteLength) { segmentCapacity = packedSegments.byteLength; gl.bufferData(gl.ARRAY_BUFFER, segmentCapacity, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, packedSegments, 0, segmentLength);
      uploadTiles();
      gl.bindFramebuffer(gl.FRAMEBUFFER, maskFrame); gl.viewport(0, 0, atlasWidth, atlasHeight);
      gl.colorMask(true, true, true, true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pipeline[0]); gl.uniform2f(uniforms[0].size, atlasWidth, atlasHeight);
      gl.bindVertexArray(segmentArray); gl.enable(gl.BLEND); gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, segmentLength / 12);
      bindTileProgram(1); gl.bindFramebuffer(gl.FRAMEBUFFER, blurFrame);
      gl.colorMask(true, false, false, false); gl.disable(gl.BLEND);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, visibleTiles);
      gl.colorMask(true, true, true, true); dirty = false;
    }
    function uploadTiles() {
      gl.bindBuffer(gl.ARRAY_BUFFER, tiles);
      if (tileCapacity < packedTiles.byteLength) { tileCapacity = packedTiles.byteLength; gl.bufferData(gl.ARRAY_BUFFER, tileCapacity, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, packedTiles, 0, visibleTiles * tileStride);
    }
    function bindTileProgram(pass: number) {
      const u = uniforms[pass]; gl.useProgram(pipeline[pass]); gl.bindVertexArray(tileArray);
      gl.uniform1i(u.pass, pass); gl.uniform2f(u.size, pass === 1 ? atlasWidth : canvas.width, pass === 1 ? atlasHeight : canvas.height);
      gl.uniform2f(u.atlasSize, atlasWidth, atlasHeight); gl.uniform2f(u.glyphSize, glyphCanvas.width, glyphCanvas.height);
      gl.uniform1f(u.scale, scale); gl.uniform1i(u.radius, radius);
      for (const [unit, value, name] of [[0, mask, 'mask'], [1, pass === 2 ? features : null, 'features'], [2, kernel, 'kernel'], [3, letters, 'letters']] as const) {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, value); gl.uniform1i(u[name], unit);
      }
    }
    let available = true;
    function draw(_time = performance.now()) {
      if (!available) return false;
      let pending = false, opacityChanged = false;
      for (const r of routes) {
        if (!r.animations.length) continue;
        const opacity = Number(getComputedStyle(r.group).opacity);
        if (opacity !== r.opacity) { r.opacity = opacity; opacityChanged = true; }
        r.animations = r.animations.filter(a => a.playState === 'running' || a.pending);
        pending ||= r.animations.length > 0;
      }
      const repaint = dirty;
      if (dirty) {
        try { rasterize(); }
        catch (error) {
          if (!(error instanceof RouteResourceError)) throw error;
          available = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.colorMask(true, true, true, true);
          gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return false;
        }
      } else if (opacityChanged) {
        for (let i = 0; i < drawnRoutes.length; i++) packedTiles[i * tileStride + 10] = drawnRoutes[i].opacity;
        uploadTiles();
      }
      if (!repaint && !opacityChanged) return pending;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.colorMask(true, true, true, true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (visibleTiles) {
        bindTileProgram(2); gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, visibleTiles);
      }
      return pending;
    }
    return {
      get available() { return available; },
      configure(groups: SVGGElement[]) {
        routes = groups.map(group => ({ group, line: empty(), trail: empty(), arrow: empty(), gradient: new Float32Array(4),
          anchor: [0, 0, false], halo: { radius: 0, alpha: 0 }, base: { radius: 0, alpha: 0 }, beam: [],
          arrowHalo: { radius: 0, alpha: 0 }, arrowLine: { radius: 0, alpha: 0 }, dash: [], dashOffset: 0,
          color: [0, 0, 0], start: [0, 0, 0], end: [0, 0, 0], shadow: [0, 0, 0, 0], background: [0, 0, 0],
          kind: 0, opacity: 1, text: '', font: '13px sans-serif', fontSize: 13, glyph: [0, 0, 0, 0], animations: [],
        }));
        layout = routes.map(route => ({ route, bounds: [0, 0, 0, 0], beam: [0, 0, 0, 0], x: 0, y: 0 }));
        styles();
      },
      styles,
      line(index: number, values: Float32Array, length: number) {
        const r = routes[index]; if (!r) return;
        if (length || r.line.length) dirty = true;
        r.line.values = values; r.line.length = length;
      },
      trail(index: number, values: Float32Array, length: number, x1: number, y1: number, x2: number, y2: number) {
        const r = routes[index]; if (!r) return;
        if (length || r.trail.length) dirty = true;
        r.trail.values = values; r.trail.length = length;
        r.gradient[0] = x1; r.gradient[1] = y1; r.gradient[2] = x2; r.gradient[3] = y2;
      },
      arrow(index: number, values: Float32Array, length: number) {
        const r = routes[index]; if (!r) return;
        if (length || r.arrow.length) dirty = true;
        r.arrow.values = values; r.arrow.length = length;
      },
      count(index: number, x: number, y: number, visible: boolean) {
        const r = routes[index]; if (!r) return;
        if (r.anchor[0] !== x || r.anchor[1] !== y || r.anchor[2] !== visible) dirty = true;
        r.anchor[0] = x; r.anchor[1] = y; r.anchor[2] = visible;
      },
      resize(width: number, height: number) {
        if (!(width > 0 && height > 0)) return;
        const w = Math.max(1, Math.round(width * devicePixelRatio)), h = Math.max(1, Math.round(height * devicePixelRatio));
        if (canvas.width === w && canvas.height === h && kernelReady) return;
        canvas.width = w; canvas.height = h; scale = w / 1000;
        const sigma = 2 * scale; radius = Math.ceil(4 * sigma);
        if (2 * radius + 1 > maximum) { available = false; return; }
        const weights = new Float32Array(2 * radius + 1); let sum = 0;
        for (let i = -radius; i <= radius; i++) { const value = Math.exp(-i * i / (2 * sigma * sigma)); weights[i + radius] = value; sum += value; }
        for (let i = 0; i < weights.length; i++) weights[i] /= sum;
        gl.activeTexture(gl.TEXTURE2); sample(kernel);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, weights.length, 1, 0, gl.RED, gl.FLOAT, weights);
        try { checkAllocation(); }
        catch (error) { if (!(error instanceof RouteResourceError)) throw error; available = false; return; }
        kernelReady = true; dirty = glyphDirty = true;
      },
      draw,
      destroy,
    };
  } catch { destroy(); return null; }
}
