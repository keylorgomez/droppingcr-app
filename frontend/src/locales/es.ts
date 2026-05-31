/**
 * Spanish locale — single source of truth for all UI text.
 *
 * To add a new language:
 *   1. Duplicate this file as `en.ts`
 *   2. Translate values (keep keys identical)
 *   3. In `src/lib/i18n.ts` swap the import
 */
export const es = {

  // ── Acciones comunes ───────────────────────────────────────────────────────
  actions: {
    save:           "Guardar",
    saveChanges:    "Guardar cambios",
    cancel:         "Cancelar",
    confirm:        "Confirmar",
    edit:           "Editar",
    delete:         "Eliminar",
    add:            "Agregar",
    create:         "Crear",
    update:         "Actualizar",
    close:          "Cerrar",
    register:       "Registrar",
    view:           "Ver",
    search:         "Buscar",
    loading:        "Cargando…",
    saving:         "Guardando…",
    deleting:       "Eliminando…",
    processing:     "Procesando…",
  },

  // ── Etiquetas generales ────────────────────────────────────────────────────
  labels: {
    name:           "Nombre",
    lastName:       "Apellido",
    email:          "Correo electrónico",
    phone:          "Teléfono",
    whatsapp:       "WhatsApp",
    description:    "Descripción",
    note:           "Nota",
    date:           "Fecha",
    total:          "Total",
    subtotal:       "Subtotal",
    shipping:       "Envío",
    free:           "Gratis",
    status:         "Estado",
    size:           "Talla",
    quantity:       "Cantidad",
    price:          "Precio",
    discount:       "Descuento (%)",
    available:      "Disponible",
    pending:        "Pendiente",
    optional:       "(opcional)",
    categories:     "Categorías",
    images:         "Imágenes",
  },

  // ── Mensajes toast ─────────────────────────────────────────────────────────
  toast: {
    // Éxito
    profileUpdated:             "Perfil actualizado exitosamente.",
    saleRegistered:             "Venta registrada correctamente.",
    saleRegisteredAddMore:      "Venta registrada. Agregá los demás productos.",
    orderUpdated:               "Pedido actualizado correctamente.",
    paymentRegistered:          "Pago registrado.",
    abonoRegistered:            "Abono registrado.",
    abonoRegisteredDistributed: "Abono registrado y distribuido.",
    productUpdated:             "Producto actualizado.",
    productDeleted:             "Producto eliminado.",
    expenseRegistered:          "Gasto registrado.",
    purchaseRegistered:         "Compra registrada correctamente.",
    categoryCreated:            "Categoría creada.",
    categoryUpdated:            "Categoría actualizada.",
    categoryDeleted:            "Categoría eliminada.",
    sizeDeleted:                "Talla eliminada.",
    sessionClosed:              "Sesión cerrada correctamente.",
    welcomeBack:                "¡Bienvenido de vuelta! Sesión iniciada.",
    accountCreated:             "¡Cuenta creada exitosamente! Bienvenido a Dropping CR.",
    accountCreatedConfirmEmail: "¡Cuenta creada! Revisa tu correo para confirmarla.",
    // Error
    genericError:               "Error.",
    updateError:                "Error al actualizar.",
    saveError:                  "Error al guardar.",
  },

  // ── Validación ─────────────────────────────────────────────────────────────
  validation: {
    invalidAmount:        "Ingresá un monto válido.",
    invalidPurchasePrice: "Ingresa un precio de compra válido.",
    invalidSalePrice:     "Ingresa un precio de venta válido.",
    nameRequired:         "El nombre es requerido.",
    slugRequired:         "El slug es requerido.",
    abonoMin:             "El abono debe ser mayor a 0.",
    abonoMax:             "El abono no puede superar el total.",
    trackingRequired:     "El número de guía es requerido cuando el envío es por Correos CR.",
    addAtLeastOneProduct: "Agregá al menos un producto.",
    addAtLeastOneImage:   "Agrega al menos una imagen.",
    selectAtLeastOneCategory: "Selecciona al menos una categoría.",
  },

  // ── Estados de entrega ─────────────────────────────────────────────────────
  deliveryStatus: {
    validating: "Validando",
    confirmed:  "Confirmado",
    apartada:   "Apartada",
    shipped:    "Enviado",
    delivered:  "Entregado",
    cancelled:  "Cancelado",
  },

  // ── Métodos de envío ───────────────────────────────────────────────────────
  shippingMethod: {
    personal_grecia:   "Entrega personal (Grecia)",
    mensajero_sjo:     "Mensajero — SJO / HER / ALA",
    mensajero_cartago: "Mensajero — Cartago",
    correos_gam:       "Correos CR — GAM",
    correos_fuera_gam: "Correos CR — Fuera GAM",
  },

  // ── Tallas ─────────────────────────────────────────────────────────────────
  sizes: {
    common:       ["XS", "S", "M", "L", "XL", "XXL", "Talla Única"] as const,
    clothingOrder: ["XS","S","M","L","XL","XXL","XLL","XXXL","2XL","3XL","4XL"] as const,
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  auth: {
    signIn:             "Iniciar sesión",
    signUp:             "Crear cuenta",
    emailPlaceholder:   "Correo electrónico",
    whatsappPlaceholder: "88887777",
  },

  // ── Pedidos ────────────────────────────────────────────────────────────────
  orders: {
    title:                  "Pedidos",
    newSale:                "Nueva venta",
    newOrder:               "Nuevo pedido",
    registerAbono:          "Registrar abono",
    saveAbono:              "Guardar abono",
    savingAbono:            "Guardando…",
    abonoAmountLabel:       "Monto del abono (₡)",
    trackingLabel:          "Número de guía",
    trackingPlaceholder:    "Ej: CR123456789",
    searchPlaceholder:      "Buscar por nombre, teléfono, producto…",
    noOrders:               "No hay pedidos registrados aún.",
    totalLabel:             "Total a pagar",
    shippingCostLabel:      "Costo de envío",
    tabAll:                 "Todos",
    tabPending:             "Pendientes",
    tabCompleted:           "Completados",
  },

  // ── Deudas ─────────────────────────────────────────────────────────────────
  debt: {
    title:            "Deudas",
    pendingBalance:   "Deuda pendiente",
    searchPlaceholder: "Buscar por nombre o teléfono…",
    noDebts:          "No hay deudas pendientes.",
    groupNote:        "Agrupado por cliente. Los abonos se distribuyen de la venta más antigua a la más reciente.",
  },

  // ── Pagos ──────────────────────────────────────────────────────────────────
  payments: {
    title:            "Pagos",
    registerPayment:  "Registrar pago",
    abonoReceived:    "Abono recibido",
    pendingBalance:   "Saldo pendiente",
    orderTotal:       "Total de tu pedido",
    paidOff:          "✓ Pagado completo",
    noMovements:      "Aún no hay movimientos registrados.",
    notePlaceholder:  "Ej: Pago parcial tarjeta Visa…",
  },

  // ── Gastos ─────────────────────────────────────────────────────────────────
  expenses: {
    title:            "Gastos",
    registerExpense:  "Registrar gasto",
    totalCost:        "Costo total",
    descriptionPlaceholder: "Ej: Envío proveedor Nike, Publicidad IG…",
    notePlaceholder:  "Contexto adicional…",
    noExpenses:       "No hay gastos registrados.",
  },

  // ── Abonos a admins (payouts) ──────────────────────────────────────────────
  payouts: {
    title:            "Abonos a admins",
    registerAbono:    "Registrar abono",
    saveAbono:        "Guardar abono",
    noPayouts:        "No hay abonos registrados aún.",
    amountLabel:      "Monto del abono",
    notePlaceholder:  "Ej: Salario mayo, comisión, etc.",
  },

  // ── Productos ──────────────────────────────────────────────────────────────
  products: {
    title:                  "Productos",
    newProduct:             "Nuevo producto",
    editProduct:            "Editar producto",
    createProduct:          "Crear producto",
    namePlaceholder:        "Ej: Hoodie Dropping Vintage",
    descriptionPlaceholder: "Describe el producto, materiales, fit, etc.",
    slugPlaceholder:        "hoodie-dropping-vintage",
    priceSale:              "Precio de venta",
    priceSalePlaceholder:   "Ej: 5000",
    pricePurchase:          "Precio de compra",
    sizePlaceholder:        "Ej: M, XL, Talla Única",
    noProducts:             "No hay productos disponibles.",
    viewImageDetail:        "Ver imagen en detalle",
    basicInfo:              "Información básica",
    productInfo:            "Información del producto",
  },

  // ── Categorías ─────────────────────────────────────────────────────────────
  categories: {
    title:            "Categorías",
    newCategory:      "Nueva categoría",
    namePlaceholder:  "Ej: Camisetas, Tenis, Accesorios…",
    noCategories:     "No hay categorías.",
  },

  // ── Perfil ─────────────────────────────────────────────────────────────────
  profile: {
    title:            "Mi perfil",
    myOrders:         "Mis pedidos",
    myPayments:       "Mis abonos de ganancia",
    noOrders:         "Aún no tenés pedidos registrados.",
    noPayments:       "Aún no tienes abonos registrados.",
    whatsappPlaceholder: "88887777",
    cityPlaceholder:  "Ej: San Francisco",
    provincePlaceholder: "Ej: Alvarado",
  },

  // ── Dashboard / Analytics ──────────────────────────────────────────────────
  analytics: {
    title:                  "Dashboard",
    netBalance:             "Balance neto",
    netGain:                "Ganancia neta",
    deliveryDistribution:   "Distribución por estado de entrega",
    totalSales:             "Ventas totales",
    totalExpenses:          "Gastos totales",
  },

  // ── Estados vacíos ─────────────────────────────────────────────────────────
  empty: {
    noResults:      "No hay resultados.",
    noOrders:       "No hay pedidos registrados aún.",
    noMovements:    "Aún no hay movimientos registrados.",
    noPayments:     "No hay pagos registrados.",
    noProducts:     "No hay productos disponibles.",
    noExpenses:     "No hay gastos registrados.",
  },

  // ── Búsqueda ───────────────────────────────────────────────────────────────
  search: {
    byNameOrPhone:       "Buscar por nombre o teléfono…",
    byNameOrWhatsapp:    "Buscar por nombre o WhatsApp…",
    byNamePhoneProduct:  "Buscar por nombre, teléfono, producto…",
    byProduct:           "Buscar producto…",
  },

  // ── Correos electrónicos ───────────────────────────────────────────────────
  email: {
    welcomeSubject:       "¡Bienvenido/a a Dropping CR! 🔥",
    newOrderSubject:      "¡Tu compra en Dropping CR está registrada! 📦",
    paymentReceiptSubject: "Abono registrado en Dropping CR 🧾",
    noEmailSkipped:       "no registered email for this phone",
    invalidEmailSkipped:  "invalid email address",
  },

} as const;

export type Locale = typeof es;
