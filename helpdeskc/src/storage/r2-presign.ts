import { AwsClient } from "aws4fetch";

const BUCKET_NAME = "helpdeskc-attachments";
const UPLOAD_TTL_SECONDS = 300; // 5 min — short-lived, per CLAUDE.md §11
const DOWNLOAD_TTL_SECONDS = 60; // downloads are re-authorised on every request anyway

interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function client(creds: R2Credentials): AwsClient {
  return new AwsClient({ accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey });
}

function objectUrl(accountId: string, r2Key: string): URL {
  return new URL(`https://${accountId}.r2.cloudflarestorage.com/${BUCKET_NAME}/${r2Key}`);
}

/** Direct-to-R2 upload — bytes never pass through the Worker (CLAUDE.md §11). */
export async function presignUpload(creds: R2Credentials, r2Key: string, contentType: string): Promise<string> {
  const url = objectUrl(creds.accountId, r2Key);
  url.searchParams.set("X-Amz-Expires", String(UPLOAD_TTL_SECONDS));
  const signed = await client(creds).sign(
    new Request(url, { method: "PUT", headers: { "Content-Type": contentType } }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

/**
 * Downloads use short-lived signed URLs; the caller must re-authorise
 * against ticket scope on every request before calling this (CLAUDE.md
 * §11). Forces Content-Disposition: attachment on the response — never
 * inline user-supplied content.
 */
export async function presignDownload(creds: R2Credentials, r2Key: string, filename: string): Promise<string> {
  const url = objectUrl(creds.accountId, r2Key);
  url.searchParams.set("X-Amz-Expires", String(DOWNLOAD_TTL_SECONDS));
  url.searchParams.set("response-content-disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
  const signed = await client(creds).sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
  return signed.url;
}
