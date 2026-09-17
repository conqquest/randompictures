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
   * Image prepared in background.
   */
  const preparedImageRef =
    useRef<PreparedImage | null>(
      null
    );

  /*
   * Prevent multiple preload requests.
   */
  const preparingRef =
    useRef(false);

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

  /*
   * Current background preload.
   */
  const preloadImageRef =
    useRef<HTMLImageElement | null>(
      null
    );

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

  /* ---------------- Preload ---------------- */

  const prepareNextImage =
    async (
      selectedCategory: string
    ) => {
      if (
        preparingRef.current
      ) {
        return;
      }

      if (
        preparedImageRef.current
      ) {
        return;
      }

      preparingRef.current =
        true;

      try {
        /*
         * Get next random image.
         */
        const data =
          await fetchRandomImage(
            selectedCategory
          );

        /*
         * Category may have changed
         * while API was responding.
         */
        if (
          categoryRef.current !==
          selectedCategory
        ) {
          return;
        }

        /*
         * Create low-priority browser
         * download.
         */
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

        preparedImageRef.current =
          prepared;

        preloadImageRef.current =
          img;

        /*
         * ACTUALLY download the image.
         */
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
                if (
                  preparedImageRef
                    .current ===
                  prepared
                ) {
                  preparedImageRef.current =
                    null;
                }

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
      } catch (error) {
        console.error(
          "Preload error:",
          error
        );

        preparedImageRef.current =
          null;
      } finally {
        preparingRef.current =
          false;

        preloadImageRef.current =
          null;
      }
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
        prepareNextImage("all");
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
       * If next image is already
       * completely downloaded:
       *
       * INSTANT SWAP.
       */
      const prepared =
        preparedImageRef.current;

      if (
        prepared &&
        prepared.loaded
      ) {
        preparedImageRef.current =
          null;

        setImage(
          prepared.data
        );

        seenIdsRef.current.add(
          prepared.data.identifier
        );

        /*
         * Immediately begin preparing
         * the next one.
         */
        prepareNextImage(
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
         * If a background image is
         * currently downloading, abandon
         * that low-priority request and
         * download the same image with
         * high priority.
         */
        if (
          prepared &&
          !prepared.loaded
        ) {
          /*
           * Stop current browser download.
           */
          prepared.element.src =
            "";

          const data =
            prepared.data;

          preparedImageRef.current =
            null;

          /*
           * User explicitly clicked,
           * therefore HIGH priority.
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
        prepareNextImage(
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
       * Clear prepared image from
       * previous category.
       */
      if (
        preloadImageRef.current
      ) {
        preloadImageRef.current.src =
          "";
      }

      preparedImageRef.current =
        null;

      preparingRef.current =
        false;

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
        prepareNextImage(
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
      <img
        src={image.image}
        alt={image.title}
        className="random-image"
      />

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

            <a
              href={`https://archive.org/details/${image.identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              View on Internet Archive
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;