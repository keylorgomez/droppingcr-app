import { describe, it, expect } from "vitest";
import {
  normalizeSizeInput, normalizeSize, sizeGroup, sizeKind, productSizeKind, duplicateSizes, compareSizes,
} from "../lib/sizes";

describe("normalizeSizeInput", () => {
  it("deja la ropa en un solo formato", () => {
    expect(normalizeSizeInput(" 2xl ")).toBe("XXL");
    expect(normalizeSizeInput("xll")).toBe("XXL");
    expect(normalizeSizeInput("xxxl")).toBe("3XL");
    expect(normalizeSizeInput("m")).toBe("M");
    expect(normalizeSizeInput("unica")).toBe("Talla Única");
  });
  it("deja el calzado como EUR primero", () => {
    expect(normalizeSizeInput("42", true)).toBe("42 EUR");
    expect(normalizeSizeInput("42.5eur")).toBe("42.5 EUR");
    expect(normalizeSizeInput("US 9 / EUR 42.5")).toBe("42.5 EUR / 9 US");
    expect(normalizeSizeInput("42 eur/9 us")).toBe("42 EUR / 9 US");
  });
  it("no toca lo que no es calzado", () => {
    expect(normalizeSizeInput("5")).toBe("5");        // balón
    expect(normalizeSizeInput("42")).toBe("42");      // sin categoría de calzado
    expect(normalizeSizeInput("30")).toBe("30");      // pantalón
  });
});

describe("filtros", () => {
  it("agrupa tallas y deja fuera la talla única", () => {
    expect(sizeGroup("XXL")).toBe("ropa");
    expect(sizeGroup("41.5 EUR")).toBe("calzado");
    expect(sizeGroup("Talla Única")).toBeNull();
    expect(sizeGroup("Ajustable")).toBeNull();
  });
  it("un balón talla 5 no es calzado", () => {
    expect(sizeKind(["5"])).toBeNull();
    expect(sizeKind(["42 EUR"])).toBe("shoes");
  });
  it("ordena de menor a mayor", () => {
    expect(["Talla Única", "42 EUR", "4XL", "XXL", "S"].sort(compareSizes))
      .toEqual(["S", "XXL", "4XL", "42 EUR", "Talla Única"]);
    expect(normalizeSize("2XL")).toBe("XXL");
    expect(normalizeSize("42.5 EUR / 9 US")).toBe("42.5 EUR");
  });
});

describe("registro", () => {
  it("elige las tallas según la categoría", () => {
    expect(productSizeKind(["tenis"])).toBe("calzado");
    expect(productSizeKind(["futbol", "tenis"])).toBe("calzado");
    expect(productSizeKind(["gorras"])).toBe("unica");
    expect(productSizeKind(["balones", "futbol"])).toBe("unica");
    expect(productSizeKind(["futbol"])).toBe("ropa");
    expect(productSizeKind([])).toBe("ropa");
  });
  it("detecta tallas repetidas aunque estén escritas distinto", () => {
    expect(duplicateSizes(["XXL", "2XL", "M"])).toEqual(["XXL"]);
    expect(duplicateSizes(["S", "M"])).toEqual([]);
    expect(duplicateSizes(["42 EUR / 9 US", "42 EUR"])).toEqual(["42 EUR"]);
  });
});
