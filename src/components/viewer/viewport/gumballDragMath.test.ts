import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildAxisDragPlane,
  computeRotationAngle,
  projectAxisTranslationOffset,
  projectPlanarTranslationOffset,
  resizePlaneFromGumballHandle,
} from "./gumballDragMath";

describe("gumballDragMath", () => {
  it("builds an axis drag plane orthogonal to the dragged axis", () => {
    const origin = new THREE.Vector3(1, 2, 3);
    const axis = new THREE.Vector3(1, 0, 0);
    const plane = buildAxisDragPlane(origin, axis, new THREE.Vector3(0, 0, -1));

    expect(plane.distanceToPoint(origin)).toBeCloseTo(0, 6);
    expect(Math.abs(plane.normal.dot(axis))).toBeLessThan(1e-6);
  });

  it("projects axis and planar translation offsets onto the requested basis", () => {
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(2, 3, 4);

    expect(
      projectAxisTranslationOffset(start, end, new THREE.Vector3(1, 0, 0)),
    ).toBeCloseTo(2, 6);

    const planar = projectPlanarTranslationOffset(
      start,
      end,
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
    );
    expect(planar.offsetA).toBeCloseTo(2, 6);
    expect(planar.offsetB).toBeCloseTo(3, 6);
  });

  it("computes signed rotation angles around the given axis", () => {
    const origin = new THREE.Vector3(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1);
    const start = new THREE.Vector3(1, 0, 0);

    const positive = computeRotationAngle(
      origin,
      start,
      new THREE.Vector3(0, 1, 0),
      axis,
    );
    const negative = computeRotationAngle(
      origin,
      start,
      new THREE.Vector3(0, -1, 0),
      axis,
    );

    expect(positive).toBeCloseTo(Math.PI / 2, 6);
    expect(negative).toBeCloseTo(-Math.PI / 2, 6);
  });

  it("resizes clipping planes symmetrically from gumball resize handles", () => {
    const plane = {
      origin: new THREE.Vector3(0, 0, 0),
      normal: new THREE.Vector3(0, 0, 1),
      uAxis: new THREE.Vector3(1, 0, 0),
      vAxis: new THREE.Vector3(0, 1, 0),
      width: 2,
      height: 4,
    };

    const resizedX = resizePlaneFromGumballHandle(
      plane,
      "resize-x",
      new THREE.Vector3(3, 0, 0),
      0.5,
    );
    const resizedXY = resizePlaneFromGumballHandle(
      plane,
      "resize-xy",
      new THREE.Vector3(2, 1, 0),
      0.5,
    );

    expect(resizedX).toEqual({ width: 6, height: 4 });
    expect(resizedXY).toEqual({ width: 4, height: 2 });
  });
});
