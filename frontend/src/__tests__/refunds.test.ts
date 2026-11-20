import { describe, it, expect } from "vitest";
import { refundAmountFor } from "../lib/refunds";
import { externalSaleCashIn, isInstallmentExternalSale, type ExternalSale } from "../services/externalSalesService";

describe("refundAmountFor", () => {
  it("todo, nada y parte válida", () => {
    expect(refundAmountFor("all", "", 30000)).toBe(30000);
    expect(refundAmountFor("none", "", 30000)).toBe(0);
    expect(refundAmountFor("part", "10000", 30000)).toBe(10000);
  });
  it("parte vacía, cero o mayor/igual a lo pagado = incompleto", () => {
    expect(refundAmountFor("part", "", 30000)).toBeNull();
    expect(refundAmountFor("part", "0", 30000)).toBeNull();
    expect(refundAmountFor("part", "30000", 30000)).toBeNull();
    expect(refundAmountFor("part", "50000", 30000)).toBeNull();
    expect(refundAmountFor(null, "", 30000)).toBeNull();
  });
});

const base: ExternalSale = {
  id: "x", product_name: "P", cost_price: 10000, sale_price: 50000, note: null, created_by: null,
  sold_at: "2026-11-01", customer_id: null, guest_name: null, guest_phone: null,
  status: "completed", total_paid: 0, remaining: 0, from_special_order: false, refunded: 0, retained: 0,
};

describe("caja de ventas externas", () => {
  it("contado suma su precio; a pagos suma por sus abonos", () => {
    expect(externalSaleCashIn(base)).toBe(50000);
    expect(externalSaleCashIn({ ...base, status: "pending", total_paid: 20000, remaining: 30000 })).toBe(0);
  });
  it("cancelada de contado sigue sumando lo que entró (la devolución sale aparte)", () => {
    const sale = { ...base, status: "cancelled" as const, refunded: 50000 };
    expect(externalSaleCashIn(sale)).toBe(50000);
    expect(isInstallmentExternalSale(sale)).toBe(false);
  });
  it("cancelada a pagos sin abonos no suma nada", () => {
    const sale = { ...base, status: "cancelled" as const };
    expect(externalSaleCashIn(sale)).toBe(0);
    expect(isInstallmentExternalSale(sale)).toBe(true);
  });
  it("cancelada a pagos con abonos: lo que entró ya está en los abonos", () => {
    const sale = { ...base, status: "cancelled" as const, total_paid: 20000, refunded: 15000, retained: 5000 };
    expect(externalSaleCashIn(sale)).toBe(0);
  });
});
