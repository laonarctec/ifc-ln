import { describe, expect, it } from "vitest";
import {
  safeDelete,
  readIfcText,
  readIfcNumber,
  formatIfcValue,
  inferEditableValueType,
  readExpressId,
  createEditableEntry,
} from "./ifcValueUtils";

describe("safeDelete", () => {
  it("calls delete on objects that expose it", () => {
    let called = false;
    safeDelete({ delete: () => { called = true; } });
    expect(called).toBe(true);
  });

  it("does nothing for primitives", () => {
    expect(() => safeDelete(42)).not.toThrow();
    expect(() => safeDelete(null)).not.toThrow();
    expect(() => safeDelete("text")).not.toThrow();
  });
});

describe("readIfcText", () => {
  it("returns string directly", () => {
    expect(readIfcText("hello")).toBe("hello");
  });

  it("unwraps nested { value: string }", () => {
    expect(readIfcText({ value: "nested" })).toBe("nested");
  });

  it("returns null for non-string", () => {
    expect(readIfcText(42)).toBeNull();
    expect(readIfcText(null)).toBeNull();
    expect(readIfcText({ value: 42 })).toBeNull();
  });
});

describe("readIfcNumber", () => {
  it("returns number directly", () => {
    expect(readIfcNumber(3.14)).toBe(3.14);
  });

  it("unwraps nested { value: number }", () => {
    expect(readIfcNumber({ value: 99 })).toBe(99);
  });

  it("returns null for non-finite", () => {
    expect(readIfcNumber(NaN)).toBeNull();
    expect(readIfcNumber(Infinity)).toBeNull();
  });
});

describe("formatIfcValue", () => {
  it("formats null/undefined as dash", () => {
    expect(formatIfcValue(null)).toBe("-");
    expect(formatIfcValue(undefined)).toBe("-");
  });

  it("formats primitives", () => {
    expect(formatIfcValue("text")).toBe("text");
    expect(formatIfcValue(42)).toBe("42");
    expect(formatIfcValue(true)).toBe("true");
  });

  it("formats arrays with preview", () => {
    expect(formatIfcValue([1, 2])).toBe("[1, 2]");
    expect(formatIfcValue([1, 2, 3, 4, 5])).toBe("[1, 2, 3, 4, ...]");
  });

  it("formats expressID references", () => {
    expect(formatIfcValue({ expressID: 42 })).toBe("#42");
  });

  it("unwraps { value }", () => {
    expect(formatIfcValue({ value: "inner" })).toBe("inner");
  });
});

describe("inferEditableValueType", () => {
  it("detects integer", () => {
    expect(inferEditableValueType(5)).toBe("integer");
  });

  it("detects number", () => {
    expect(inferEditableValueType(3.14)).toBe("number");
  });

  it("detects string", () => {
    expect(inferEditableValueType("hello")).toBe("string");
  });

  it("detects boolean", () => {
    expect(inferEditableValueType(true)).toBe("boolean");
  });

  it("unwraps nested value", () => {
    expect(inferEditableValueType({ value: "nested" })).toBe("string");
  });

  it("returns unknown for complex objects", () => {
    expect(inferEditableValueType({ expressID: 1 })).toBe("unknown");
  });
});

describe("readExpressId", () => {
  it("reads direct number", () => {
    expect(readExpressId(42)).toBe(42);
  });

  it("reads from expressID field", () => {
    expect(readExpressId({ expressID: 100 })).toBe(100);
  });

  it("reads from value field", () => {
    expect(readExpressId({ value: 200 })).toBe(200);
  });

  it("returns null for non-matching", () => {
    expect(readExpressId("text")).toBeNull();
    expect(readExpressId(null)).toBeNull();
  });
});

describe("createEditableEntry", () => {
  it("creates editable entry with target", () => {
    const entry = createEditableEntry("Name", "Wall-01", {
      lineExpressId: 42,
      attributeName: "Name",
    });
    expect(entry.key).toBe("Name");
    expect(entry.value).toBe("Wall-01");
    expect(entry.editable).toBe(true);
    expect(entry.valueType).toBe("string");
    expect(entry.target).toEqual({ lineExpressId: 42, attributeName: "Name" });
  });

  it("creates non-editable entry without target", () => {
    const entry = createEditableEntry("Type", "IfcWall");
    expect(entry.editable).toBe(false);
    expect(entry.target).toBeUndefined();
  });

  it("marks unknown types as non-editable even with target", () => {
    const entry = createEditableEntry("Ref", { expressID: 5 }, {
      lineExpressId: 5,
      attributeName: "Ref",
    });
    expect(entry.editable).toBe(false);
  });
});
