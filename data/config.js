/**
 * ============================================================
 *  CONFIGURACIÓN GENERAL DEL SITIO
 * ============================================================
 *  Este es el ÚNICO archivo que necesitas tocar para cambiar
 *  datos de contacto, colores, textos de ayuda, envíos, etc.
 *  No hace falta entrar al código de las páginas.
 * ============================================================
 */

const config = {
  // --- Identidad ---
  marca: "Le Chic",
  instagram: "@LECHIC.PE",
  instagramUrl: "https://instagram.com/lechic.pe",
  telefono: "+51 985219626",
  // El número para el enlace de WhatsApp va sin espacios ni signos.
  whatsapp: "51985219626",
  moneda: "S/",

  bienvenida: {
    titulo:
      "Bienvenidos a Le Chic, donde el lujo y la accesibilidad se combinan para ofrecerte una experiencia única en fragancias y belleza.",
    subtitulo: "Nuestros valores",
    intro:
      "En Le Chic, trabajamos para ser tu primera opción en productos de alta calidad, destacándonos por:",
    valores: [
      {
        titulo: "Variedad",
        texto:
          "Contamos con una selección de fragancias alternativas de diseñador de marcas como Indian Collection, Ecorincia, Bela Spa, Saphir y Caravan.",
      },
      {
        titulo: "Exclusividad",
        texto:
          "Ofrecemos productos icónicos de Victoria's Secret, ideales para realzar tu estilo y esencia.",
      },
      {
        titulo: "Cuidado integral",
        texto:
          "Además de fragancias, te brindamos cuidado personal como protectores solares y maquillaje importado de marcas reconocidas como Samantha y Jarusa.",
      },
    ],
    cierre:
      "Descubre una amplia gama de productos diseñados para complementar tu día a día con autenticidad, calidad y estilo.",
  },

  // --- Horario de atención ---
  horario: {
    texto: "9:00 a.m. a 7:00 p.m.",
    nota: "Favor de agendar con anticipación y contemplando estos horarios.",
  },

  // --- Dinámica de compra (los pasos que ve el cliente) ---
  dinamicaCompra: [
    "Enviar captura o link del producto.",
    "Enviar cantidad del producto.",
    "Enviar comprobante de pago al teléfono indicado.",
    "Esperar que llegue el pedido.",
  ],

  // --- Métodos de pago ---
  metodosPago: [
    { nombre: "Tarjetas de crédito", icono: "tarjeta" },
    { nombre: "Transferencia", icono: "transferencia" },
    { nombre: "Yape / Plin", icono: "movil" },
    { nombre: "Efectivo", icono: "efectivo" },
  ],

  // --- Envíos ---
  envios: {
    lima: [
      "Delivery: S/ 12, peso hasta 2 kg. Pasado ese peso podría variar.",
    ],
    provincias: [
      "Shalom (envíos de lunes a sábado). Los envíos son antes de las 5 pm.",
      "Si prefieres Olva u otra agencia en el Terminal Plaza Norte, el costo adicional es de S/ 10.",
      "Recargo adicional por concepto de embalaje: S/ 3.",
    ],
  },

  // --- Políticas de compra ---
  politicas: [
    {
      titulo: "Confirmación de pedidos",
      puntos: [
        "El pedido se confirma únicamente una vez realizado el pago total o parcial (según acuerdo).",
        "Una vez confirmado, no se podrá modificar ni cancelar.",
      ],
    },
    {
      titulo: "Pagos",
      puntos: [
        "Aceptamos pagos por transferencia, Yape/Plin y otros medios digitales.",
        "Es responsabilidad de la clienta enviar el comprobante de pago para validar su pedido.",
      ],
    },
    {
      titulo: "Entregas y envíos",
      puntos: [
        "Las entregas se realizan en el punto de recojo o mediante servicio de delivery/envío (con costo adicional si aplica).",
        "Los tiempos de entrega pueden variar según la zona y disponibilidad del servicio de courier.",
      ],
    },
    {
      titulo: "Cambios y devoluciones",
      puntos: [
        "No realizamos devoluciones de dinero.",
        "Solo se aceptan cambios si el producto llega en mal estado o defectuoso, dentro de las 24 horas posteriores a la entrega (con evidencia fotográfica o en video al momento de abrir el paquete).",
        "En caso de cambio, el producto debe estar sin uso, en su empaque original y en perfectas condiciones.",
      ],
    },
    {
      titulo: "Stock",
      puntos: [
        "Todos los productos están sujetos a disponibilidad de stock.",
        "En caso excepcional de no contar con el producto ya pagado, la clienta podrá elegir entre: cambio por otro producto de igual valor, o nota de crédito para una próxima compra.",
      ],
    },
    {
      titulo: "Precios y promociones",
      puntos: [
        "Los precios publicados en el catálogo son finales y pueden variar sin previo aviso.",
        "Las promociones y descuentos tienen tiempo limitado y aplican según las condiciones detalladas.",
      ],
    },
  ],
};

module.exports = config;
