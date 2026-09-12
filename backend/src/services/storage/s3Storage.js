import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let s3ClientInstance = null;

export function getS3Client() {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: env.AWS_REGION,
    });
  }
  return s3ClientInstance;
}

export function setS3ClientMock(mockClient) {
  s3ClientInstance = mockClient;
}

export const s3Storage = {
  /**
   * Constructs server-side object key for room storage.
   */
  getObjectKey(roomCode, fileId) {
    const cleanRoomCode = roomCode.trim().toUpperCase();
    const cleanFileId = fileId.trim();
    return `rooms/${cleanRoomCode}/${cleanFileId}`;
  },

  /**
   * Generates a short-lived presigned PUT URL for direct browser-to-S3 upload.
   */
  async createUploadPresignedUrl({ roomCode, fileId, contentType }) {
    const s3 = getS3Client();
    const objectKey = this.getObjectKey(roomCode, fileId);

    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType || 'application/octet-stream',
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: env.UPLOAD_URL_EXPIRY_SECONDS,
    });

    return {
      uploadUrl,
      objectKey,
      expiresIn: env.UPLOAD_URL_EXPIRY_SECONDS,
    };
  },

  /**
   * Verifies an object exists in S3 using HeadObject.
   */
  async verifyObjectExists({ objectKey }) {
    const s3 = getS3Client();
    try {
      const command = new HeadObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: objectKey,
      });

      const response = await s3.send(command);
      return {
        exists: true,
        sizeBytes: response.ContentLength || 0,
        mimeType: response.ContentType,
      };
    } catch (err) {
      if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return { exists: false, sizeBytes: 0 };
      }
      logger.warn({ errMessage: err.message, objectKey }, 'S3 HeadObject verification error');
      throw err;
    }
  },

  /**
   * Generates a short-lived presigned GET URL for direct browser download from S3.
   */
  async createDownloadPresignedUrl({ objectKey, originalName, contentType }) {
    const s3 = getS3Client();
    const safeFilename = encodeURIComponent(originalName);
    const disposition = `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`;

    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: objectKey,
      ResponseContentDisposition: disposition,
      ResponseContentType: contentType || 'application/octet-stream',
    });

    const downloadUrl = await getSignedUrl(s3, command, {
      expiresIn: env.DOWNLOAD_URL_EXPIRY_SECONDS,
    });

    return {
      downloadUrl,
      expiresIn: env.DOWNLOAD_URL_EXPIRY_SECONDS,
    };
  },

  /**
   * Deletes a single object from S3.
   */
  async deleteObject({ objectKey }) {
    const s3 = getS3Client();
    try {
      const command = new DeleteObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: objectKey,
      });
      await s3.send(command);
      return { success: true };
    } catch (err) {
      if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return { success: true, missing: true };
      }
      logger.error({ errMessage: err.message, objectKey }, 'Failed to delete object from S3');
      throw err;
    }
  },

  /**
   * Deletes multiple objects from S3 in a single batch.
   */
  async deleteObjects({ objectKeys }) {
    if (!objectKeys || objectKeys.length === 0) return { success: true };
    const s3 = getS3Client();
    try {
      const command = new DeleteObjectsCommand({
        Bucket: env.S3_BUCKET_NAME,
        Delete: {
          Objects: objectKeys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      });
      await s3.send(command);
      return { success: true };
    } catch (err) {
      if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return { success: true, missing: true };
      }
      logger.error({ errMessage: err.message, objectKeys }, 'Failed to batch delete objects from S3');
      throw err;
    }
  },
};
