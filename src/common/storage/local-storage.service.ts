import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";

import { StorageService } from "./storage.service";

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadRoot = path.resolve(process.cwd(), "uploads");

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    this.logger.log(
      `Uploading file "${file.originalname}" to folder "${folder}"`,
    );

    // Sanitize folder and filename against directory traversal attacks
    const safeFolder = path.basename(folder);
    const uploadDir = path.resolve(this.uploadRoot, safeFolder);

    // Verify upload directory is strictly within uploadRoot
    if (!uploadDir.startsWith(this.uploadRoot)) {
      throw new BadRequestException("Invalid upload folder path");
    }

    // Make sure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Sanitize filename
    const safeOriginalName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${uuid()}-${safeOriginalName}`;

    const filePath = path.join(uploadDir, filename);

    // Write buffer to disk
    await fs.writeFile(filePath, file.buffer);

    const relativeUrl = `/uploads/${safeFolder}/${filename}`;
    this.logger.log(`File successfully saved to "${relativeUrl}"`);
    return relativeUrl;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    this.logger.log(`Deleting file: ${fileUrl}`);
    const filePath = this.getFilePath(fileUrl);

    try {
      await fs.unlink(filePath);
      this.logger.log(`File successfully deleted from disk: ${filePath}`);
    } catch (error: any) {
      // File already doesn't exist
      if (error.code !== "ENOENT") {
        this.logger.error(
          `Error deleting file "${filePath}": ${error.message}`,
        );
        throw error;
      }
    }
  }

  getFilePath(fileUrl: string): string {
    const relativePath = fileUrl.replace(/^\/uploads\//, "");
    const resolvedPath = path.resolve(this.uploadRoot, relativePath);

    // Guard against directory traversal attacks
    if (!resolvedPath.startsWith(this.uploadRoot)) {
      throw new BadRequestException(
        "Invalid file path: path traversal detected",
      );
    }

    return resolvedPath;
  }
}
