import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { csvParse, csvFormat } from 'd3-dsv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPREADSHEET_ID = '1pMvDonk-NKsC9Ajvf651PXT50o9Z5prlQhMGcMXkLow';
const CSV_DIR = path.resolve(__dirname, '../src/content/csv/assembly');

/**
 * Downloads a specific sheet as CSV.
 * Uses the spreadsheet export URL.
 */
async function downloadSheet(sheetName: string): Promise<string> {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    
    console.log(`Downloading sheet: ${sheetName}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error(`Unauthorized (401). Please ensure the spreadsheet is set to "Anyone with the link can view" or provide credentials.`);
        }
        throw new Error(`Failed to download sheet "${sheetName}": ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Parse the CSV from Google Sheets (which quotes everything)
    const data = csvParse(text);
    
    // 1. Normalize headers and capture order
    const finalColumns: string[] = [];
    const headerMapping: Record<string, string> = {};

    if (data.columns) {
        for (const col of data.columns) {
            const trimmedCol = col.trim();
            if (trimmedCol !== '') {
                headerMapping[col] = trimmedCol;
                finalColumns.push(trimmedCol);
            }
        }
    }

    // 2. Clean up data rows
    const cleanedData = data.map(row => {
        const cleanedRow: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
            const newKey = headerMapping[key];
            if (newKey && value !== null && value !== undefined) {
                cleanedRow[newKey] = value.trim();
            }
        }
        return cleanedRow;
    });

    // Format back to CSV - d3-dsv only quotes where necessary
    return csvFormat(cleanedData, finalColumns);
}

async function syncAll() {
    try {
        if (!fs.existsSync(CSV_DIR)) {
            console.error(`Directory not found: ${CSV_DIR}`);
            process.exit(1);
        }

        const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
        
        console.log(`Found ${files.length} CSV files to sync.`);

        for (const file of files) {
            const sheetName = path.basename(file, '.csv');
            try {
                const csvContent = await downloadSheet(sheetName);
                const filePath = path.join(CSV_DIR, file);
                fs.writeFileSync(filePath, csvContent, 'utf8');
                console.log(`Successfully synced: ${file}`);
            } catch (err) {
                console.error(`Error syncing ${file}:`, err instanceof Error ? err.message : err);
            }
        }
        
        console.log('Sync completed.');
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}

syncAll();
