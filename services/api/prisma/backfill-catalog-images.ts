/**
 * One-time backfill: attach a real photo to every seeded category and
 * product that doesn't have one yet. Run via:
 *   pnpm --filter @shri-anandam/api exec ts-node --project prisma/tsconfig.seed.json prisma/backfill-catalog-images.ts
 *
 * Images are freely-licensed stock photos from Wikimedia Commons —
 * clearly a temporary stand-in for real product photography, not this
 * business's actual menu items. Uses Wikimedia's thumbnail endpoint
 * (raw full-resolution originals get rate-limited — see
 * https://www.mediawiki.org/wiki/Common_thumbnail_sizes for the fixed
 * set of widths it accepts).
 *
 * Idempotent and non-destructive by construction: a category is only
 * touched if `imageUrl` is currently null, and a product only if it
 * currently has zero ProductImage rows — an admin's real uploaded photo
 * is never overwritten by re-running this.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const UA = "ShriAnandamCatalogSeed/1.0 (one-time internal catalog image backfill)";

const CATEGORY_IMAGES: Record<string, string> = {
  snacks: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Samosas%2C_snack_food_at_Wikipedia%27s_16th_Birthday_celebration_in_Chittagong_%2801%29.jpg/960px-Samosas%2C_snack_food_at_Wikipedia%27s_16th_Birthday_celebration_in_Chittagong_%2801%29.jpg',
  sweets: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Kaju_katli_sweet.jpg/960px-Kaju_katli_sweet.jpg",
  namkeen: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Shop_selling_Bikaneri_bhujia_in_Jaipur.jpg/960px-Shop_selling_Bikaneri_bhujia_in_Jaipur.jpg",
  momos: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/960px-Momo_nepal.jpg",
  starters: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Paneer_tikka.jpg/960px-Paneer_tikka.jpg",
  chaat: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Dahi_puri%2C_Doi_phuchka.jpg/960px-Dahi_puri%2C_Doi_phuchka.jpg",
  "north-indian": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Punjabi_style_Dal_Makhani.jpg/960px-Punjabi_style_Dal_Makhani.jpg",
  "rice-biryani": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg/960px-%22Hyderabadi_Dum_Biryani%22.jpg',
  breads: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Annapurna_Naan.jpg/960px-Annapurna_Naan.jpg",
  "thali-combos": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Vegetarian_Curry.jpeg/960px-Vegetarian_Curry.jpeg",
  drinks: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Salt_lassi.jpg/960px-Salt_lassi.jpg",
  desserts: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/960px-Gulab-jamun-wallpaper-1.jpg",
  bakery: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Korb_mit_Br%C3%B6tchen.JPG/960px-Korb_mit_Br%C3%B6tchen.JPG",
  "combos-special-offers": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Vegetarian_Curry.jpeg/960px-Vegetarian_Curry.jpeg",
  "gift-packs": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Kaju_katli_sweet.jpg/960px-Kaju_katli_sweet.jpg",
};

const PRODUCT_IMAGES: Record<string, string> = {
  "veg-momos": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/960px-Momo_nepal.jpg",
  rasgulla: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Rasgulla.jpg/960px-Rasgulla.jpg",
};

function s3Client() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "ap-south-1";
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY must be set — same requirement as S3UploadService.");
  }
  return { client: new S3Client({ region, endpoint, credentials: { accessKeyId, secretAccessKey } }), bucket, region };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAndUpload(url: string, s3: ReturnType<typeof s3Client>): Promise<string> {
  // Wikimedia rate-limits rapid-fire requests even to its own thumbnail
  // endpoint — a fixed pause between calls (this function is only ever
  // called in sequence, never concurrently, below) keeps this under
  // that threshold instead of racing it per-item retry logic.
  await sleep(4000);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const key = `products/${randomUUID()}.jpg`;
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: buffer, ContentType: "image/jpeg" }));
  return `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${key}`;
}

async function main() {
  const s3 = s3Client();

  for (const [slug, sourceUrl] of Object.entries(CATEGORY_IMAGES)) {
    const category = await prisma.category.findUnique({ where: { slug } });
    if (!category) {
      console.log(`skip category "${slug}": no such category`);
      continue;
    }
    if (category.imageUrl) {
      console.log(`skip category "${slug}": already has an image`);
      continue;
    }
    const url = await fetchAndUpload(sourceUrl, s3);
    await prisma.category.update({ where: { id: category.id }, data: { imageUrl: url } });
    console.log(`category "${slug}" -> ${url}`);
  }

  for (const [slug, sourceUrl] of Object.entries(PRODUCT_IMAGES)) {
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) {
      console.log(`skip product "${slug}": no such product`);
      continue;
    }
    const existingCount = await prisma.productImage.count({ where: { productId: product.id } });
    if (existingCount > 0) {
      console.log(`skip product "${slug}": already has ${existingCount} image(s)`);
      continue;
    }
    const url = await fetchAndUpload(sourceUrl, s3);
    await prisma.productImage.create({ data: { productId: product.id, url, sortOrder: 0 } });
    console.log(`product "${slug}" -> ${url}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
