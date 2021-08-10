import { createFlowMesh as createFlowMeshImpl } from "../flow/shared";

import { FlowDataWorker } from "../flow/types";

// import SpatialReference from "@arcgis/core/geometry/SpatialReference";

// self.addEventListener("message", (evt) => {
//   if (evt.data.method === "createFlowMesh") {
//     const { vertexData, indexData } = createFlowMesh(evt.data.flowData, evt.data.smoothing);
//     (self as any).postMessage(
//       {
//         method: "createFlowMesh",
//         vertexData: vertexData.buffer,
//         indexData: indexData.buffer,
//         requestId: evt.data.requestId
//       },
//       [
//         vertexData.buffer,
//         indexData.buffer
//       ]
//     )
//   }
// });

export async function createFlowMesh(data: { flowData: FlowDataWorker; smoothing: number }): Promise<{ result: { vertexData: ArrayBuffer; indexData: ArrayBuffer; }; transferList: ArrayBuffer[] }> {
  // const sr = new SpatialReference({ wkid: 4326 });
  // console.log("SR JSON", sr.toJSON());
  
  const { vertexData, indexData } = createFlowMeshImpl(
    {
      ...data.flowData,
      data: new Float32Array(data.flowData.buffer)
    },
    data.smoothing
  );

  return {
    result: {
      vertexData: vertexData.buffer,
      indexData: indexData.buffer
    },
    transferList: [vertexData.buffer, indexData.buffer]
  };
}