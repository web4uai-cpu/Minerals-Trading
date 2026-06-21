import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

/**
 * S3/MinIO storage service — wraps the MinIO client for presigned URL
 * generation and basic object operations.
 *
 * Uses MinIO in dev (docker-compose), S3-compatible in production.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client | null = null;
  private readonly bucket: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');

    this.bucket = this.config.get<string>('S3_BUCKET', 'khanij-documents');
    this.enabled = !!(endpoint && accessKey && secretKey);

    if (this.enabled) {
      const url = new URL(endpoint!);
      this.client = new Minio.Client({
        endPoint: url.hostname,
        port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 9000),
        useSSL: url.protocol === 'https:',
        accessKey: accessKey!,
        secretKey: secretKey!,
      });
    } else {
      this.logger.warn('S3 not configured (S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY missing) — file uploads disabled');
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) return;
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(
          this.bucket,
          this.config.get<string>('S3_REGION', 'ap-south-1'),
        );
        this.logger.log(`Created bucket: ${this.bucket}`);
      }
      this.logger.log(`Storage connected — bucket: ${this.bucket}`);
    } catch (error) {
      this.logger.warn(
        `Storage init warning (MinIO may not be running): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate a presigned URL for uploading a file directly from the client.
   * Default expiry: 15 minutes.
   */
  async generatePresignedUploadUrl(
    key: string,
    expirySeconds = 900,
  ): Promise<string> {
    if (!this.client) throw new Error('Storage not configured — set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY');
    return this.client.presignedPutObject(this.bucket, key, expirySeconds);
  }

  /**
   * Generate a presigned URL for downloading a file.
   * Default expiry: 1 hour.
   */
  async generatePresignedDownloadUrl(
    key: string,
    expirySeconds = 3600,
  ): Promise<string> {
    if (!this.client) throw new Error('Storage not configured');
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  /** Delete an object from storage. */
  async deleteObject(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.removeObject(this.bucket, key);
  }

  /** Check if an object exists. */
  async objectExists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  /** Get the bucket name for reference. */
  getBucket(): string {
    return this.bucket;
  }
}
