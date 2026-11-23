import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  adminDb,
  ROOT_DIR,
  serverDatabaseId,
} from '../lib/firebaseServer';

const SPARK_PLAN_QUOTA_MB = 1024;
const GITHUB_RECOMMENDED_LIMIT_MB = 1024;
const FIRESTORE_DOC_OVERHEAD_BYTES = 32;
const GITHUB_REPO = 'time165311-bot/checktest';

function resolveFirebaseProjectId(): string {
  try {
    const fbConfigPath = path.resolve(ROOT_DIR, 'firebase-applet-config.json');
    if (fs.existsSync(fbConfigPath)) {
      const parsed = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
      if (parsed?.projectId) return String(parsed.projectId);
    }
  } catch {
    // ignore
  }
  return process.env.FIREBASE_PROJECT_ID || '';
}

function roundKb(bytes: number): number {
  return Number((bytes / 1024).toFixed(2));
}

function roundMb(bytes: number): number {
  return Number((bytes / (1024 * 1024)).toFixed(4));
}

function calcPercentFromBytes(usedBytes: number, totalMB: number): number {
  if (!totalMB || totalMB <= 0 || usedBytes <= 0) return 0;
  const totalBytes = totalMB * 1024 * 1024;
  return Number(Math.min(100, (usedBytes / totalBytes) * 100).toFixed(4));
}

function unwrapFirestoreRestValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return String(val.stringValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('bytesValue' in val) return String(val.bytesValue);
  if ('referenceValue' in val) return String(val.referenceValue);
  if ('geoPointValue' in val) return val.geoPointValue;
  if ('arrayValue' in val) {
    const values = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return values.map(unwrapFirestoreRestValue);
  }
  if ('mapValue' in val) {
    return unwrapFirestoreRestFields(val.mapValue?.fields || {});
  }
  return val;
}

function unwrapFirestoreRestFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  if (!fields || typeof fields !== 'object') return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = unwrapFirestoreRestValue(v);
  }
  return out;
}

function computeDocBytes(docPath: string, dataObj: any): number {
  const jsonBytes = Buffer.byteLength(JSON.stringify(dataObj || {}), 'utf8');
  const pathBytes = Buffer.byteLength(docPath || '', 'utf8');
  return jsonBytes + pathBytes + FIRESTORE_DOC_OVERHEAD_BYTES;
}

let adminDbPermissionDenied = false;

function computeEmbeddedMediaStats(
  dataObj: any
): { fileCount: number; usedBytes: number } {
  if (!dataObj || typeof dataObj !== 'object') {
    return { fileCount: 0, usedBytes: 0 };
  }
  let fileCount = 0;
  let usedBytes = 0;
  for (const field of ['img', 'avatar', 'signature']) {
    const val = dataObj[field];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        fileCount += 1;
        usedBytes += Buffer.byteLength(trimmed, 'utf8');
      }
    }
  }
  return { fileCount, usedBytes };
}

async function fetchFirestoreViaAdmin(extraChannelIds: string[] = []): Promise<{
  rawBytes: number;
  docCount: number;
  embeddedMediaCount: number;
  embeddedMediaBytes: number;
}> {
  if (!adminDb || adminDbPermissionDenied) {
    throw new Error('Admin SDK unavailable');
  }

  let rawBytes = 0;
  let docCount = 0;
  let embeddedMediaCount = 0;
  let embeddedMediaBytes = 0;
  let anySucceeded = false;
  let firstError: any = null;

  let rootCollectionNames = [
    'drugs',
    'equipment',
    'channels',
    'users',
    'admins',
    'inspection_records',
    'restock_requisitions',
    'audit_logs',
    'settings',
  ];

  try {
    const cols = await adminDb.listCollections();
    const discovered = cols.map((c) => c.id).filter(Boolean);
    if (discovered.length > 0) {
      rootCollectionNames = Array.from(new Set([...discovered, ...rootCollectionNames]));
    }
  } catch (listErr: any) {
    const errText = String(listErr?.message || listErr || '');
    if (errText.includes('PERMISSION_DENIED') || listErr?.code === 7) {
      adminDbPermissionDenied = true;
      throw listErr;
    }
  }

  const channelIds = new Set<string>(['channel_master', ...extraChannelIds.filter(Boolean)]);

  for (const colName of rootCollectionNames) {
    try {
      const snap = await adminDb.collection(colName).get();
      anySucceeded = true;
      snap.forEach((docSnap) => {
        docCount += 1;
        const data = docSnap.data() || {};
        rawBytes += computeDocBytes(docSnap.ref.path, data);
        const media = computeEmbeddedMediaStats(data);
        embeddedMediaCount += media.fileCount;
        embeddedMediaBytes += media.usedBytes;
        if (colName === 'channels') {
          channelIds.add(docSnap.id);
        }
        if (colName === 'settings' && docSnap.id === 'channels' && Array.isArray(data.channels)) {
          data.channels.forEach((ch: any) => {
            if (ch?.id) channelIds.add(String(ch.id));
          });
        }
      });
    } catch (err: any) {
      if (!firstError) firstError = err;
      const errText = String(err?.message || err || '');
      if (errText.includes('PERMISSION_DENIED') || err?.code === 7) {
        adminDbPermissionDenied = true;
        break;
      }
    }
  }

  if (!anySucceeded && firstError) {
    throw firstError;
  }

  // Also check phantom channel document references that may only have subcollections
  try {
    const channelDocRefs = await adminDb.collection('channels').listDocuments();
    channelDocRefs.forEach((ref) => {
      if (ref.id) channelIds.add(ref.id);
    });
  } catch {
    // ignore
  }

  const defaultSubCollections = ['drugs', 'equipment', 'inspection_records', 'restock_requisitions'];
  for (const channelId of channelIds) {
    let subCollections = [...defaultSubCollections];
    try {
      const subCols = await adminDb.collection('channels').doc(channelId).listCollections();
      const discoveredSubs = subCols.map((c) => c.id).filter(Boolean);
      if (discoveredSubs.length > 0) {
        subCollections = Array.from(new Set([...discoveredSubs, ...defaultSubCollections]));
      }
    } catch {
      // use default subcollections
    }

    for (const subName of subCollections) {
      try {
        const subSnap = await adminDb
          .collection('channels')
          .doc(channelId)
          .collection(subName)
          .get();
        subSnap.forEach((docSnap) => {
          docCount += 1;
          const data = docSnap.data() || {};
          rawBytes += computeDocBytes(docSnap.ref.path, data);
          const media = computeEmbeddedMediaStats(data);
          embeddedMediaCount += media.fileCount;
          embeddedMediaBytes += media.usedBytes;
        });
      } catch {
        // Continue scanning
      }
    }
  }

  return { rawBytes, docCount, embeddedMediaCount, embeddedMediaBytes };
}

async function fetchFirestoreRestCollection(
  projectId: string,
  databaseId: string,
  collectionPath: string,
  idToken: string
): Promise<{
  docs: Array<{
    id: string;
    bytes: number;
    data: Record<string, any>;
    embeddedMediaCount: number;
    embeddedMediaBytes: number;
  }>;
  forbidden?: boolean;
}> {
  const docs: Array<{
    id: string;
    bytes: number;
    data: Record<string, any>;
    embeddedMediaCount: number;
    embeddedMediaBytes: number;
  }> = [];
  let pageToken = '';
  let pageLoops = 0;

  while (pageLoops < 30) {
    pageLoops += 1;
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/${collectionPath}`
    );
    url.searchParams.set('pageSize', '300');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const res = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (res.status === 403 || res.status === 401) {
      return { docs, forbidden: true };
    }
    if (!res.ok) {
      throw new Error(`Firestore REST HTTP ${res.status}`);
    }

    const payload: any = await res.json();
    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    for (const d of documents) {
      const nameStr = String(d?.name || '');
      const id = nameStr.split('/').pop() || '';
      const data = unwrapFirestoreRestFields(d?.fields || {});
      const media = computeEmbeddedMediaStats(data);
      docs.push({
        id,
        data,
        bytes: computeDocBytes(`${collectionPath}/${id}`, data),
        embeddedMediaCount: media.fileCount,
        embeddedMediaBytes: media.usedBytes,
      });
    }

    if (payload.nextPageToken) {
      pageToken = String(payload.nextPageToken);
    } else {
      break;
    }
  }

  return { docs };
}

async function fetchFirestoreViaRest(
  projectId: string,
  databaseId: string,
  idToken: string,
  extraChannelIds: string[] = []
): Promise<{
  rawBytes: number;
  docCount: number;
  embeddedMediaCount: number;
  embeddedMediaBytes: number;
}> {
  let rawBytes = 0;
  let docCount = 0;
  let embeddedMediaCount = 0;
  let embeddedMediaBytes = 0;
  const channelIds = new Set<string>(['channel_master', ...extraChannelIds.filter(Boolean)]);

  const listableCollections = [
    'drugs',
    'equipment',
    'channels',
    'users',
    'admins',
    'inspection_records',
    'restock_requisitions',
    'audit_logs',
  ];

  await Promise.all(
    listableCollections.map(async (colName) => {
      try {
        const res = await fetchFirestoreRestCollection(projectId, databaseId, colName, idToken);
        if (!res.forbidden) {
          res.docs.forEach((docItem) => {
            docCount += 1;
            rawBytes += docItem.bytes;
            embeddedMediaCount += docItem.embeddedMediaCount;
            embeddedMediaBytes += docItem.embeddedMediaBytes;
            if (colName === 'channels' && docItem.id) {
              channelIds.add(docItem.id);
            }
          });
        }
      } catch {
        // Continue scanning other collections
      }
    })
  );

  // Individual readable settings docs
  await Promise.all(
    ['app_state', 'channels', 'config'].map(async (docId) => {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/settings/${docId}`;
        const docRes = await fetch(url, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (docRes.ok) {
          const docJson: any = await docRes.json();
          if (docJson?.fields) {
            const data = unwrapFirestoreRestFields(docJson.fields);
            docCount += 1;
            rawBytes += computeDocBytes(`settings/${docId}`, data);
            const media = computeEmbeddedMediaStats(data);
            embeddedMediaCount += media.fileCount;
            embeddedMediaBytes += media.usedBytes;
            if (docId === 'channels' && Array.isArray(data.channels)) {
              data.channels.forEach((ch: any) => {
                if (ch?.id) channelIds.add(String(ch.id));
              });
            }
          }
        }
      } catch {
        // ignore missing/forbidden settings docs
      }
    })
  );

  const subCollections = ['drugs', 'equipment', 'inspection_records', 'restock_requisitions'];
  for (const channelId of channelIds) {
    await Promise.all(
      subCollections.map(async (subName) => {
        try {
          const subRes = await fetchFirestoreRestCollection(
            projectId,
            databaseId,
            `channels/${encodeURIComponent(channelId)}/${subName}`,
            idToken
          );
          if (!subRes.forbidden) {
            subRes.docs.forEach((docItem) => {
              docCount += 1;
              rawBytes += docItem.bytes;
              embeddedMediaCount += docItem.embeddedMediaCount;
              embeddedMediaBytes += docItem.embeddedMediaBytes;
            });
          }
        } catch {
          // ignore subcollection read issues
        }
      })
    );
  }

  return { rawBytes, docCount, embeddedMediaCount, embeddedMediaBytes };
}

export function createSystemRouter(): express.Router {
  const router = express.Router();

  router.get('/storage-usage', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const projectId = resolveFirebaseProjectId();
    const databaseId = serverDatabaseId || '(default)';
    const channelsParam = String(req.query.channels || '').trim();
    const extraChannelIds = channelsParam
      ? channelsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30)
      : [];

    const firebaseResult: {
      usedBytes: number;
      usedKB: number;
      usedMB: number;
      totalMB: number;
      percent: number;
      docCount: number;
      error?: string;
    } = {
      usedBytes: 0,
      usedKB: 0,
      usedMB: 0,
      totalMB: SPARK_PLAN_QUOTA_MB,
      percent: 0,
      docCount: 0,
    };

    const embeddedMediaResult: {
      usedBytes: number;
      usedKB: number;
      usedMB: number;
      fileCount: number;
    } = {
      usedBytes: 0,
      usedKB: 0,
      usedMB: 0,
      fileCount: 0,
    };

    const githubResult: {
      usedBytes: number;
      usedKB: number;
      usedMB: number;
      totalMB: number;
      percent: number;
      repoName: string;
      fetchedAt?: string;
      error?: string;
    } = {
      usedBytes: 0,
      usedKB: 0,
      usedMB: 0,
      totalMB: GITHUB_RECOMMENDED_LIMIT_MB,
      percent: 0,
      repoName: GITHUB_REPO,
    };

    const firebaseTask = (async () => {
      try {
        if (adminDb && !adminDbPermissionDenied) {
          try {
            const stats = await fetchFirestoreViaAdmin(extraChannelIds);
            const usedBytes = Math.round(stats.rawBytes);
            firebaseResult.usedBytes = usedBytes;
            firebaseResult.usedKB = roundKb(usedBytes);
            firebaseResult.usedMB = roundMb(usedBytes);
            firebaseResult.docCount = stats.docCount;
            firebaseResult.percent = calcPercentFromBytes(usedBytes, SPARK_PLAN_QUOTA_MB);

            embeddedMediaResult.usedBytes = stats.embeddedMediaBytes;
            embeddedMediaResult.usedKB = roundKb(stats.embeddedMediaBytes);
            embeddedMediaResult.usedMB = roundMb(stats.embeddedMediaBytes);
            embeddedMediaResult.fileCount = stats.embeddedMediaCount;
            return;
          } catch (adminErr: any) {
            const errText = String(adminErr?.message || adminErr || '');
            if (errText.includes('PERMISSION_DENIED') || adminErr?.code === 7) {
              adminDbPermissionDenied = true;
            }
            console.warn(
              '[StorageUsage] Admin SDK query unavailable, trying token fallback:',
              errText
            );
          }
        }

        const tokenHeader = String(req.headers['x-firebase-token'] || '').trim();
        const authHeader = String(req.headers.authorization || '');
        const bearerToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
        const idToken = tokenHeader || (bearerToken.split('.').length === 3 ? bearerToken : '');

        if (projectId && idToken) {
          const stats = await fetchFirestoreViaRest(
            projectId,
            databaseId,
            idToken,
            extraChannelIds
          );
          const usedBytes = Math.round(stats.rawBytes);
          firebaseResult.usedBytes = usedBytes;
          firebaseResult.usedKB = roundKb(usedBytes);
          firebaseResult.usedMB = roundMb(usedBytes);
          firebaseResult.docCount = stats.docCount;
          firebaseResult.percent = calcPercentFromBytes(usedBytes, SPARK_PLAN_QUOTA_MB);

          embeddedMediaResult.usedBytes = stats.embeddedMediaBytes;
          embeddedMediaResult.usedKB = roundKb(stats.embeddedMediaBytes);
          embeddedMediaResult.usedMB = roundMb(stats.embeddedMediaBytes);
          embeddedMediaResult.fileCount = stats.embeddedMediaCount;
          return;
        }

        firebaseResult.error = 'กรุณาเข้าสู่ระบบบัญชี Google เพื่อวัดขนาดฐานข้อมูล Firestore ล่าสุด';
      } catch (err: any) {
        firebaseResult.error = err?.message || 'ไม่สามารถอ่านขนาดข้อมูล Firestore ได้ในขณะนี้';
      }
    })();

    const githubTask = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      try {
        const ghHeaders: Record<string, string> = {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'anesthesia-care-storage-monitor',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        };

        const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
          cache: 'no-store',
          headers: ghHeaders,
          signal: controller.signal,
        });

        if (!ghRes.ok) {
          githubResult.error = `ไม่สามารถดึงข้อมูล GitHub API ได้ (HTTP ${ghRes.status})`;
          return;
        }

        const ghData: any = await ghRes.json();
        const sizeKb = Math.max(0, Number(ghData?.size ?? 0));
        const usedBytes = Math.round(sizeKb * 1024);
        githubResult.usedBytes = usedBytes;
        githubResult.usedKB = Number(sizeKb.toFixed(2));
        githubResult.usedMB = roundMb(usedBytes);
        githubResult.percent = calcPercentFromBytes(usedBytes, GITHUB_RECOMMENDED_LIMIT_MB);
        githubResult.repoName = String(ghData?.full_name || GITHUB_REPO);
        githubResult.fetchedAt = new Date().toISOString();
      } catch (err: any) {
        githubResult.error =
          err?.name === 'AbortError'
            ? 'เชื่อมต่อ GitHub API เกินเวลาที่กำหนด'
            : err?.message || 'ไม่สามารถดึงขนาด Repository จาก GitHub ได้';
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    await Promise.all([firebaseTask, githubTask]);

    return res.status(200).json({
      firebase: firebaseResult,
      embeddedMedia: embeddedMediaResult,
      github: githubResult,
    });
  });

  return router;
}
