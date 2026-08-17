import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";

import { StorageService } from "./storage.service";

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadRoot = path.join(process.cwd(), "uploads");

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    this.logger.log(`Uploading file "${file.originalname}" to folder "${folder}"`);
    const uploadDir = path.join(this.uploadRoot, folder);

    // Make sure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const filename = `${uuid()}-${file.originalname}`;

    const filePath = path.join(uploadDir, filename);

    // Write buffer to disk
    await fs.writeFile(filePath, file.buffer);

    const relativeUrl = `/uploads/${folder}/${filename}`;
    this.logger.log(`File successfully saved to "${relativeUrl}"`);
    return relativeUrl;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    this.logger.log(`Deleting file: ${fileUrl}`);
    const relativePath = fileUrl.replace(/^\/uploads\//, "");

    const filePath = path.join(this.uploadRoot, relativePath);

    try {
      await fs.unlink(filePath);
      this.logger.log(`File successfully deleted from disk: ${filePath}`);
    } catch (error: any) {
      // File already doesn't exist
      if (error.code !== "ENOENT") {
        this.logger.error(`Error deleting file "${filePath}": ${error.message}`);
        throw error;
      }
    }
  }
}
