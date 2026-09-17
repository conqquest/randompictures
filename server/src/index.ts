import express from "express";
import cors from "cors";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

interface ArchiveDocument {
  identifier?: string;
  title?: string;
  year?: string | number;
  description?: string;
}

interface ArchiveSearchResponse {
  response?: {
    docs?: ArchiveDocument[];
  };
}

// ========================================
// Health Check
// ========================================

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "RandomPictures API is running",
  });
});

// ========================================
// Random Image
// ========================================

app.get("/api/random", async (req, res) => {
  try {
    // Default category is "all"
    const category =
      typeof req.query.category === "string"
        ? req.query.category
        : "all";

    // ========================================
    // Build Internet Archive Query
    // ========================================

    let query = "mediatype:image";

    if (category !== "all") {
      query += ` AND subject:"${category}"`;
    }

    // Pick random page
    const randomPage =
      Math.floor(Math.random() * 20) + 1;

    const searchUrl =
      "https://archive.org/advancedsearch.php" +
      `?q=${encodeURIComponent(query)}` +
      "&fl%5B%5D=identifier" +
      "&fl%5B%5D=title" +
      "&fl%5B%5D=year" +
      "&fl%5B%5D=description" +
      "&rows=50" +
      `&page=${randomPage}` +
      "&output=json";

    console.log(
      `Internet Archive search: ${query}`
    );

    // ========================================
    // Search Internet Archive
    // ========================================

    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(
        "Internet Archive search failed"
      );
    }

    const data =
      (await response.json()) as ArchiveSearchResponse;

    const documents =
      data.response?.docs ?? [];

    if (documents.length === 0) {
      return res.status(404).json({
        error: "No images found",
      });
    }

    // ========================================
    // Pick Random Item
    // ========================================

    const document =
      documents[
        Math.floor(
          Math.random() * documents.length
        )
      ];

    if (!document.identifier) {
      return res.status(404).json({
        error: "Image identifier not found",
      });
    }

    // ========================================
    // Get Item Metadata
    // ========================================

    const metadataResponse = await fetch(
      `https://archive.org/metadata/${document.identifier}`
    );

    if (!metadataResponse.ok) {
      throw new Error(
        "Failed to get item metadata"
      );
    }

    const metadata =
      await metadataResponse.json();

    const files = metadata.files ?? [];

    // ========================================
    // Find Image Files
    // ========================================

    const imageFiles = files.filter(
      (file: any) => {
        const name =
          file.name?.toLowerCase() ?? "";

        const isImage =
          name.endsWith(".jpg") ||
          name.endsWith(".jpeg") ||
          name.endsWith(".png") ||
          name.endsWith(".webp");

        const isThumbnail =
          name.includes("thumb") ||
          name.startsWith("__");

        return (
          isImage &&
          !isThumbnail
        );
      }
    );

    if (imageFiles.length === 0) {
      return res.status(404).json({
        error: "No usable image found",
      });
    }

    // ========================================
    // Prefer Largest Image
    // ========================================

    const imageFile =
      imageFiles.sort(
        (a: any, b: any) => {
          const sizeA =
            Number(a.size ?? 0);

          const sizeB =
            Number(b.size ?? 0);

          return sizeB - sizeA;
        }
      )[0];

    // ========================================
    // Image URL
    // ========================================

    const imageUrl =
      `https://archive.org/download/${document.identifier}/` +
      encodeURIComponent(imageFile.name);

    // ========================================
    // Response
    // ========================================

    res.json({
      image: imageUrl,
      title:
        document.title ?? "Unknown",
      year:
        document.year ?? null,
      description:
        document.description ?? null,
      identifier:
        document.identifier,
    });
  } catch (error) {
    console.error(
      "Random image error:",
      error
    );

    res.status(500).json({
      error:
        "Failed to get random image",
    });
  }
});

// ========================================
// Start Server
// ========================================

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});