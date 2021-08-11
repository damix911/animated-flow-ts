/*
  Copyright 2021 Esri
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

/**
 * @module wind-es/flow/rendering
 *
 * This module...
 */

import { subclass } from "esri/core/accessorSupport/decorators";
import Extent from "esri/geometry/Extent";
import { mat4 } from "gl-matrix";
import {
  VisualizationLayerView2D
} from "../core/view";
import { defined, throwIfAborted } from "../core/util";
import { VisualizationRenderParams } from "../core/types";
import { FlowLayer } from "./layer";
import { FlowLocalResources, FlowSharedResources, FlowVisualizationStyle } from "./rendering";
import { VisualizationStyle } from "../core/rendering";

@subclass("wind-es.flow.layer.FlowLayerView2D")
export class FlowLayerView2D extends VisualizationLayerView2D<FlowSharedResources, FlowLocalResources> {
  override animate = true;

  createVisualizationStyle(): VisualizationStyle {
    // TODO: must be async
    const layer = this.layer as FlowLayer;

    return new FlowVisualizationStyle(layer.source, layer.tracer, layer.color);
  }
}
