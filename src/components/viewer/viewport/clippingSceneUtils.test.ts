import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  calculateClippingSceneMetrics,
  projectClippingPlaneLabels,
} from "./clippingSceneUtils";

describe("clippingSceneUtils", () => {
  it("calculates bounded clipping scene metrics from model bounds", () => {
    const metrics = calculateClippingSceneMetrics([0, 0, 0, 20, 20, 20]);
    expect(metrics.modelSize).toBeGreaterThan(1);
    expect(metrics.minPlaneSize).toBeGreaterThan(0.25);
    expect(metrics.widgetScale).toBeGreaterThan(0.2);
    expect(metrics.gumballScale).toBeGreaterThan(0.5);
    expect(metrics.sectionEdgeOffset).toBeGreaterThan(0.0002);
    expect(metrics.labelOffset).toBeGreaterThan(0);
  });

  it("projects only visible clipping plane labels into viewport space", () => {
    const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const labels = projectClippingPlaneLabels(
      [
        {
          id: "front",
          name: "Front",
          enabled: true,
          labelVisible: true,
          origin: [0, 0, 0],
          vAxis: [0, 1, 0],
          normal: [0, 0, 1],
          height: 2,
          selected: true,
        },
        {
          id: "hidden",
          name: "Hidden",
          enabled: true,
          labelVisible: true,
          origin: [0, 0, 20],
          vAxis: [0, 1, 0],
          normal: [0, 0, 1],
          height: 2,
          selected: false,
        },
      ],
      camera,
      { width: 200, height: 100 },
      0.5,
    );

    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({
      id: "front",
      name: "Front",
      selected: true,
    });
    expect(labels[0]?.left).toBeGreaterThan(0);
    expect(labels[0]?.left).toBeLessThan(200);
    expect(labels[0]?.top).toBeGreaterThan(0);
    expect(labels[0]?.top).toBeLessThan(100);
  });
});
