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
  width?: string | number;
  height?: string | number;
  format?: string;
  source?: string;
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

/* ---------------- Redis ---------------- */

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

const getCacheKey = (
  category: string
) =>
  `randomimages:pool:${encodeURIComponent(
    category
  )}`;

/* ---------------- Helpers ---------------- */

const shuffle = <T>(
  array: T[]
): T[] => {
  const result = [...array];

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
};

/* ---------------- Internet Archive ---------------- */

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
      Math.random() * 50
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
   * Shuffle Archive results so that
   * the same first result isn't always
   * selected.
   */
  const shuffled =
    shuffle(documents);

  /*
   * Get metadata for several items
   * concurrently.
   */
  const candidates =
    shuffled.slice(0, 20);

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

            /*
             * Score an image file for
             * web display quality.
             */
            const scoreImageFile = (
              file: ArchiveFile
            ): number => {
              let score = 0;

              const size =
                Number(file.size ?? 0);

              const width =
                Number(
                  file.width ?? 0
                );

              const height =
                Number(
                  file.height ?? 0
                );

              const name =
                file.name?.toLowerCase() ??
                "";

              const source =
                file.source?.toLowerCase() ??
                "";

              /*
               * Width scoring.
               */
              if (width > 0) {
                if (
                  width >= 1200 &&
                  width <= 2400
                ) {
                  score += 50;

                  if (
                    width >= 1600 &&
                    width <= 2000
                  ) {
                    score += 20;
                  }
                } else if (
                  width >= 800 &&
                  width < 1200
                ) {
                  score += 30;
                } else if (
                  width > 2400 &&
                  width <= 4000
                ) {
                  score += 15;
                } else if (
                  width < 400
                ) {
                  score -= 50;
                } else if (
                  width > 5000
                ) {
                  score -= 30;
                }
              }

              /*
               * File size scoring.
               */
              if (size > 0) {
                const kb = size / 1024;
                const mb = kb / 1024;

                if (
                  kb >= 200 &&
                  kb <= 1500
                ) {
                  score += 40;

                  if (
                    kb >= 300 &&
                    kb <= 800
                  ) {
                    score += 15;
                  }
                } else if (
                  mb > 1.5 &&
                  mb <= 3
                ) {
                  score += 5;
                } else if (
                  mb > 3
                ) {
                  score -= 40;
                } else if (
                  kb < 50
                ) {
                  score -= 60;
                } else if (
                  kb < 200
                ) {
                  score -= 10;
                }
              }

              /*
               * Format scoring.
               */
              if (
                name.endsWith(
                  ".jpg"
                ) ||
                name.endsWith(
                  ".jpeg"
                )
              ) {
                score += 10;
              } else if (
                name.endsWith(
                  ".webp"
                )
              ) {
                score += 12;
              }

              /*
               * Derivative images are
               * usually web-optimized.
               */
              if (
                source.includes(
                  "derivative"
                )
              ) {
                score += 25;
              }

              return score;
            };

            /*
             * Only real image files.
             */
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
             * Select the best web-optimized
             * image instead of the largest.
             */
            const imageFile =
              imageFiles.sort(
                (a, b) =>
                  scoreImageFile(b) -
                  scoreImageFile(a)
              )[0];

            if (
              !imageFile ||
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

/* ---------------- Redis Pool ---------------- */

const getImagePool = async (
  category: string
): Promise<RandomImage[]> => {
  const cacheKey =
    getCacheKey(category);

  /*
   * Redis cache hit.
   */
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
          `Redis HIT: ${category}`
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

  /*
   * Redis cache miss.
   */
  console.log(
    `Redis MISS: ${category}`
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
        `Cached ${pool.length} images: ${category}`
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

/* ---------------- Routes ---------------- */

app.get(
  "/api/health",
  (_req, res) => {
    res.json({
      status: "ok",

      redis:
        redis?.isReady === true
          ? "connected"
          : "not connected",

      message:
        "RandomPictures API is running",
    });
  }
);

app.get(
  "/api/random",
  async (req, res) => {
    try {
      const category =
        typeof req.query.category ===
        "string"
          ? req.query.category
          : "all";

      /*
       * IDs already shown by this browser.
       *
       * Example:
       * ?exclude=A,B,C
       */
      const excludeParam =
        typeof req.query.exclude ===
        "string"
          ? req.query.exclude
          : "";

      const excludedIds =
        new Set(
          excludeParam
            .split(",")
            .map(
              (id) =>
                id.trim()
            )
            .filter(Boolean)
        );

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

      /*
       * Don't immediately repeat
       * images already shown.
       */
      let available =
        pool.filter(
          (item) =>
            !excludedIds.has(
              item.identifier
            )
        );

      /*
       * If the exclude list has become
       * larger than the current Redis
       * pool, use the pool again.
       *
       * Internet Archive is huge, so
       * this should rarely happen.
       */
      if (
        available.length === 0
      ) {
        available = pool;
      }

      /*
       * Random selection.
       */
      const randomImage =
        available[
          Math.floor(
            Math.random() *
              available.length
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