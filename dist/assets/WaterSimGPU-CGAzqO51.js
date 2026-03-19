const _=`// water-sim.wgsl — SWE Virtual Pipes compute shader for Dam-Orama
//
// Two-pass shallow water simulation on a 512×512 grid:
//   Pass 1 (@compute fluxUpdate): pressure-driven flux between adjacent cells + CFL scaling
//   Pass 2 (@compute depthUpdate): net flux → water depth change, clamp >= 0
//
// Requirements: 3.1, 3.2

// ─── Simulation parameters (uniform) ────────────────────────────────────────

struct SimParams {
  gridSize: u32,
  dt:       f32,
  gravity:  f32,
  cellSize: f32,
};

@group(0) @binding(6) var<uniform> params: SimParams;

// ─── Storage buffers ────────────────────────────────────────────────────────

@group(0) @binding(0) var<storage, read>       terrainHeight: array<f32>;
@group(0) @binding(1) var<storage, read_write> waterDepth:    array<f32>;
@group(0) @binding(2) var<storage, read_write> fluxN:         array<f32>;
@group(0) @binding(3) var<storage, read_write> fluxS:         array<f32>;
@group(0) @binding(4) var<storage, read_write> fluxE:         array<f32>;
@group(0) @binding(5) var<storage, read_write> fluxW:         array<f32>;

// ─── Helpers ────────────────────────────────────────────────────────────────

fn idx(x: u32, y: u32) -> u32 {
  return y * params.gridSize + x;
}

fn surfaceHeight(i: u32) -> f32 {
  return terrainHeight[i] + waterDepth[i];
}

// ─── Pass 1: Flux Update ────────────────────────────────────────────────────
//
// For each cell, compute pressure-driven flux to each of the 4 neighbours.
// Then apply CFL scaling so total outflow never exceeds available water volume.
// Boundary cells (grid edges) have zero flux to the outside (closed basin).

@compute @workgroup_size(16, 16)
fn fluxUpdate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  let gs = params.gridSize;

  // Out-of-bounds guard (dispatch may overshoot)
  if (x >= gs || y >= gs) {
    return;
  }

  let i   = idx(x, y);
  let h   = surfaceHeight(i);
  let dt  = params.dt;
  let g   = params.gravity;
  let cs  = params.cellSize;

  // Pipe cross-section area and length
  let pipeArea   = cs * cs;
  let pipeLength = cs;
  let fluxFactor = dt * g * pipeArea / pipeLength;  // dt·g·A/L

  // ── North (y − 1) ──
  var fN = 0.0;
  if (y > 0u) {
    let iN = idx(x, y - 1u);
    fN = max(0.0, fluxN[i] + fluxFactor * (h - surfaceHeight(iN)));
  }

  // ── South (y + 1) ──
  var fS = 0.0;
  if (y < gs - 1u) {
    let iS = idx(x, y + 1u);
    fS = max(0.0, fluxS[i] + fluxFactor * (h - surfaceHeight(iS)));
  }

  // ── East (x + 1) ──
  var fE = 0.0;
  if (x < gs - 1u) {
    let iE = idx(x + 1u, y);
    fE = max(0.0, fluxE[i] + fluxFactor * (h - surfaceHeight(iE)));
  }

  // ── West (x − 1) ──
  var fW = 0.0;
  if (x > 0u) {
    let iW = idx(x - 1u, y);
    fW = max(0.0, fluxW[i] + fluxFactor * (h - surfaceHeight(iW)));
  }

  // ── CFL scaling ──
  // Scale all outgoing fluxes so no cell loses more water than it contains.
  let totalOut = fN + fS + fE + fW;
  if (totalOut > 0.0) {
    let cellArea = cs * cs;
    let maxOut   = waterDepth[i] * cellArea / dt;
    if (totalOut > maxOut) {
      let scale = maxOut / totalOut;
      fN *= scale;
      fS *= scale;
      fE *= scale;
      fW *= scale;
    }
  }

  // Write back
  fluxN[i] = fN;
  fluxS[i] = fS;
  fluxE[i] = fE;
  fluxW[i] = fW;
}

// ─── Pass 2: Depth Update ───────────────────────────────────────────────────
//
// For each cell, compute net flux (inflow from neighbours − outflow from self)
// and update water depth accordingly. Clamp to >= 0.

@compute @workgroup_size(16, 16)
fn depthUpdate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  let gs = params.gridSize;

  if (x >= gs || y >= gs) {
    return;
  }

  let i  = idx(x, y);
  let dt = params.dt;
  let cs = params.cellSize;
  let cellArea = cs * cs;

  // Outflow from this cell
  let outflow = fluxN[i] + fluxS[i] + fluxE[i] + fluxW[i];

  // Inflow from neighbours' opposing fluxes
  var inflow = 0.0;

  // North neighbour (y − 1) sends its south flux into us
  if (y > 0u) {
    inflow += fluxS[idx(x, y - 1u)];
  }
  // South neighbour (y + 1) sends its north flux into us
  if (y < gs - 1u) {
    inflow += fluxN[idx(x, y + 1u)];
  }
  // West neighbour (x − 1) sends its east flux into us
  if (x > 0u) {
    inflow += fluxE[idx(x - 1u, y)];
  }
  // East neighbour (x + 1) sends its west flux into us
  if (x < gs - 1u) {
    inflow += fluxW[idx(x + 1u, y)];
  }

  // Update depth and clamp
  let newDepth = waterDepth[i] + (inflow - outflow) * dt / cellArea;
  waterDepth[i] = max(0.0, newDepth);
}
`;let h=4;const g=Math.ceil(512/16);let e=null,d=null,l=null,m=null,w=null,S=null,y=null,E=null,o=null,b=null,G=null,U=null,c=null,a=null,p=[],x=!1;function P(n,t){return t*512+n}async function I(n){const t=await navigator.gpu.requestAdapter();if(!t)throw new Error("WebGPU adapter not available");e=await t.requestDevice(),n&&n.terrainHeight?c=n.terrainHeight:c=new Float32Array(262144),n&&n.waterDepth?a=n.waterDepth:a=new Float32Array(262144),p=[];const u=262144*4;d=e.createBuffer({size:u,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),l=e.createBuffer({size:u,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),m=e.createBuffer({size:u,usage:GPUBufferUsage.STORAGE}),w=e.createBuffer({size:u,usage:GPUBufferUsage.STORAGE}),S=e.createBuffer({size:u,usage:GPUBufferUsage.STORAGE}),y=e.createBuffer({size:u,usage:GPUBufferUsage.STORAGE}),E=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),o=e.createBuffer({size:u,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const i=e.createShaderModule({code:_});b=e.createComputePipeline({layout:"auto",compute:{module:i,entryPoint:"fluxUpdate"}}),G=e.createComputePipeline({layout:"auto",compute:{module:i,entryPoint:"depthUpdate"}}),U=e.createBindGroup({layout:b.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:d}},{binding:1,resource:{buffer:l}},{binding:2,resource:{buffer:m}},{binding:3,resource:{buffer:w}},{binding:4,resource:{buffer:S}},{binding:5,resource:{buffer:y}},{binding:6,resource:{buffer:E}}]}),e.queue.writeBuffer(d,0,c),e.queue.writeBuffer(l,0,a),x=!0}async function O(n){if(!x||!e||n<=0)return;for(const f of p){const s=Math.floor(f.x),r=Math.floor(f.y);s>=0&&s<512&&r>=0&&r<512&&(a[P(s,r)]+=f.rate*n)}e.queue.writeBuffer(l,0,a),e.queue.writeBuffer(d,0,c);const t=n/h,u=new ArrayBuffer(16),i=new DataView(u);for(let f=0;f<h;f++){i.setUint32(0,512,!0),i.setFloat32(4,t,!0),i.setFloat32(8,9.81,!0),i.setFloat32(12,.03125,!0),e.queue.writeBuffer(E,0,u);const s=e.createCommandEncoder(),r=s.beginComputePass();r.setPipeline(b),r.setBindGroup(0,U),r.dispatchWorkgroups(g,g),r.setPipeline(G),r.setBindGroup(0,U),r.dispatchWorkgroups(g,g),r.end(),e.queue.submit([s.finish()])}const B=e.createCommandEncoder();B.copyBufferToBuffer(l,0,o,0,262144*4),e.queue.submit([B.finish()]),await o.mapAsync(GPUMapMode.READ);const D=o.getMappedRange();a.set(new Float32Array(D)),o.unmap()}function v(n,t){return n<0||n>=512||t<0||t>=512||!x?0:a[P(n,t)]}function C(n,t){p.push({x:n.x,y:n.y,rate:t})}function R(){return 512}function A(){return a}function L(){return c}function W(){p=[]}function N(n){h=Math.max(1,Math.floor(n))}function T(){if(!x||!e)return;a.fill(0),p=[],e.queue.writeBuffer(l,0,a);const n=new Float32Array(262144);e.queue.writeBuffer(m,0,n),e.queue.writeBuffer(w,0,n),e.queue.writeBuffer(S,0,n),e.queue.writeBuffer(y,0,n)}export{C as addSource,W as clearSources,R as getGridSize,L as getTerrainHeightArray,v as getWaterDepth,A as getWaterDepthArray,I as init,T as reset,N as setSubsteps,O as step};
