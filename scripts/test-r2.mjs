import { config } from "dotenv";
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

config({ path: ".env.local" });

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET_NAME?.trim();
const publicUrl = process.env.R2_PUBLIC_URL?.trim();

const missing = [
  ["R2_ACCOUNT_ID", accountId],
  ["R2_ACCESS_KEY_ID", accessKeyId],
  ["R2_SECRET_ACCESS_KEY", secretAccessKey],
  ["R2_BUCKET_NAME", bucket],
  ["R2_PUBLIC_URL", publicUrl],
].filter(([, v]) => !v);

if (missing.length) {
  console.error("Missing:", missing.map(([k]) => k).join(", "));
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const testKey = `_healthcheck/${Date.now()}.txt`;
const testBody = "ReSocial R2 ok";

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log("bucket access: OK", bucket);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testBody,
      ContentType: "text/plain",
    })
  );
  console.log("upload: OK");

  const url = `${publicUrl.replace(/\/$/, "")}/${testKey}`;
  const res = await fetch(url);
  console.log("public URL:", res.status, res.ok ? "OK" : await res.text());

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: testKey })
  );
  console.log("cleanup: OK");
} catch (e) {
  console.error("fail:", e.message ?? e);
  process.exit(1);
}
