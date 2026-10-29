import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { authenticate } from '../middleware/authenticate.js';
import { AppError } from '../appErrors/AppError.js';

export const uploadsRouter = Router();

const ALLOWED_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/ogg': '.ogv',
};

uploadsRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const { fileData, fileName, mimeType: providedMime } = req.body || {};

    if (!fileData || typeof fileData !== 'string') {
      throw new AppError('fileData (base64 or data URL) is required.', { statusCode: 400 });
    }

    let mime = providedMime;
    let base64Payload = fileData;

    // Check if it is a data URL (e.g. data:image/png;base64,... or data:video/mp4;base64,...)
    const dataUrlMatch = fileData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mime = dataUrlMatch[1].toLowerCase();
      base64Payload = dataUrlMatch[2];
    }

    if (!mime || !ALLOWED_MIME[mime]) {
      throw new AppError(`Unsupported file type. Allowed image/video types: ${Object.keys(ALLOWED_MIME).join(', ')}`, {
        statusCode: 400,
      });
    }

    const isVideo = mime.startsWith('video/');
    const maxSizeBytes = isVideo ? 60 * 1024 * 1024 : 15 * 1024 * 1024;

    const buffer = Buffer.from(base64Payload, 'base64');
    if (buffer.length > maxSizeBytes) {
      throw new AppError(`File size exceeds the ${isVideo ? '60MB' : '15MB'} limit.`, { statusCode: 400 });
    }

    const uploadsDir = join(process.cwd(), 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const ext = ALLOWED_MIME[mime] || extname(fileName || '') || (isVideo ? '.mp4' : '.jpg');
    const uniqueFileName = `${randomUUID()}${ext}`;
    const filePath = join(uploadsDir, uniqueFileName);

    await writeFile(filePath, buffer);

    const host = req.get('host') || '127.0.0.1:5000';
    const protocol = req.protocol || 'http';
    const publicUrl = `${protocol}://${host}/uploads/${uniqueFileName}`;

    res.status(201).json({
      data: {
        url: publicUrl,
        fileName: uniqueFileName,
        mimeType: mime,
        sizeBytes: buffer.length,
        mediaType: isVideo ? 'video' : 'image',
      },
    });
  } catch (err) {
    next(err);
  }
});

