import { Injectable } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";

import { StorageService } from "./storage.service";

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly uploadRoot = path.join(process.cwd(), "uploads");

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const uploadDir = path.join(this.uploadRoot, folder);

    // Make sure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const filename = `${uuid()}-${file.originalname}`;

    const filePath = path.join(uploadDir, filename);

    // Write buffer to disk
    await fs.writeFile(filePath, file.buffer);

    // Return URL/path used by application
    return `/uploads/${folder}/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // Convert:
    // /uploads/documents/abc-file.pdf
    //
    // into:
    // ./uploads/documents/abc-file.pdf

    const relativePath = fileUrl.replace(/^\/uploads\//, "");

    const filePath = path.join(this.uploadRoot, relativePath);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      // File already doesn't exist
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}
