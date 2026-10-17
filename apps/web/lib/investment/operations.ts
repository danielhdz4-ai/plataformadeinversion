export type ScanOperation =
  | "buy_to_rent"
  | "buy_to_rent_rooms"
  | "buy_to_rent_airbnb"
  | "sublease"
  | "sublease_rooms"
  | "flip";

export type OperationOption = {
  id: ScanOperation;
  label: string;
  description: string;
  enabled: boolean;
};

export const SCAN_OPERATIONS: OperationOption[] = [
  {
    id: "buy_to_rent",
    label: "Comprar para alquilar",
    description:
      "Compra y alquila a largo plazo. La rentabilidad viene del alquiler mensual frente al coste total de entrada — la jugada clásica buy-to-let.",
    enabled: true,
  },
  {
    id: "buy_to_rent_rooms",
    label: "Comprar para alquilar (habitaciones)",
    description: "Alquiler por habitaciones en vivienda compartida. Mayor rentabilidad bruta, más gestión.",
    enabled: false,
  },
  {
    id: "buy_to_rent_airbnb",
    label: "Comprar para alquilar (Airbnb)",
    description: "Alquiler vacacional. Requiere licencia y estacionalidad — próximamente.",
    enabled: false,
  },
  {
    id: "sublease",
    label: "Subarriendo",
    description: "Arrendar y subarrendar. Modelo avanzado — próximamente.",
    enabled: false,
  },
  {
    id: "sublease_rooms",
    label: "Subarriendo (habitaciones)",
    description: "Subarriendo por habitaciones — próximamente.",
    enabled: false,
  },
  {
    id: "flip",
    label: "Reforma y venta",
    description: "Comprar, reformar y vender. ROI por plusvalía, no por renta — próximamente.",
    enabled: false,
  },
];
