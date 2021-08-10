/**
 * @module wind-es/apps/winds
 * 
 * An app that uses real wind data from an imagery tile layer.
 */

import EsriMap from "esri/Map";
import MapView from "esri/views/MapView";
import VectorTileLayer from "esri/layers/VectorTileLayer";
import { FlowLayer } from "../flow/layer";
import ImageryTileLayer from "esri/layers/ImageryTileLayer";
import esriConfig from "esri/config";

esriConfig.workers.loaderConfig = {
  packages: [
    {
      name: "js",
      location: location.origin + "/demos/js"
    }
  ]
};

const vectorTileLayer = new VectorTileLayer({
  url: "https://www.arcgis.com/sharing/rest/content/items/55253142ea534123882314f0d880ddab/resources/styles/root.json"
});

const url = "https://tiledimageservicesdev.arcgis.com/03e6LFX6hxm1ywlK/arcgis/rest/services/NLCAS2011_daily_wind_magdir/ImageServer";

const imageryLayer = new ImageryTileLayer({ url });

const windLayer = new FlowLayer({
  url,
  effect: "bloom(1.1, 0.3px, 0.1)",
  useWebWorkers: true
} as any);

const map = new EsriMap({
  layers: [
    vectorTileLayer,
    imageryLayer,
    windLayer
  ]
});

new MapView({
  container: "viewDiv",
  map: map,
  zoom: 4,
  center: [-98, 39]
});
