import { csvParse } from "d3-dsv";

const allCSV = import.meta.glob("/src/data/csv/**/*.csv", { as: "raw" });

async function csvData(filePath: string) {
  const key = `/src/data/csv/${filePath}.csv`;
  if (key in allCSV) {
    const content = await allCSV[key]();
    return csvParse(content);
  } else {
    throw new Error(`Unable to find file ${filePath}`);
  }
}

export default csvData;
