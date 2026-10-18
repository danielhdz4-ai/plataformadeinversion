export type ScanOperation =
  | "buy"
  | "buy_to_rent"
  | "buy_to_rent_rooms"
  | "buy_to_rent_airbnb"
  | "sublease"
  | "sublease_rooms"
  | "flip";

export function scanOperationUsesRoi(op: string | null | undefined): boolean {
  return op != null && op !== "buy";
}

export type OperationOption = {
  id: ScanOperation;
  label: string;
  description: string;
  enabled: boolean;
};

export const SCAN_OPERATIONS: OperationOption[] = [
  {
    id: "buy",
    label: "Comprar",
    description:
      "Solo compra: todos los inmuebles en venta en la zona con precio y datos del portal — sin estimación de alquiler ni ranking por ROI.",
    enabled: true,
  },
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
    description:
      "Estima renta por habitación con comparables en alquiler cercanos. ROI sobre suma de habitaciones — más gestión.",
    enabled: true,
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
