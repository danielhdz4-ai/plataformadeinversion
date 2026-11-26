import { cleanListingTitle, readablePropertyKind } from "../../apps/web/lib/listing/display-title.ts";

const cases = [
  "INTERMEDIATE_FLOOR ·  MUELAS DEL PAN, San Blas",
  "HOUSE_CHALET · Carrer Professor Barraquer, Finestrelles",
  "GROUND_FLOOR · Can Vidalet",
  "Piso · Piso en Calle Mayor 5",
  "Piso en venta en Calle Mayor",
];

for (const c of cases) {
  console.log(`${c}\n  → "${cleanListingTitle(c)}"`);
}
console.log("kind:", readablePropertyKind("INTERMEDIATE_FLOOR"), readablePropertyKind("HOUSE_CHALET"));
