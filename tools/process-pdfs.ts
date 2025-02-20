import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.join('public', 'docs', 'newsletter');
const HEIGHT = 528;

function getMediaBox(pdfFile: string): string {
    try {
        const result = execSync(`pdfinfo "${pdfFile}" -box`, { encoding: 'utf-8' });
        const mediaBoxLine = result.split('\n').find(line => line.includes('MediaBox'));
        if (!mediaBoxLine) throw new Error('MediaBox information not found in pdfinfo output.');
        return mediaBoxLine;
    } catch (error) {
        console.error('Error retrieving MediaBox info:', error);
        process.exit(1);
    }
}

function calculateDimensions(mediaBox: string): { width: number, height: number } {
    const values = mediaBox.split(/\s+/).filter(val => /^\d+(\.\d+)?$/.test(val)).slice(-2);
    const width = parseFloat(values[0]);
    const height = parseFloat(values[1]);

    const newHeight = HEIGHT;
    const newWidth = Math.round(width * (newHeight / height));

    return { width: newWidth, height: newHeight };
}

function runPdftoppm(pdfFile: string, outputPrefix: string, newWidth: number, newHeight: number): void {
    const cmd = `pdftoppm "${pdfFile}" "${outputPrefix}" -f 1 -png -scale-to-x ${newWidth} -scale-to-y ${newHeight} -singlefile`;
    console.info(cmd);
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
        console.error('Error running pdftoppm command:', error);
        process.exit(1);
    }
}

function processPdf(pdfFile: string): void {
    const outputPrefix = pdfFile + '.cover';
    const mediaBox = getMediaBox(pdfFile);
    const { width, height } = calculateDimensions(mediaBox);

    runPdftoppm(pdfFile, outputPrefix, width, height);
}

function main() {
    const newsletterDir = DIR;

    // Read all files in the newsletter directory
    const files = fs.readdirSync(newsletterDir);

    // Filter for PDF files only
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));

    pdfFiles.forEach(pdfFile => {
        const pdfPath = path.join(newsletterDir, pdfFile);
        const outputPngPath = path.join(newsletterDir, path.parse(pdfFile).name + '.pdf.cover.png');

        // Check if the output PNG file already exists
        if (fs.existsSync(outputPngPath)) {
            console.log(`Skipping ${pdfFile}, output PNG already exists.`);
        } else {
            console.log(`Processing ${pdfFile}...`);
            processPdf(pdfPath);
        }
    });
}

main();
