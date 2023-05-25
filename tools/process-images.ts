import sharp from "sharp";
import fs from "fs";
import path from "path";

function isImageFile(file: string): boolean {
  const ext = path.extname(file);
  return ["jpeg", "jpg", "png", "gif"].includes(ext.slice(1));
}

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(entry);
    else if (d.isFile()) yield entry;
  }
}

async function* walkImageFiles(dir: string): AsyncGenerator<string> {
  for await (const f of walk(dir)) {
    if (isImageFile(f)) yield f;
  }
}

function logSharpOutput(file: string) {
  return (err: Error, info: sharp.OutputInfo) => {
    if (err) {
      console.error(`Error ${file}: ${err}`);
    } else {
      console.log(`Processed ${file}`);
    }
  };
}

async function convertCovers(srcDir: string, destDir: string) {
  const basedir = path.resolve(srcDir);
  for await (const f of walkImageFiles(basedir)) {
    const relpath = path.relative(basedir, f);
    const parsedPath = path.parse(relpath);
    const targetDir = path.resolve(destDir, parsedPath.dir);
    await fs.promises.mkdir(targetDir, { recursive: true });
    await sharp(f)
      .resize({
        width: 1440,
        height: 1080,
        fit: sharp.fit.cover,
        position: sharp.gravity.center,
      })
      .modulate({ brightness: 0.4, saturation: 0.4 })
      .jpeg({ quality: 80 })
      .toFile(
        path.resolve(
          destDir,
          path.format({
            ...parsedPath,
            base: "",
            ext: ".jpg",
            name: parsedPath.name + ".cover",
          })
        ),
        logSharpOutput(f)
      );
    await sharp(f)
      .resize({
        width: 600,
        height: 350,
        fit: sharp.fit.cover,
        position: sharp.gravity.center,
      })
      .jpeg({ quality: 80 })
      .toFile(
        path.resolve(
          destDir,
          path.format({
            ...parsedPath,
            base: "",
            ext: ".jpg",
            name: parsedPath.name + ".thumbnail",
          })
        ),
        logSharpOutput(f)
      );
  }
}

async function convertImages(
  srcDir: string,
  destDir: string,
  w: number,
  h: number
) {
  const basedir = path.resolve(srcDir);
  for await (const f of walkImageFiles(basedir)) {
    const relpath = path.relative(basedir, f);
    const parsedPath = path.parse(relpath);
    const targetDir = path.resolve(destDir, parsedPath.dir);
    await fs.promises.mkdir(targetDir, { recursive: true });
    await sharp(f)
      .resize({
        width: w,
        height: h,
        fit: sharp.fit.cover,
        position: sharp.gravity.center,
      })
      .jpeg({ quality: 90 })
      .toFile(
        path.resolve(
          destDir,
          path.format({
            ...parsedPath,
            base: "",
            ext: ".jpg",
            name: parsedPath.name,
          })
        ),
        logSharpOutput(f)
      );
  }
}

async function main() {
  await convertCovers("assets-original/covers", "public/images/covers");
  await convertImages("assets-original/news", "public/images/news", 400, 220);
  await convertImages(
    "assets-original/carousel",
    "public/images/carousel",
    2560,
    1067
  );
}

await main();
