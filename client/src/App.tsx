import {
  useEffect,
  useRef,
  useState,
} from "react";

import { ColorRing } from "react-loader-spinner";

import "./App.css";

interface RandomImage {
  image: string;
  title: string;
  year: string | number | null;
  description: string | null;
  identifier: string;
  category?: string;
}

interface PreparedImage {
  data: RandomImage;
  element: HTMLImageElement;
  loaded: boolean;
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const categories = {
  general: [
    "all",
    "history",
    "art",
    "photography",
    "nature",
    "science",
    "architecture",
    "maps",
    "people",
    "animals",
    "technology",
    "travel",
  ],

  india: [
    "India",
    "Indian history",
    "Indian art",
    "Indian culture",
    "Indian architecture",
    "Indian photography",
    "Indian cities",
    "Indian villages",
    "Indian people",
    "Indian festivals",
    "Indian traditions",
    "Indian temples",
    "Indian monuments",
    "Indian archaeology",
    "Indian textiles",
    "Indian clothing",
    "Indian food",
    "Indian agriculture",
    "Indian railways",
    "Indian streets",
    "Indian markets",
    "Indian maps",
    "British India",
    "Colonial India",
    "Mughal India",
    "Ancient India",
    "Medieval India",
    "Indian independence",
    "Indian freedom movement",
  ],
};

function App() {
  const [image, setImage] =
    useState<RandomImage | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [category, setCategory] =
    useState("all");

  const [showMenu, setShowMenu] =
    useState(false);

  const [showInfo, setShowInfo] =
    useState(false);

  const [waitingForNext, setWaitingForNext] =
    useState(false);

  /*
   * Queue of prepared images (max 3).
   */
  const queueRef =
    useRef<PreparedImage[]>([]);

  /*
   * Number of images currently
   * being fetched/downloaded.
   */
  const activeDownloadsRef =
    useRef(0);

  const MAX_QUEUE = 3;

  /*
   * Prevent React StrictMode from
   * starting the initial request twice.
   */
  const initializedRef =
    useRef(false);

  /*
   * IDs already shown during this
   * browser session.
   */
  const seenIdsRef =
    useRef<Set<string>>(
      new Set()
    );

  const categoryRef =
    useRef("all");

  /* ---------------- API ---------------- */

  const fetchRandomImage =
    async (
      selectedCategory: string
    ): Promise<RandomImage> => {
      const seenIds =
        Array.from(
          seenIdsRef.current
        );

      const params =
        new URLSearchParams();

      if (
        selectedCategory !==
        "all"
      ) {
        params.set(
          "category",
          selectedCategory
        );
      }

      /*
       * Only send the most recent IDs.
       *
       * This prevents immediate/recent
       * repeats without creating a huge URL.
       */
      if (
        seenIds.length > 0
      ) {
        params.set(
          "exclude",
          seenIds
            .slice(-15)
            .join(",")
        );
      }

      const query =
        params.toString();

      const url =
        query.length > 0
          ? `${API_URL}/api/random?${query}`
          : `${API_URL}/api/random`;

      const response =
        await fetch(url, {
          cache: "no-store",
        });

      if (!response.ok) {
        throw new Error(
          "Failed to fetch image"
        );
      }

      return response.json();
    };

  /* ---------------- Browser image loading ---------------- */

  const downloadImage =
    (
      data: RandomImage,
      priority:
        | "high"
        | "low"
        | "auto"
    ): Promise<HTMLImageElement> => {
      return new Promise(
        (
          resolve,
          reject
        ) => {
          const img =
            new Image();

          img.decoding = "async";
          img.fetchPriority =
            priority;

          img.onload =
            async () => {
              try {
                if (
                  "decode" in img
                ) {
                  await img.decode();
                }
              } catch {
                // Already loaded.
              }

              resolve(img);
            };

          img.onerror =
            () => {
              reject(
                new Error(
                  "Image download failed"
                )
              );
            };

          img.src =
            data.image;
        }
      );
    };

  /* ---------------- Queue Fill ---------------- */

  const fillQueue = (
    selectedCategory: string
  ) => {
    const fill = async () => {
      /*
       * Don't exceed max queue size
       * or max concurrent downloads.
       */
      const totalPending =
        queueRef.current.length +
        activeDownloadsRef.current;

      if (
        totalPending >= MAX_QUEUE
      ) {
        return;
      }

      /*
       * How many slots to fill.
       */
      const slotsToFill =
        MAX_QUEUE - totalPending;

      for (
        let i = 0;
        i < slotsToFill;
        i++
      ) {
        activeDownloadsRef.current += 1;

        (async () => {
          try {
            const data =
              await fetchRandomImage(
                selectedCategory
              );

            /*
             * Category changed while
             * fetching.
             */
            if (
              categoryRef.current !==
              selectedCategory
            ) {
              return;
            }

            const img =
              new Image();

            img.decoding = "async";
            img.fetchPriority =
              "low";

            const prepared: PreparedImage =
              {
                data,
                element: img,
                loaded: false,
              };

            await new Promise<void>(
              (
                resolve,
                reject
              ) => {
                img.onload =
                  async () => {
                    try {
                      if (
                        "decode" in img
                      ) {
                        await img.decode();
                      }
                    } catch {
                      // Already loaded.
                    }

                    prepared.loaded =
                      true;

                    resolve();
                  };

                img.onerror =
                  () => {
                    reject(
                      new Error(
                        "Preload failed"
                      )
                    );
                  };

                img.src =
                  data.image;
              }
            );

            /*
             * Only add to queue if
             * category hasn't changed.
             */
            if (
              categoryRef.current ===
              selectedCategory
            ) {
              queueRef.current.push(
                prepared
              );
            }
          } catch (error) {
            console.error(
              "Queue fill error:",
              error
            );
          } finally {
            activeDownloadsRef.current =
              Math.max(
                0,
                activeDownloadsRef.current - 1
              );
          }
        })();
      }
    };

    fill();
  };

  /* ---------------- Initial Image ---------------- */

  const loadInitialImage =
    async () => {
      try {
        setLoading(true);

        const data =
          await fetchRandomImage(
            "all"
          );

        const img =
          await downloadImage(
            data,
            "high"
          );

        /*
         * Browser has completely
         * downloaded and decoded it.
         */
        if (img.complete) {
          setImage(data);
        }

        seenIdsRef.current.add(
          data.identifier
        );

        /*
         * Start preparing image #2.
         */
        fillQueue("all");
      } catch (error) {
        console.error(
          "Initial image error:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

  /* ---------------- Click ---------------- */

  const loadNextImage =
    async () => {
      if (waitingForNext) {
        return;
      }

      setShowInfo(false);

      /*
       * Take first loaded image
       * from queue.
       */
      const readyIndex =
        queueRef.current.findIndex(
          (item) => item.loaded
        );

      if (readyIndex !== -1) {
        const prepared =
          queueRef.current.splice(
            readyIndex,
            1
          )[0];

        setImage(
          prepared.data
        );

        seenIdsRef.current.add(
          prepared.data.identifier
        );

        /*
         * Refill the queue.
         */
        fillQueue(
          categoryRef.current
        );

        return;
      }

      /*
       * Next image isn't ready.
       *
       * Show fullscreen loader immediately.
       */
      setWaitingForNext(true);

      try {
        /*
         * Check if queue has a
         * downloading image.
         */
        const downloading =
          queueRef.current.find(
            (item) => !item.loaded
          );

        if (downloading) {
          /*
           * Remove from queue.
           */
          queueRef.current =
            queueRef.current.filter(
              (item) =>
                item !== downloading
            );

          /*
           * Stop low-priority download.
           */
          downloading.element.src =
            "";

          const data =
            downloading.data;

          /*
           * Re-download with HIGH
           * priority.
           */
          await downloadImage(
            data,
            "high"
          );

          setImage(data);

          seenIdsRef.current.add(
            data.identifier
          );
        } else {
          /*
           * No prepared image exists.
           *
           * Get a completely new one.
           */
          const data =
            await fetchRandomImage(
              categoryRef.current
            );

          await downloadImage(
            data,
            "high"
          );

          setImage(data);

          seenIdsRef.current.add(
            data.identifier
          );
        }

        /*
         * Prepare the image after this one.
         */
        fillQueue(
          categoryRef.current
        );
      } catch (error) {
        console.error(
          "Next image error:",
          error
        );
      } finally {
        setWaitingForNext(false);
      }
    };

  /* ---------------- Category ---------------- */

  const selectCategory =
    async (
      selectedCategory: string
    ) => {
      /*
       * Clear queue from previous
       * category.
       */
      queueRef.current.forEach(
        (item) => {
          item.element.src = "";
        }
      );

      queueRef.current = [];

      activeDownloadsRef.current = 0;

      categoryRef.current =
        selectedCategory;

      /*
       * Reset seen IDs for the new
       * category.
       */
      seenIdsRef.current =
        new Set();

      setCategory(
        selectedCategory
      );

      setShowMenu(false);
      setShowInfo(false);
      setWaitingForNext(true);

      try {
        const data =
          await fetchRandomImage(
            selectedCategory
          );

        await downloadImage(
          data,
          "high"
        );

        setImage(data);

        seenIdsRef.current.add(
          data.identifier
        );

        /*
         * Start next image preparation.
         */
        fillQueue(
          selectedCategory
        );
      } catch (error) {
        console.error(
          "Category error:",
          error
        );
      } finally {
        setWaitingForNext(false);
      }
    };

  /* ---------------- Initial effect ---------------- */

  useEffect(() => {
    if (
      initializedRef.current
    ) {
      return;
    }

    initializedRef.current =
      true;

    loadInitialImage();
  }, []);

  /* ---------------- Loading screen ---------------- */

  if (
    loading &&
    !image
  ) {
    return (
      <main className="screen">
        <ColorRing
          visible={true}
          height="65"
          width="65"
          ariaLabel="loading"
          wrapperStyle={{}}
          wrapperClass=""
          colors={[
            "#e15b64",
            "#f47e60",
            "#f8b26a",
            "#abbd81",
            "#849b87",
          ]}
        />
      </main>
    );
  }

  if (!image) {
    return (
      <main className="screen">
        <p className="loading">
          Failed to load image.
        </p>
      </main>
    );
  }

  return (
    <main
      className="screen"
      onClick={() => {
        if (!showMenu && !showInfo) {
          loadNextImage();
        }
      }}
    >
      <div
        className="image-background"
        style={{
          backgroundImage: `url(${JSON.stringify(image.image)})`,
        }}
      />

      <div className="image-container">
        <img
          src={image.image}
          alt={image.title}
          className="random-image"
        />
      </div>

      /*
       * Loader is now FULLSCREEN + CENTERED.
       */
      {waitingForNext && (
        <div className="image-loading">
          <ColorRing
            visible={true}
            height="65"
            width="65"
            ariaLabel="loading"
            wrapperStyle={{}}
            wrapperClass=""
            colors={[
              "#e15b64",
              "#f47e60",
              "#f8b26a",
              "#abbd81",
              "#849b87",
            ]}
          />
        </div>
      )}

      <button
        className="menu-button"
        aria-label="Open categories"
        onClick={(event) => {
          event.stopPropagation();

          setShowMenu(
            (previous) =>
              !previous
          );
        }}
      >
        ⋮
      </button>

      {showMenu && (
        <div
          className="category-menu"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <h3>General</h3>

          {categories.general.map(
            (item) => (
              <button
                key={item}
                className={
                  category === item
                    ? "category active"
                    : "category"
                }
                onClick={() =>
                  selectCategory(
                    item
                  )
                }
              >
                {item === "all"
                  ? "All"
                  : item
                      .charAt(0)
                      .toUpperCase() +
                    item.slice(1)}
              </button>
            )
          )}

          <h3>India</h3>

          {categories.india.map(
            (item) => (
              <button
                key={item}
                className={
                  category === item
                    ? "category active"
                    : "category"
                }
                onClick={() =>
                  selectCategory(
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}
        </div>
      )}

      <div
        className="bottom-overlay"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="image-info">
          <h1>
            {image.title}
          </h1>

          {image.year && (
            <p className="year">
              {image.year}
            </p>
          )}

          <button
            className="read-more"
            onClick={() =>
              setShowInfo(true)
            }
          >
            Read more
          </button>
        </div>
      </div>

      {showInfo && (
        <div
          className="info-overlay"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div className="info-card">
            <button
              className="close-button"
              aria-label="Close"
              onClick={() =>
                setShowInfo(false)
              }
            >
              ×
            </button>

            <h2>
              {image.title}
            </h2>

            {image.year && (
              <p className="info-year">
                {image.year}
              </p>
            )}

            {image.description ? (
              <p className="info-description">
                {image.description}
              </p>
            ) : (
              <p className="info-description empty-description">
                No description is available
                for this image in the
                Internet Archive.
              </p>
            )}

           
          </div>
        </div>
      )}
    </main>
  );
}

export default App;