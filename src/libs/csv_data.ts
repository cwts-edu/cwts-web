import { csvParse } from "d3-dsv";

const allCSV = import.meta.glob("/src/content/csv/**/*.csv", { as: "raw" });

async function csvData(filePath: string) {
  const key = `/src/content/csv/${filePath}.csv`;
  if (key in allCSV) {
    const content = await allCSV[key]();
    return csvParse(content);
  } else {
    throw new Error(`Unable to find file ${filePath}`);
  }
}

export default csvData;
