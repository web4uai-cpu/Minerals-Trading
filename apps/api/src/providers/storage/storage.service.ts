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
  private client: Minio.Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT');
    const url = new URL(endpoint);

    this.client = new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 9000),
      useSSL: url.protocol === 'https:',
      accessKey: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
      secretKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
    });

    this.bucket = this.config.get<string>('S3_BUCKET', 'khanij-documents');
  }

  async onModuleInit(): Promise<void> {
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
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  /** Delete an object from storage. */
  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  /** Check if an object exists. */
  async objectExists(key: string): Promise<boolean> {
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
