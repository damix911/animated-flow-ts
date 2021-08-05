import { createRand } from "../util";
import { Field, FlowLinesMesh, TimestampedVertex, WindData } from "./wind-types";

const MIN_SPEED_THRESHOLD = 0.001;
const MIN_WEIGHT_THRESHOLD = 0.001;

function smooth(data: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const horizontal = new Float32Array(data.length);

  const halfRadius = Math.round(3 * sigma);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalWeight = 0;
      let s0 = 0;
      let s1 = 0;

      for (let d = -halfRadius; d <= halfRadius; d++) {
        if (x + d < 0 || x + d >= width) {
          continue;
        }

        const weight = Math.exp(-d * d / (sigma * sigma));

        totalWeight += weight;
        s0 += weight * data[2 * (y * width + (x + d)) + 0]!;
        s1 += weight * data[2 * (y * width + (x + d)) + 1]!;
      }

      horizontal[2 * (y * width + x) + 0] = totalWeight < MIN_WEIGHT_THRESHOLD ? 0 : (s0 / totalWeight);
      horizontal[2 * (y * width + x) + 1] = totalWeight < MIN_WEIGHT_THRESHOLD ? 0 : (s1 / totalWeight);
    }
  }

  const final = new Float32Array(data.length);
  
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let totalWeight = 0;
      let s0 = 0;
      let s1 = 0;

      for (let d = -halfRadius; d <= halfRadius; d++) {
        if (y + d < 0 || y + d >= height) {
          continue;
        }

        const weight = Math.exp(-d * d / (sigma * sigma));

        totalWeight += weight;
        s0 += weight * horizontal[2 * ((y + d) * width + x) + 0]!;
        s1 += weight * horizontal[2 * ((y + d) * width + x) + 1]!;
      }

      final[2 * (y * width + x) + 0] = totalWeight < MIN_WEIGHT_THRESHOLD ? 0 : (s0 / totalWeight);
      final[2 * (y * width + x) + 1] = totalWeight < MIN_WEIGHT_THRESHOLD ? 0 : (s1 / totalWeight);
    }
  }

  return final;
}

function createWindFieldFromData(windData: WindData, smoothing: number): Field {
  const data = smooth(windData.data, windData.width, windData.height, smoothing);

  const f = (x: number, y: number): [number, number] => {
    const X = Math.round(x);
    let Y = Math.round(y);
    
    if (X < 0 || X >= windData.width) {
      return [0, 0];
    }
    
    if (Y < 0 || Y >= windData.height) {
      return [0, 0];
    }

    Y = windData.height - 1 - Y;

    return [data[2 * (Y * windData.width + X) + 0]!, data[2 * (Y * windData.width + X) + 1]!];
  };

  return f;
}

function trace(f: Field, x0: number, y0: number, segmentLength: number): TimestampedVertex[] {
  const line: TimestampedVertex[] = [];

  let t = 0;
  
  let x = x0;
  let y = y0;

  line.push({
    position: [x, y],
    time: t
  });
  
  for (let i = 0; i < 100; i++) {
    const [vx, vy] = f(x, y);
    const v = Math.sqrt(vx * vx + vy * vy);
    if (v < MIN_SPEED_THRESHOLD) {
      return line;
    }
    const dx = vx / v;
    const dy = vy / v;
    x += dx * segmentLength;
    y += dy * segmentLength;
    const dt = segmentLength / v;
    t += dt;

    line.push({
      position: [x, y],
      time: t
    });
  }

  return line;
}

function getFlowLines(f: Field, W: number, H: number, segmentLength: number): TimestampedVertex[][] {
  const lines: TimestampedVertex[][] = [];

  const rand = createRand();

  for (let i = 0; i < 4000; i++) {
    const line = trace(f, Math.round(rand() * W), Math.round(rand() * H), segmentLength);
    lines.push(line);
  }
  
  return lines;
}

export function createWindMesh(windData: WindData, smoothing: number): FlowLinesMesh {
  let vertexCount = 0;
  const vertexData: number[] = [];
  const indexData: number[] = [];

  const f = createWindFieldFromData(windData, smoothing);
  const flowLines = getFlowLines(f, windData.width, windData.height, 3);
  const rand = createRand();

  for (const line of flowLines) {
    const random = rand();
    const lastVertex = line[line.length - 1]!;
    const totalTime = lastVertex.time;

    for (let i = 1; i < line.length; i++) {
      let { position: [x0, y0], time: t0 } = line[i - 1]!;
      let { position: [x1, y1], time: t1 } = line[i]!;
      const speed = 100 /* TODO! Speed factor! */ / (t1 - t0);

      y0 = windData.height - 1 - y0;
      y1 = windData.height - 1 - y1;

      const l = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      const ex = -(y1 - y0) / l;
      const ey = (x1 - x0) / l;

      vertexData.push(
        x0, y0, ex, ey, -1, t0, totalTime, speed, random,
        x0, y0, -ex, -ey, +1, t0, totalTime, speed, random,
        x1, y1, ex, ey, -1, t1, totalTime, speed, random,
        x1, y1, -ex, -ey, +1, t1, totalTime, speed, random
      );

      indexData.push(
        vertexCount + 0,
        vertexCount + 1,
        vertexCount + 2,
        vertexCount + 1,
        vertexCount + 3,
        vertexCount + 2
      );

      vertexCount += 4;
    }
  }

  return {
    vertexData: new Float32Array(vertexData),
    indexData: new Uint32Array(indexData)
  };
}