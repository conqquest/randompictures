import express from "express";
import cors from "cors";
import { createClient } from "redis";

const app = express();

const PORT =
  Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

interface ArchiveDocument {
  identifier?: string;
  title?: string;
  year?: string | number;
  description?: string;
}

interface ArchiveFile {
  name?: string;
  size?: string | number;
}

interface ArchiveMetadata {
  files?: ArchiveFile[];
}

interface ArchiveSearchResponse {
  response?: {
    docs?: ArchiveDocument[];
  };
}

interface RandomImage {
  image: string;
  title: string;
  year: string | number | null;
  description: string | null;
  identifier: string;
  category: string;
}

const categoryQueries: Record<string, string> = {
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

/*
 * Redis / Render Key Value
 *
 * The application still works without Redis.
 * If REDIS_URL exists, Redis caching is enabled.
 */
const redisUrl =
  process.env.REDIS_URL;

const redis = redisUrl
  ? createClient({
      url: redisUrl,
    })
  : null;

if (redis) {
  redis.on(
    "error",
    (error) => {
      console.error(
        "Redis error:",
        error
      );
    }
  );

  redis
    .connect()
    .then(() => {
      console.log(
        "Redis connected"
      );
    })
    .catch((error) => {
      console.error(
        "Redis connection failed:",
        error
      );
    });
}

const CACHE_TTL = 600;

/*
 * Build a stable Redis key.
 */
const getCacheKey = (
  category: string
) =>
  `randomimages:pool:${encodeURIComponent(
    category
  )}`;

/*
 * Search Internet Archive and build
 * a reusable pool of usable images.
 */
const buildImagePool = async (
  category: string
): Promise<RandomImage[]> => {
  let query =
    "mediatype:image";

  if (category !== "all") {
    const categoryQuery =
      categoryQueries[category];

    if (categoryQuery) {
      query +=
        ` AND (${categoryQuery})`;
    } else {
      query += ` AND ${category}`;
    }
  }

  const randomPage =
    Math.floor(
      Math.random() * 20
    ) + 1;

  const searchUrl =
    "https://archive.org/advancedsearch.php" +
    `?q=${encodeURIComponent(
      query
    )}` +
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

  if (
    documents.length === 0
  ) {
    return [];
  }

  /*
   * Process several Archive items
   * simultaneously.
   */
  const shuffled =
    [...documents].sort(
      () => Math.random() - 0.5
    );

  const candidates =
    shuffled.slice(0, 12);

  const results =
    await Promise.all(
      candidates.map(
        async (document) => {
          if (
            !document.identifier
          ) {
            return null;
          }

          try {
            const metadataResponse =
              await fetch(
                `https://archive.org/metadata/${document.identifier}`
              );

            if (
              !metadataResponse.ok
            ) {
              return null;
            }

            const metadata =
              (await metadataResponse.json()) as ArchiveMetadata;

            const files =
              metadata.files ?? [];

            const imageFiles =
              files.filter(
                (file) => {
                  const name =
                    file.name?.toLowerCase() ??
                    "";

                  const isImage =
                    name.endsWith(
                      ".jpg"
                    ) ||
                    name.endsWith(
                      ".jpeg"
                    ) ||
                    name.endsWith(
                      ".png"
                    ) ||
                    name.endsWith(
                      ".webp"
                    );

                  const isThumbnail =
                    name.includes(
                      "thumb"
                    ) ||
                    name.startsWith(
                      "__"
                    );

                  return (
                    isImage &&
                    !isThumbnail
                  );
                }
              );

            if (
              imageFiles.length ===
              0
            ) {
              return null;
            }

            /*
             * Keep your requested behavior:
             * choose the largest image file.
             */
            const imageFile =
              imageFiles.sort(
                (a, b) => {
                  const sizeA =
                    Number(
                      a.size ?? 0
                    );

                  const sizeB =
                    Number(
                      b.size ?? 0
                    );

                  return (
                    sizeB - sizeA
                  );
                }
              )[0];

            if (
              !imageFile.name
            ) {
              return null;
            }

            const imageUrl =
              `https://archive.org/download/${document.identifier}/` +
              encodeURIComponent(
                imageFile.name
              );

            return {
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
            };
          } catch (error) {
            console.error(
              `Failed item ${document.identifier}:`,
              error
            );

            return null;
          }
        }
      )
    );

  return results.filter(
    (
      item
    ): item is RandomImage =>
      item !== null
  );
};

/*
 * Get an image pool.
 *
 * Redis hit:
 *     return cached pool immediately.
 *
 * Redis miss:
 *     query Internet Archive,
 *     build pool,
 *     cache it.
 */
const getImagePool = async (
  category: string
): Promise<RandomImage[]> => {
  const cacheKey =
    getCacheKey(category);

  if (
    redis &&
    redis.isReady
  ) {
    try {
      const cached =
        await redis.get(
          cacheKey
        );

      if (cached) {
        console.log(
          `Redis cache HIT: ${category}`
        );

        return JSON.parse(
          cached
        ) as RandomImage[];
      }
    } catch (error) {
      console.error(
        "Redis read error:",
        error
      );
    }
  }

  console.log(
    `Redis cache MISS: ${category}`
  );

  const pool =
    await buildImagePool(
      category
    );

  if (
    redis &&
    redis.isReady &&
    pool.length > 0
  ) {
    try {
      await redis.set(
        cacheKey,
        JSON.stringify(pool),
        {
          EX: CACHE_TTL,
        }
      );

      console.log(
        `Cached ${pool.length} images for ${category}`
      );
    } catch (error) {
      console.error(
        "Redis write error:",
        error
      );
    }
  }

  return pool;
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    redis:
      redis?.isReady === true
        ? "connected"
        : "not connected",
    message:
      "RandomPictures API is running",
  });
});

app.get(
  "/api/random",
  async (req, res) => {
    try {
      const category =
        typeof req.query.category ===
        "string"
          ? req.query.category
          : "all";

      const pool =
        await getImagePool(
          category
        );

      if (
        pool.length === 0
      ) {
        return res.status(404).json({
          error:
            `No usable images found for category: ${category}`,
        });
      }

      const randomImage =
        pool[
          Math.floor(
            Math.random() *
              pool.length
          )
        ];

      return res.json(
        randomImage
      );
    } catch (error) {
      console.error(
        "Random image error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to get random image",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});