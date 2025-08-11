import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand,
HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
const s3 = new S3Client({
region: process.env.WASABI_REGION,
endpoint: process.env.WASABI_ENDPOINT,
credentials: {
accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY
},
forcePathStyle: true
});
const BUCKET = process.env.WASABI_BUCKET;
const SIGN_TTL = parseInt(process.env.SIGN_URL_EXPIRES_SECONDS || '3600',
10);
export async function listPrefixes(prefix = '') {
const cmd = new ListObjectsV2Command({ Bucket: BUCKET, Delimiter: '/',
Prefix: prefix });
const data = await s3.send(cmd);
return (data.CommonPrefixes || []).map(p => p.Prefix);
}
export async function listObjects({ prefix = '', token = undefined, maxKeys
= 1000 }) {
const cmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix,
ContinuationToken: token, MaxKeys: maxKeys });
const data = await s3.send(cmd);
return data;
}
export async function headObject(key) {
return s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
}
export function isAudio(key = '') {
return /\.(mp3|m4a|wav|flac|ogg)$/i.test(key);
}
export async function signedGetUrl(key) {
return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key:
key }), { expiresIn: SIGN_TTL });
}
export async function putJson(key, json) {
const Body = Buffer.from(JSON.stringify(json, null, 2));
await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body,
ContentType: 'application/json' }));
}
export async function getJson(key) {
const { GetObjectCommand } = await import('@aws-sdk/client-s3');
const data = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key:
key }));
const body = await data.Body.transformToString();
return JSON.parse(body || '{}');
}
export { BUCKET };
