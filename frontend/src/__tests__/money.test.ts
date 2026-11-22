import { describe, it, expect } from "vitest";
import { payoutAllowance, PAYOUT_SHARE } from "../config/finance";
import { discountedPrice } from "../lib/formatters";
import { periodRange, previousRange } from "../services/analyticsService";

// Los cálculos de dinero son donde un error duele más: se reparte plata real
// con base en estos números.

describe("payoutAllowance", () => {
  it("permite el 60% de la utilidad menos lo ya repartido", () => {
    expect(PAYOUT_SHARE).toBe(0.6);
    expect(payoutAllowance(1_000_000, 200_000, 900_000)).toEqual({ rule: 400_000, allowed: 400_000 });
  });

  it("nunca permite más de lo que hay en caja", () => {
    expect(payoutAllowance(1_000_000, 0, 250_000).allowed).toBe(250_000);
  });

  it("si ya se pasaron del 60%, la regla es negativa y no se permite nada", () => {
    const r = payoutAllowance(2_895_881, 1_773_000, 784_691);
    expect(r.rule).toBeLessThan(0);
    expect(r.allowed).toBe(0);
  });

  it("con caja negativa no permite nada", () => {
    expect(payoutAllowance(1_000_000, 0, -50_000).allowed).toBe(0);
  });
});

describe("discountedPrice", () => {
  it("sin descuento devuelve el precio de lista", () => {
    expect(discountedPrice(27_000, 0)).toBe(27_000);
  });
  it("redondea a colones enteros", () => {
    expect(discountedPrice(27_000, 35)).toBe(17_550);
    expect(discountedPrice(19_999, 15)).toBe(16_999);
  });
});

describe("periodos", () => {
  const now = new Date(2026, 10, 12, 15, 30); // 12 nov 2026

  it("este mes va del día 1 hasta hoy", () => {
    const r = periodRange("month", now);
    expect(r.from).toEqual(new Date(2026, 10, 1));
    expect(r.to).toBeNull();
  });

  it("mes pasado es [1 oct, 1 nov)", () => {
    expect(periodRange("last_month", now)).toEqual({ from: new Date(2026, 9, 1), to: new Date(2026, 10, 1) });
  });

  it("este mes se compara contra el mismo tramo del mes pasado", () => {
    expect(previousRange("month", now)).toEqual({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 13) });
  });

  it("30 días incluye hoy y se compara con los 30 anteriores", () => {
    const cur = periodRange("30d", now);
    const prev = previousRange("30d", now)!;
    expect(cur.from).toEqual(new Date(2026, 9, 14));
    expect(prev.to).toEqual(cur.from);
    expect(prev.from).toEqual(new Date(2026, 8, 14));
  });

  it("enero: el mes pasado es diciembre del año anterior", () => {
    expect(periodRange("last_month", new Date(2027, 0, 5))).toEqual({
      from: new Date(2026, 11, 1), to: new Date(2027, 0, 1),
    });
  });

  it("todo no tiene periodo anterior", () => {
    expect(previousRange("all", now)).toBeNull();
  });
});

import { shippingQuote, EMPTY_SHIPPING } from "../lib/shippingQuote";
import { sizeKind } from "../lib/sizes";
import { SHIPPING_RATES } from "../config/shipping";

describe("envío en el carrito", () => {
  it("sin distrito no hay cotización", () => {
    expect(shippingQuote({ ...EMPTY_SHIPPING, province: "Alajuela", canton: "Grecia" })).toBeNull();
  });
  it("Grecia es entrega personal gratis", () => {
    expect(shippingQuote({ province: "Alajuela", canton: "Grecia", district: "Tacares", carrier: null })?.cost).toBe(0);
  });
  it("fuera del GAM por Correos cobra la tarifa de fuera del GAM", () => {
    const q = shippingQuote({ province: "Guanacaste", canton: "Liberia", district: "Liberia", carrier: null });
    expect(q?.cost).toBe(SHIPPING_RATES.CORREOS_FUERA_GAM);
  });
});

describe("guía de tallas", () => {
  it("detecta calzado, ropa y talla única", () => {
    // Números sueltos chicos no son calzado (un balón es talla 5); el calzado
    // se guarda siempre con EUR.
    expect(sizeKind(["5"])).toBeNull();
    expect(sizeKind(["S", "M", "XL"])).toBe("clothing");
    expect(sizeKind(["Única"])).toBeNull();
    expect(sizeKind(["30", "32", "34"])).toBeNull(); // pantalones, no calzado
    expect(sizeKind(["41.5 EUR", "42 EUR / 9 US", "US 7.5 / EUR 40.5"])).toBe("shoes");
    expect(sizeKind(["42", "43"])).toBe("shoes");
    expect(sizeKind([])).toBeNull();
  });
});

import { toCsv } from "../services/analyticsService";

describe("CSV", () => {
  it("escapa comas, comillas y saltos, y lleva BOM para Excel", () => {
    const csv = toCsv([["Nombre", "Nota"], ['Juan, "JJ"', "línea\nnueva"], [null, 5]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Juan, ""JJ"""');
    expect(csv).toContain('"línea\nnueva"');
    expect(csv.endsWith(",5")).toBe(true);
  });
});

import { cleanAmount, displayAmount } from "../lib/money";

describe("montos en formularios", () => {
  it("muestra separador de miles", () => {
    expect(displayAmount("12500")).toBe("12,500");
    expect(displayAmount("1234567.5")).toBe("1,234,567.5");
    expect(displayAmount("")).toBe("");
    expect(displayAmount("0.")).toBe("0.");
  });

  it("limpia lo que se escribe o pega", () => {
    expect(cleanAmount("12,500")).toBe("12500");
    expect(cleanAmount("₡ 18,500.50")).toBe("18500.50");
    expect(cleanAmount("1,25")).toBe("125");          // borrar un cero no lo vuelve decimal
    expect(cleanAmount("007")).toBe("7");
    expect(cleanAmount(".5")).toBe("0.5");
    expect(cleanAmount("10.555")).toBe("10.55");
    expect(cleanAmount("1.2.3")).toBe("1.23");
    expect(cleanAmount("12.5", 0)).toBe("12");
  });

  it("ida y vuelta sin perder el valor", () => {
    for (const raw of ["0", "5", "1000", "18500", "917376.97", "1000000"]) {
      expect(cleanAmount(displayAmount(raw))).toBe(raw);
    }
  });
});
