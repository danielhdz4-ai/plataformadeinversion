const js = await (await fetch("https://realestate.hipoges.com/main-L7MKTPHZ.js")).text();
const urls = [...js.matchAll(/https?:[^"'\\]+/g)]
  .map((m) => m[0])
  .filter((u) => /api|point|property|asset|search|cercalia|hipoges/i.test(u));
console.log([...new Set(urls)].join("\n"));
