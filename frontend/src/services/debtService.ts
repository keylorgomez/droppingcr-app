import { supabase } from "../lib/supabaseClient";
import { sendTransactionalEmail } from "../lib/emailService";
import { DELIVERY_STATUS, SALE_STATUS } from "../constants/domain";
import {
  getPendingSales,
  type PendingSale, type ClientDebt, type Payment,
} from "./salesService";
import { addOrderPayment } from "./ordersService";

// ── Raw Supabase row types (internal) ────────────────────────────────────

interface RawDebtOrderImage {
  image_url:     string;
  is_primary:    boolean;
  display_order: number;
}

interface RawDebtOrderRow {
  id:              string;
  guest_name:      string | null;
  guest_phone:     string | null;
  note:            string | null;
  sold_at:         string;
  shipping_cost:   number | null;
  delivery_status: string | null;
  order_items: Array<{
    id:         string;
    sale_price: number;
    quantity:   number;
    product_variants: {
      id:   string;
      size: string;
      products: {
        name:           string;
        product_images: RawDebtOrderImage[];
      } | null;
    } | null;
  }>;
  payments: Array<{
    id:      string;
    amount:  number;
    note:    string | null;
    paid_at: string;
  }>;
}

// ── Normalize phone for grouping ───────────────────────────────────────────

function normalizePhoneForDisplay(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 8 ? `+506${digits}` : digits;
}

// ── Get debts grouped by client ────────────────────────────────────────────

export async function getGroupedDebts(): Promise<ClientDebt[]> {
  const [pendingSales, ordersResult] = await Promise.all([
    getPendingSales(),
    supabase
      .from("orders")
      .select(`
        id, guest_name, guest_phone, note, sold_at,
        shipping_cost, delivery_status,
        order_items ( id, sale_price, quantity, product_variants(id, size, products(name, product_images(image_url, is_primary, display_order))) ),
        payments ( id, amount, note, paid_at )
      `)
      .eq("status", SALE_STATUS.PENDING),
  ]);

  const clientMap = new Map<string, ClientDebt>();

  for (const sale of pendingSales) {
    const groupKey = sale.guest_phone?.replace(/\D/g, "").slice(-8) || sale.guest_name || sale.id;

    if (!clientMap.has(groupKey)) {
      clientMap.set(groupKey, {
        key:         groupKey,
        guest_name:  sale.guest_name,
        guest_phone: normalizePhoneForDisplay(sale.guest_phone),
        sales:       [],
        total_sale:  0,
        total_paid:  0,
        remaining:   0,
      });
    }

    const entry = clientMap.get(groupKey)!;
    entry.sales.push(sale);
    entry.total_sale += sale.sale_price + sale.shipping_cost;
    entry.total_paid += sale.total_paid;
    entry.remaining  += sale.remaining;

    if (!entry.guest_name)  entry.guest_name  = sale.guest_name;
    if (!entry.guest_phone) entry.guest_phone = normalizePhoneForDisplay(sale.guest_phone);
  }

  for (const orderRow of (ordersResult.data ?? []) as unknown as RawDebtOrderRow[]) {
    const items        = orderRow.order_items ?? [];
    const shippingCost = orderRow.shipping_cost ?? 0;
    const itemsTotal   = items.reduce(
      (total, item) => total + item.sale_price * item.quantity, 0
    );
    const totalOwed = itemsTotal + shippingCost;
    const totalPaid = (orderRow.payments ?? []).reduce(
      (total, payment) => total + payment.amount, 0
    );

    const productLabel = items.length > 1
      ? `${items.length} productos (Pedido)`
      : `${items[0]?.product_variants?.products?.name ?? "Pedido"} (Pedido)`;

    const variantSize = items.length === 1
      ? (items[0]?.product_variants?.size ?? "—")
      : "Varios";

    const orderItems = items.map((rawItem) => {
      const rawImages = rawItem.product_variants?.products?.product_images ?? [];
      const sortedImages = [...rawImages].sort((imgA, imgB) => {
        if (imgA.is_primary !== imgB.is_primary) return imgA.is_primary ? -1 : 1;
        return imgA.display_order - imgB.display_order;
      });
      return {
        product_name: rawItem.product_variants?.products?.name ?? "Producto",
        variant_size: rawItem.product_variants?.size            ?? "—",
        quantity:     rawItem.quantity,
        sale_price:   rawItem.sale_price,
        image_url:    sortedImages[0]?.image_url ?? "",
      };
    });

    const pendingSale: PendingSale = {
      id:              orderRow.id,
      sale_price:      itemsTotal,
      shipping_cost:   shippingCost,
      guest_name:      orderRow.guest_name   ?? null,
      guest_phone:     orderRow.guest_phone  ?? null,
      note:            orderRow.note         ?? null,
      sold_at:         orderRow.sold_at,
      product_name:    productLabel,
      variant_size:    variantSize,
      variant_id:      items[0]?.product_variants?.id ?? "",
      delivery_status: orderRow.delivery_status       ?? DELIVERY_STATUS.VALIDATING,
      total_paid:      totalPaid,
      remaining:       Math.max(0, totalOwed - totalPaid),
      payments:        ((orderRow.payments ?? []) as Payment[]).sort(
        (paymentA: Payment, paymentB: Payment) =>
          new Date(paymentB.paid_at).getTime() - new Date(paymentA.paid_at).getTime()
      ),
      isOrder:    true,
      orderItems,
    };

    const groupKey = (orderRow.guest_phone as string | null)
      ?.replace(/\D/g, "").slice(-8)
      || (orderRow.guest_name as string | null)
      || orderRow.id;

    if (!clientMap.has(groupKey)) {
      clientMap.set(groupKey, {
        key:         groupKey,
        guest_name:  orderRow.guest_name  ?? null,
        guest_phone: normalizePhoneForDisplay(orderRow.guest_phone ?? null),
        sales:       [],
        total_sale:  0,
        total_paid:  0,
        remaining:   0,
      });
    }

    const entry = clientMap.get(groupKey)!;
    entry.sales.push(pendingSale);
    entry.total_sale += totalOwed;
    entry.total_paid += totalPaid;
    entry.remaining  += pendingSale.remaining;

    if (!entry.guest_name)  entry.guest_name  = orderRow.guest_name  ?? null;
    if (!entry.guest_phone) entry.guest_phone = normalizePhoneForDisplay(orderRow.guest_phone ?? null);
  }

  return [...clientMap.values()].sort(
    (debtA, debtB) => debtB.remaining - debtA.remaining
  );
}

// ── Distribute payment across client's oldest debts first ─────────────────

export async function addGeneralPayment(
  sales:      PendingSale[],
  amount:     number,
  note:       string | null,
  clientInfo: { guest_phone: string | null; guest_name: string | null; total_remaining: number },
): Promise<void> {
  const sortedByDate = [...sales].sort(
    (saleA, saleB) => new Date(saleA.sold_at).getTime() - new Date(saleB.sold_at).getTime()
  );
  let leftover = amount;

  for (const sale of sortedByDate) {
    if (leftover <= 0)       break;
    if (sale.remaining <= 0) continue;

    const amountToApply = Math.min(leftover, sale.remaining);

    if (sale.isOrder) {
      const orderTotal = sale.sale_price + sale.shipping_cost;
      await addOrderPayment(sale.id, orderTotal, amountToApply, note, true);
      leftover -= amountToApply;
      continue;
    }

    const { error: payError } = await supabase.from("payments").insert({
      sale_id: sale.id,
      amount:  amountToApply,
      note,
    });
    if (payError) throw new Error(payError.message);

    const newTotalPaid = sale.total_paid + amountToApply;
    const totalOwed    = sale.sale_price + sale.shipping_cost;

    if (newTotalPaid >= totalOwed) {
      const isApartada = sale.delivery_status === DELIVERY_STATUS.APARTADA;
      const updates: Record<string, unknown> = { status: SALE_STATUS.COMPLETED };
      if (isApartada) updates.delivery_status = DELIVERY_STATUS.CONFIRMED;

      const { error: statusError } = await supabase
        .from("sales")
        .update(updates)
        .eq("id", sale.id);
      if (statusError) throw new Error(statusError.message);

      if (isApartada && sale.variant_id) {
        await supabase
          .from("product_variants")
          .update({ is_reserved: false })
          .eq("id", sale.variant_id);
      }
    }

    leftover -= amountToApply;
  }

  if (clientInfo.guest_phone) {
    const totalOwedAll = sales.reduce(
      (total, sale) => total + sale.sale_price + sale.shipping_cost, 0
    );
    const newRemaining = Math.max(0, clientInfo.total_remaining - amount);
    sendTransactionalEmail({
      type: "payment_receipt",
      data: {
        guest_phone: clientInfo.guest_phone,
        guest_name:  clientInfo.guest_name,
        amount_paid: amount,
        total_owed:  totalOwedAll,
        remaining:   newRemaining,
        note,
      },
    });
  }
}
