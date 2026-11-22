import { describe, it, expect } from "vitest";
import { displayPhone as rawDisplay, localPhone, productInitials } from "../lib/formatters";

const displayPhone = (raw: string | null) => rawDisplay(raw)?.replace(/\u00a0/g, " ") ?? null;

describe("teléfonos", () => {
  it("muestra con +506 y guion", () => {
    expect(displayPhone("+50672379585")).toBe("+506 7237 - 9585");
    expect(displayPhone("88364879")).toBe("+506 8836 - 4879");
    expect(displayPhone("8836-4879")).toBe("+506 8836 - 4879");
  });
  it("no se parte en dos líneas", () => {
    expect(rawDisplay("88364879")).not.toContain(" ");
  });
  it("deja intactos los que no son de CR", () => {
    expect(displayPhone("+1 305 555 1234")).toBe("+1 305 555 1234");
    expect(displayPhone(null)).toBeNull();
  });
  it("localPhone quita el +506 para editar", () => {
    expect(localPhone("+50661189352")).toBe("61189352");
    expect(localPhone("61189352")).toBe("61189352");
    expect(localPhone(null)).toBe("");
  });
});

import { fmt } from "../lib/formatters";
describe("fmt", () => {
  it("enteros sin decimales y céntimos a 2", () => {
    expect(fmt(12500)).toBe("₡12,500");
    expect(fmt(125000.5)).toBe("₡125,000.50");
    expect(fmt(120000.48000000001)).toBe("₡120,000.48");
  });
});

import { cleanPhoneInput } from "../lib/formatters";
describe("cleanPhoneInput (pegar teléfonos)", () => {
  it("quita código de país, espacios y guiones", () => {
    expect(cleanPhoneInput("+506 8836-4879")).toBe("88364879");
    expect(cleanPhoneInput("(506) 8836 4879")).toBe("88364879");
    expect(cleanPhoneInput("50688364879")).toBe("88364879");
    expect(cleanPhoneInput("8836-4879")).toBe("88364879");
    expect(cleanPhoneInput("+506 8836 - 4879")).toBe("88364879");
  });
  it("deja escribir números que empiezan con 506", () => {
    expect(cleanPhoneInput("506")).toBe("506");
    expect(cleanPhoneInput("50612345")).toBe("50612345");
  });
  it("nunca pasa de 8 dígitos", () => {
    expect(cleanPhoneInput("883648791234")).toBe("88364879");
  });
});

describe("productInitials", () => {
  it("toma las dos primeras palabras sin la talla", () => {
    expect(productInitials("Salomón XT6 · Talla 43")).toBe("SX");
    expect(productInitials("barca cactus jack")).toBe("BC");
    expect(productInitials("   ")).toBe("D");
  });
});
