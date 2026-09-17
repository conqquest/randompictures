import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

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
// Category Search Terms
// ========================================

const categoryQueries: Record<string, string> = {
  // General
  history: "history",
  art: "art",
  photography: "photography",
  nature: "nature",
  science: "science",
  architecture: "architecture",
  maps: "maps",
  people: "people",
  animals: "animals",
  technology: "technology",
  travel: "travel",

  // India
  India: "India OR Indian",
  "Indian history":
    "India OR Indian history OR historical India",

  "Indian art":
    "India OR Indian art",

  "Indian culture":
    "India OR Indian culture",

  "Indian architecture":
    "India OR Indian architecture",

  "Indian photography":
    "India OR Indian photography",

  "Indian cities":
    "India OR Indian cities",

  "Indian villages":
    "India OR Indian villages",

  "Indian people":
    "India OR Indian people",

  "Indian festivals":
    "India OR Indian festivals",

  "Indian traditions":
    "India OR Indian traditions",

  "Indian temples":
    "India OR Indian temples",

  "Indian monuments":
    "India OR Indian monuments",

  "Indian archaeology":
    "India OR Indian archaeology",

  "Indian textiles":
    "India OR Indian textiles",

  "Indian clothing":
    "India OR Indian clothing",

  "Indian food":
    "India OR Indian food",

  "Indian agriculture":
    "India OR Indian agriculture",

  "Indian railways":
    "India OR Indian railway OR Indian railways",

  "Indian streets":
    "India OR Indian streets",

  "Indian markets":
    "India OR Indian markets",

  "Indian maps":
    "India OR Indian maps",

  "British India":
    "British India",

  "Colonial India":
    "Colonial India",

  "Mughal India":
    "Mughal India OR Mughal",

  "Ancient India":
    "Ancient India",

  "Medieval India":
    "Medieval India",

  "Indian independence":
    "Indian independence OR independence India",

  "Indian freedom movement":
    "Indian freedom movement OR Indian independence",
};

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
    const category =
      typeof req.query.category === "string"
        ? req.query.category
        : "all";

    // ========================================
    // Build Query
    // ========================================

    let query = "mediatype:image";

    if (category !== "all") {
      const categoryQuery =
        categoryQueries[category];

      if (categoryQuery) {
        query += ` AND (${categoryQuery})`;
      } else {
        // Fallback for unknown categories
        query += ` AND ${category}`;
      }
    }

    // ========================================
    // Random Page
    // ========================================

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

    const response =
      await fetch(searchUrl);

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
        error:
          `No images found for category: ${category}`,
      });
    }

    // ========================================
    // Try Multiple Items
    // ========================================

    // Shuffle documents so we don't always
    // select the same item.
    const shuffled = [...documents].sort(
      () => Math.random() - 0.5
    );

    // Try up to 10 items to find one
    // containing a real image.
    for (
      const document of shuffled.slice(0, 10)
    ) {
      if (!document.identifier) {
        continue;
      }

      try {
        // ========================================
        // Get Item Metadata
        // ========================================

        const metadataResponse =
          await fetch(
            `https://archive.org/metadata/${document.identifier}`
          );

        if (!metadataResponse.ok) {
          continue;
        }

        const metadata =
          await metadataResponse.json();

        const files =
          metadata.files ?? [];

        // ========================================
        // Find Image Files
        // ========================================

        const imageFiles =
          files.filter(
            (file: any) => {
              const name =
                file.name?.toLowerCase() ??
                "";

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
          continue;
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
        // Create Image URL
        // ========================================

        const imageUrl =
          `https://archive.org/download/${document.identifier}/` +
          encodeURIComponent(
            imageFile.name
          );

        // ========================================
        // Return Result
        // ========================================

        return res.json({
          image: imageUrl,
          title:
            document.title ??
            "Unknown",
          year:
            document.year ??
            null,
          description:
            document.description ??
            null,
          identifier:
            document.identifier,
          category,
        });
      } catch (error) {
        // If one IA item fails,
        // try another one.
        console.error(
          `Failed item ${document.identifier}:`,
          error
        );
      }
    }

    // ========================================
    // Nothing Worked
    // ========================================

    return res.status(404).json({
      error:
        "Could not find a usable image",
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
  console.log(`Server running on port ${PORT}`);
});