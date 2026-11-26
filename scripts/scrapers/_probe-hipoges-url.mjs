import { createHipogesSession, fetchHipogesListingPage, spainSaleQuery } from "./lib/hipoges-api.mjs";

const session = await createHipogesSession();
for (const code of ["GTRE-01017", "REAR-03186", "AFRE-045101"]) {
  const data = await fetchHipogesListingPage(session, {
    page: 1,
    itemsPerPage: 1,
    query: spainSaleQuery([
      { name: "_assetInfo.propertyCode", operator: "equal", value: code },
    ]),
  });
  const row = data.result?.[0];
  if (!row) {
    console.log(code, "NOT IN API");
    continue;
  }
  console.log(
    code,
    JSON.stringify(
      {
        propertyCode: row._assetInfo?.propertyCode,
        propertyReference: row._assetInfo?.propertyReference,
        legacyId: row._assetInfo?._legacyId,
        mongoId: row._id,
        operationPortal: row._assetInfo?._operation?.operationPortal,
        operationSubType: row._assetInfo?._operation?.operationSubType,
        type: row._operation?.type,
        keys: Object.keys(row._assetInfo ?? {}),
      },
      null,
      2
    )
  );
}
