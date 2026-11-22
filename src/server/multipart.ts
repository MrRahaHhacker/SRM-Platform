import type { Request } from 'express';

export interface ParsedMultipartFile {
  fieldName: string;
  originalFilename: string;
  contentType: string;
  buffer: Buffer;
}

export interface ParsedMultipartForm {
  fields: Record<string, string>;
  files: Record<string, ParsedMultipartFile>;
}

export async function parseMultipartForm(req: Request, maxBytes = 12 * 1024 * 1024): Promise<ParsedMultipartForm> {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  if (!boundaryMatch) {
    throw new Error('Missing multipart boundary');
  }
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks: Buffer[] = [];
  let total = 0;

  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Uploaded payload exceeds maximum allowed size (10 MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve());
    req.on('error', (err) => reject(err));
  });

  const body = Buffer.concat(chunks);
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  const files: Record<string, ParsedMultipartFile> = {};

  let pos = body.indexOf(boundaryBuf);
  while (pos !== -1) {
    const nextPos = body.indexOf(boundaryBuf, pos + boundaryBuf.length);
    if (nextPos === -1) break;

    let part = body.subarray(pos + boundaryBuf.length, nextPos);
    if (part.subarray(0, 2).toString('utf8') === '\r\n') {
      part = part.subarray(2);
    }
    if (part.subarray(part.length - 2).toString('utf8') === '\r\n') {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString('utf8');
      const content = part.subarray(headerEnd + 4);
      const nameMatch = /name="([^"]+)"/i.exec(rawHeaders);
      const fileMatch = /filename="([^"]*)"/i.exec(rawHeaders);
      const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(rawHeaders);

      if (nameMatch?.[1]) {
        const fieldName = nameMatch[1];
        if (fileMatch && fileMatch[1] !== undefined) {
          files[fieldName] = {
            fieldName,
            originalFilename: fileMatch[1] || 'document',
            contentType: typeMatch?.[1]?.trim() || 'application/octet-stream',
            buffer: content,
          };
        } else {
          fields[fieldName] = content.toString('utf8');
        }
      }
    }
    pos = nextPos;
  }

  return { fields, files };
}
