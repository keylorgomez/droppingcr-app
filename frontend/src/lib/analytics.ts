import ReactGA from "react-ga4";

let initialized = false;

export function initGA() {
  const id = import.meta.env.VITE_GA_ID as string | undefined;
  if (!id) return;
  ReactGA.initialize(id);
  initialized = true;
}

export function trackPageView(path: string) {
  if (!initialized) return;
  ReactGA.send({ hitType: "pageview", page: path });
}

export function trackViewItem(item: {
  id:        string;
  name:      string;
  price:     number;
  category?: string;
}) {
  if (!initialized) return;
  ReactGA.event("view_item", {
    currency: "CRC",
    value:    item.price,
    items: [{
      item_id:       item.id,
      item_name:     item.name,
      price:         item.price,
      item_category: item.category ?? "",
    }],
  });
}
