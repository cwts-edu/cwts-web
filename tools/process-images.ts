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
    console.log(entry);
    if (d.isDirectory()) yield* walk(entry);
    else if (d.isFile()) yield entry;
  }
}

async function* walkImageFiles(dir: string): AsyncGenerator<string> {
  for await (const f of walk(dir)) {
    if (isImageFile(f)) yield f;
  }
}

async function convertCovers(srcDir: string, destDir: string) {
  const basedir = path.resolve(srcDir);
  for await (const f of walkImageFiles(basedir)) {
    const relpath = path.relative(basedir, f);
    const parsedPath = path.parse(relpath);
    await sharp(f)
      .resize({
        width: 1440,
        height: 1080,
        fit: sharp.fit.cover,
        position: sharp.gravity.center,
      })
      // .gamma(2.2, 1.4)
      .modulate({ brightness: 0.4, saturation: 0.4 })
      .jpeg({ quality: 60 })
      .toFile(
        path.resolve(
          destDir,
          path.format({
            ...parsedPath,
            base: "",
            ext: ".jpg",
            name: parsedPath.name + ".cover",
          })
        )
      );
    await sharp(f)
      .resize({
        width: 600,
        height: 350,
        fit: sharp.fit.cover,
        position: sharp.gravity.center,
      })
      .jpeg({ quality: 50 })
      .toFile(
        path.resolve(
          destDir,
          path.format({
            ...parsedPath,
            base: "",
            ext: ".jpg",
            name: parsedPath.name + ".thumbnail",
          })
        )
      );
  }
}

async function main() {
  await convertCovers("assets-original/covers", "public/images/covers");
}

await main();
