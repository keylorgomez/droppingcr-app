import { describe, it, expect } from "vitest";
import { fitFromName, recommendedSize, normalizeSize, isFitType } from "../lib/fitType";

describe("fitFromName", () => {
  it("lee la versión del nombre sin importar mayúsculas", () => {
    expect(fitFromName("Argentina Messi casa player")).toBe("player");
    expect(fitFromName("Brasil Raphinha casa Fan 2026")).toBe("fan");
    expect(fitFromName("MILAN retro Maldini")).toBe("retro");
  });
  it("no inventa versión si el nombre no la dice", () => {
    expect(fitFromName("Francia Visita 1998 Zidane")).toBeNull();
    expect(fitFromName("Fantasma playera")).toBeNull();
  });
});

describe("recommendedSize", () => {
  it("Player sube dos tallas", () => {
    expect(recommendedSize("M", "player")).toBe("XL");
    expect(recommendedSize("S", "player")).toBe("L");
  });
  it("Fan y Retro suben una", () => {
    expect(recommendedSize("M", "fan")).toBe("L");
    expect(recommendedSize("XL", "retro")).toBe("XXL");
  });
  it("normaliza equivalentes y avisa cuando se pasa", () => {
    expect(recommendedSize("2XL", "fan")).toBe("3XL");
    expect(recommendedSize("4XL", "fan")).toBeNull();
    expect(recommendedSize("Única", "player")).toBeNull();
    expect(normalizeSize(" xll ")).toBe("XXL");
  });
  it("valida el valor guardado", () => {
    expect(isFitType("player")).toBe(true);
    expect(isFitType("slim")).toBe(false);
  });
});
