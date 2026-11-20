import { describe, it, expect } from "vitest";
import { displayPhone, localPhone } from "../lib/formatters";

describe("teléfonos", () => {
  it("muestra con +506 y guion", () => {
    expect(displayPhone("+50672379585")).toBe("+506 7237 - 9585");
    expect(displayPhone("88364879")).toBe("+506 8836 - 4879");
    expect(displayPhone("8836-4879")).toBe("+506 8836 - 4879");
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
