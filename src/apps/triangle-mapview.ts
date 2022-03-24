/**
 * This app is a self-contained custom WebGL layer sample, intended
 * to show how this repository handles integration of WebGL rendering
 * with the `MapView`, accurate geographic positioning, and LOD support.
 * It displays a colored triangle with vertices in Memohis, Denver and
 * El Paso.
 * 
 * The rendering techniques used in this file are the same introduced
 * in another app, named `triangle-standalone.ts`, which also includes
 * detailed comments about all the invoked WebGL functions and serves
 * as a WebGL tutorial.
 */

import MapView from "esri/views/MapView";
import { mat4 } from "gl-matrix";
import EsriMap from "esri/Map";
import { property, subclass } from "esri/core/accessorSupport/decorators";
import { VisualizationLayerView2D } from "../core/view";
import { VisualizationStyle } from "../core/rendering";
import Layer from "esri/layers/Layer";
import { Pixels, Resources, VisualizationRenderParams } from "../core/types";
import { Extent } from "esri/geometry";
import Point from "esri/geometry/Point";
import * as projection from "esri/geometry/projection";

export class MyGlobalResources implements Resources {
  program: WebGLProgram | null = null;
  loc_ScreenFromLocal: WebGLUniformLocation | null = null;
  loc_ClipFromScreen: WebGLUniformLocation | null = null;

  attach(gl: WebGLRenderingContext): void {
    // Compile the shaders.
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(
      vertexShader,
      `
      attribute vec2 a_Position;
      attribute vec3 a_Color;
      uniform mat4 u_ScreenFromLocal;
      uniform mat4 u_ClipFromScreen;
      varying vec3 v_Color;
      void main(void) {
        vec4 screenPosition = u_ScreenFromLocal * vec4(a_Position, 0.0, 1.0);
        gl_Position = u_ClipFromScreen * screenPosition;
        v_Color = a_Color;
      }`
    );
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(
      fragmentShader,
      `
      precision mediump float;
      varying vec3 v_Color;
      void main(void) {
        gl_FragColor = vec4(v_Color, 1.0);
      }`
    );
    gl.compileShader(fragmentShader);

    // Link the program.
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.bindAttribLocation(program, 0, "a_Position");
    gl.bindAttribLocation(program, 1, "a_Color");
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    this.program = program;
    this.loc_ScreenFromLocal = gl.getUniformLocation(program, "u_ScreenFromLocal")!;
    this.loc_ClipFromScreen = gl.getUniformLocation(program, "u_ClipFromScreen")!;
  }

  detach(gl: WebGLRenderingContext): void {
    gl.deleteProgram(this.program);
  }
}

export class MyLocalResources implements Resources {
  vertexBuffer: WebGLBuffer | null = null;
  u_ScreenFromLocal = mat4.create();
  u_ClipFromScreen = mat4.create();

  constructor(
    private _point1: [number, number],
    private _point2: [number, number],
    private _point3: [number, number]
  ) {}

  attach(gl: WebGLRenderingContext): void {
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        this._point1[0],
        this._point1[1],
        1,
        0,
        0,
        this._point2[0],
        this._point2[1],
        0,
        1,
        0,
        this._point3[0],
        this._point3[1],
        0,
        0,
        1
      ]),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.vertexBuffer = vertexBuffer;
  }

  detach(gl: WebGLRenderingContext): void {
    gl.deleteBuffer(this.vertexBuffer);
  }
}

export class MyVisualizationStyle extends VisualizationStyle<MyGlobalResources, MyLocalResources> {
  constructor(private _point1: Point, private _point2: Point, private _point3: Point) {
    super();
  }

  override async loadGlobalResources(): Promise<MyGlobalResources> {
    return new MyGlobalResources();
  }

  override async loadLocalResources(
    extent: Extent,
    size: [Pixels, Pixels]
  ): Promise<MyLocalResources> {
    await projection.load();

    function toLocal(point: Point): [number, number] {
      const projectedPoint = projection.project(point, extent.spatialReference) as Point;
      const x = (size[0] * (projectedPoint.x - extent.xmin)) / (extent.xmax - extent.xmin);
      const y = size[1] * (1 - (projectedPoint.y - extent.ymin) / (extent.ymax - extent.ymin));
      return [x, y];
    }

    const local1 = toLocal(this._point1);
    const local2 = toLocal(this._point2);
    const local3 = toLocal(this._point3);

    return new MyLocalResources(local1, local2, local3);
  }

  override renderVisualization(
    gl: WebGLRenderingContext,
    renderParams: VisualizationRenderParams,
    globalResources: MyGlobalResources,
    localResources: MyLocalResources
  ): void {
    // Compute the `u_ScreenFromLocal` matrix. This matrix converts from local
    // pixel-like coordinates to actual screen positions. It scales, rotates and
    // translates by the amounts dictated by the render parameters.
    mat4.identity(localResources.u_ScreenFromLocal);
    mat4.translate(localResources.u_ScreenFromLocal, localResources.u_ScreenFromLocal, [
      renderParams.translation[0],
      renderParams.translation[1],
      0
    ]);
    mat4.rotateZ(localResources.u_ScreenFromLocal, localResources.u_ScreenFromLocal, renderParams.rotation);
    mat4.scale(localResources.u_ScreenFromLocal, localResources.u_ScreenFromLocal, [
      renderParams.scale,
      renderParams.scale,
      1
    ]);

    // Compute the `u_ClipFromScreen` matrix. This matrix converts from screen
    // coordinates in pixels to clip coordinates in the range [-1, +1].
    mat4.identity(localResources.u_ClipFromScreen);
    mat4.translate(localResources.u_ClipFromScreen, localResources.u_ClipFromScreen, [-1, 1, 0]);
    mat4.scale(localResources.u_ClipFromScreen, localResources.u_ClipFromScreen, [
      2 / renderParams.size[0],
      -2 / renderParams.size[1],
      1
    ]);

    // Bind the shader program and updates the uniforms.
    gl.useProgram(globalResources.program);
    gl.uniformMatrix4fv(globalResources.loc_ScreenFromLocal, false, localResources.u_ScreenFromLocal);
    gl.uniformMatrix4fv(globalResources.loc_ClipFromScreen, false, localResources.u_ClipFromScreen);

    gl.bindBuffer(gl.ARRAY_BUFFER, localResources.vertexBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);

    // Draw the triangle.
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

@subclass("my.stuff.MyCustomLayerView2D")
export class MyCustomLayerView2D extends VisualizationLayerView2D<MyGlobalResources, MyLocalResources> {
  override animate = false;

  createVisualizationStyle(): VisualizationStyle<MyGlobalResources, MyLocalResources> {
    const layer = this.layer as MyCustomLayer;

    return new MyVisualizationStyle(layer.point1, layer.point2, layer.point3);
  }
}

@subclass("my.stuff.MyCustomLayer")
export class MyCustomLayer extends Layer {
  // First point defaults to El Paso.
  @property()
  point1 = new Point({
    x: -106.485,
    y: 31.7619,
    spatialReference: { wkid: 4326 }
  });

  // Second point defaults to Memphis.
  @property()
  point2 = new Point({
    x: -90.049,
    y: 35.1495,
    spatialReference: { wkid: 4326 }
  });

  // Third point defaults to Denver.
  @property()
  point3 = new Point({
    x: -104.9903,
    y: 39.7392,
    spatialReference: { wkid: 4326 }
  });

  override createLayerView(view: any): any {
    if (view.type === "2d") {
      return new MyCustomLayerView2D({
        view,
        layer: this
      } as any);
    }
  }
}

const myCustomLayer = new MyCustomLayer();

// Create the map with the three layers defined above.
const map = new EsriMap({
  basemap: "dark-gray-vector",
  layers: [myCustomLayer]
});

// Create the map view.
new MapView({
  container: "viewDiv",
  map,
  zoom: 4,
  center: [-98, 39]
});
